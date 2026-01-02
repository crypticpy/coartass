/**
 * Transcription API Route Handler
 *
 * POST endpoint that accepts audio files and returns transcripts.
 * Uses Azure OpenAI Whisper API for speech-to-text transcription.
 *
 * Features:
 * - FormData file upload handling
 * - File validation (type, size, format)
 * - Azure OpenAI Whisper integration
 * - Structured response with segments and metadata
 * - Comprehensive error handling
 * - Rate limiting consideration
 *
 * @route POST /api/transcribe
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type {
  TranscriptionCreateResponse,
  TranscriptionDiarized,
  TranscriptionVerbose,
} from 'openai/resources/audio/transcriptions';
import {
  getTranscriptionClient,
  getWhisperDeployment,
  OpenAIConfigError,
  generateTranscriptSummary,
  getAzureCredentials,
  isAzureOpenAI,
} from '@/lib/openai';
import {
  getSupportedAudioTypes,
  getSupportedAudioExtensions,
  getMaxFileSize,
  getMaxFileSizeMB,
  isSupportedAudioType,
  isValidFileSize,
  hasSupportedAudioExtension,
} from '@/lib/validations';
import {
  generateTranscriptId,
  convertWhisperResponse,
  extractMetadata,
  sanitizeSegments,
  validateSegments,
  type WhisperVerboseResponse,
} from '@/lib/transcription-utils';
import { errorResponse, successResponse } from '@/lib/api-utils';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import type { Transcript } from '@/types';

const log = createLogger('Transcribe');

/**
 * Maximum retry attempts for transient failures
 */
const MAX_RETRIES = 3;

/**
 * Retry delay in milliseconds (exponential backoff)
 */
const RETRY_BASE_DELAY = 1000;

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate obfuscated filename for Azure API calls.
 * Preserves only the file extension, replaces name with UUID.
 * This prevents PII in filenames from being sent to Azure.
 */
function obfuscateFilename(originalFilename: string): string {
  const ext = originalFilename.split('.').pop()?.toLowerCase() || 'mp3';
  const uuid = crypto.randomUUID();
  return `${uuid}.${ext}`;
}

/**
 * Generate short hash of filename for log correlation.
 * Not reversible - safe for logging without exposing PII.
 * Uses simple hash to avoid async crypto.subtle.
 */
function hashFilename(filename: string): string {
  let hash = 0;
  for (let i = 0; i < filename.length; i++) {
    const char = filename.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to base36 and take 8 chars for compact representation
  return Math.abs(hash).toString(36).padStart(8, '0').slice(0, 8);
}

/**
 * Direct REST API call for Azure diarize model
 *
 * The OpenAI SDK doesn't support diarized_json format, so we need
 * to call the Azure REST API directly for gpt-4o-transcribe-diarize.
 *
 * @param file - Audio file blob
 * @param filename - Original filename
 * @param model - Model name (should be gpt-4o-transcribe-diarize)
 * @param language - Optional language code
 * @returns Transcription response with segments
 */
async function transcribeDiarizeDirectAPI(
  file: Blob,
  filename: string,
  model: string,
  language?: string | null
): Promise<TranscriptionDiarized> {
  const { endpoint, apiKey } = getAzureCredentials();

  // Use API version shown in Azure portal for diarize deployment
  const diarizeApiVersion = '2025-03-01-preview';

  // Build URL for the transcription endpoint
  // Format: {endpoint}/openai/deployments/{deployment}/audio/transcriptions?api-version={version}
  const url = `${endpoint}/openai/deployments/${model}/audio/transcriptions?api-version=${diarizeApiVersion}`;

  // Create form data - must include model field for Azure
  // Use obfuscated filename to prevent PII from being sent to Azure
  const safeFilename = obfuscateFilename(filename);
  const formData = new FormData();
  formData.append('file', file, safeFilename);
  formData.append('model', model); // Required: specify the model/deployment name
  formData.append('response_format', 'diarized_json');
  formData.append('chunking_strategy', 'auto'); // Required for diarization models
  if (language) {
    formData.append('language', language);
  }

  log.debug('Calling Azure REST API directly for diarize', {
    url: url.replace(apiKey, '***'),
    model,
    apiVersion: diarizeApiVersion,
    responseFormat: 'diarized_json',
  });

  // Create AbortController for timeout handling
  // Increased to 5 minutes (300 seconds) to support longer audio files
  // A 10-minute Teams recording can take 3-4 minutes to transcribe with diarization
  const controller = new AbortController();
  const DIARIZATION_TIMEOUT_MS = 300000; // 5 minutes
  const timeoutId = setTimeout(() => controller.abort(), DIARIZATION_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      log.error('Azure REST API error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`${response.status} ${errorText}`);
    }

    const data = await response.json();
    log.debug('Azure REST API success', {
      hasSegments: Array.isArray(data.segments),
      segmentCount: data.segments?.length || 0,
      textLength: data.text?.length || 0,
    });

    return data as TranscriptionDiarized;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      // Create a timeout error that preserves retryability
      // The error message must contain 'timeout' to trigger retry logic
      const timeoutError = new Error('Diarization API timeout after 5 minutes');
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  }
}

type AudioResponseFormat =
  | 'json'
  | 'text'
  | 'srt'
  | 'verbose_json'
  | 'vtt'
  | 'diarized_json';

function determineResponseFormat(
  model: string
): AudioResponseFormat {
  const normalized = model.trim().toLowerCase();

  // Whisper models support verbose_json for detailed timestamps
  if (normalized.startsWith('whisper')) {
    return 'verbose_json';
  }

  // GPT-4o transcribe-diarize requires diarized_json to get segments with speaker labels.
  // This format returns segments with start, end, text, and speaker fields.
  if (normalized.includes('diarize')) {
    return 'diarized_json';
  }

  // Standard GPT-4o transcribe models use json format (no segments available)
  if (normalized.includes('gpt-4o') && normalized.includes('transcribe')) {
    return 'json';
  }

  return 'json';
}

function extractUsageDuration(usage: unknown): number | undefined {
  if (!usage || typeof usage !== 'object') {
    return undefined;
  }

  const seconds = (usage as { seconds?: unknown }).seconds;
  return typeof seconds === 'number' ? seconds : undefined;
}

function isDiarizedResponse(
  response: TranscriptionCreateResponse
): response is TranscriptionDiarized {
  // Azure diarized_json may not include 'task' field
  // Check for segments array with diarize-specific structure (speaker field)
  const segments = (response as TranscriptionDiarized).segments;
  if (!Array.isArray(segments) || segments.length === 0) {
    return false;
  }
  // Diarized segments have speaker field, verbose segments don't
  const firstSegment = segments[0];
  return (
    typeof firstSegment === 'object' &&
    firstSegment !== null &&
    typeof firstSegment.start === 'number' &&
    typeof firstSegment.end === 'number' &&
    typeof firstSegment.text === 'string' &&
    'speaker' in firstSegment
  );
}

function isVerboseResponse(
  response: TranscriptionCreateResponse
): response is TranscriptionVerbose {
  return (
    typeof (response as TranscriptionVerbose).language === 'string' &&
    typeof (response as TranscriptionVerbose).duration === 'number'
  );
}

function normalizeSpeakerLabel(
  rawSpeaker: unknown,
  segmentIndex: number
): string | undefined {
  if (typeof rawSpeaker === 'string') {
    const trimmed = rawSpeaker.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  if (typeof rawSpeaker === 'number' && Number.isFinite(rawSpeaker)) {
    return `Speaker ${Math.trunc(rawSpeaker) + 1}`;
  }

  if (rawSpeaker && typeof rawSpeaker === 'object') {
    const maybeLabel =
      typeof (rawSpeaker as { label?: unknown }).label === 'string'
        ? (rawSpeaker as { label?: string }).label
        : typeof (rawSpeaker as { name?: unknown }).name === 'string'
          ? (rawSpeaker as { name?: string }).name
          : undefined;

    if (maybeLabel) {
      const trimmed = maybeLabel.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return `Speaker ${segmentIndex + 1}`;
}

function normalizeTranscriptionResponse(
  response: TranscriptionCreateResponse
): WhisperVerboseResponse {
  if (isDiarizedResponse(response)) {
    const duration =
      response.duration ?? extractUsageDuration(response.usage);

    return {
      task: response.task,
      duration,
      text: response.text,
      segments: response.segments.map((segment, index) => ({
        id: segment.id ?? index,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        speaker: normalizeSpeakerLabel(segment.speaker, index),
      })),
    };
  }

  if (isVerboseResponse(response)) {
    const duration =
      response.duration ?? extractUsageDuration(response.usage);

    return {
      task: 'transcribe',
      language: response.language,
      duration,
      text: response.text,
      segments: response.segments?.map((segment) => ({
        id: segment.id,
        seek: segment.seek,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        tokens: segment.tokens,
        temperature: segment.temperature,
        avg_logprob: segment.avg_logprob,
        compression_ratio: segment.compression_ratio,
        no_speech_prob: segment.no_speech_prob,
      })),
    };
  }

  const usageDuration = extractUsageDuration(
    (response as { usage?: unknown }).usage
  );

  return {
    task: 'transcribe',
    language: (response as { language?: string }).language,
    duration: usageDuration,
    text: response.text,
    segments: [],
  };
}

/**
 * Validate file from FormData
 */
async function validateFile(formData: FormData): Promise<{
  valid: boolean;
  file?: Blob;
  filename?: string;
  error?: string;
  status?: number;
}> {
  const fileEntry = formData.get('file');

  // Check if file exists
  if (!fileEntry) {
    return {
      valid: false,
      error: 'No file provided. Please upload an audio file.',
      status: 400,
    };
  }

  // Check if it's a Blob/File object (File extends Blob)
  if (!(fileEntry instanceof Blob)) {
    return {
      valid: false,
      error: 'Invalid file format. Expected a File object.',
      status: 400,
    };
  }

  // Get filename - File objects have name, Blob objects may not
  const filename = (fileEntry as { name?: string }).name || 'audio.mp3';

  // Check file size - empty file
  if (fileEntry.size === 0) {
    return {
      valid: false,
      error: 'File is empty. Please upload a valid audio file.',
      status: 400,
    };
  }

  // Check file size - minimum (1 KB)
  if (fileEntry.size < 1024) {
    return {
      valid: false,
      error: 'File is too small. Minimum file size is 1 KB.',
      status: 400,
    };
  }

  // Check file size - maximum (25 MB for Whisper)
  if (!isValidFileSize(fileEntry.size)) {
    const maxSizeMB = getMaxFileSizeMB();
    return {
      valid: false,
      error: `File is too large. Maximum file size is ${maxSizeMB}MB.`,
      status: 413,
    };
  }

  // Check file type
  if (!isSupportedAudioType(fileEntry.type)) {
    const supportedTypes = getSupportedAudioTypes();
    return {
      valid: false,
      error: `Unsupported file type: ${fileEntry.type}. Supported types: ${supportedTypes.join(', ')}`,
      status: 400,
    };
  }

  // Check filename extension as additional validation
  // Use shared validation to avoid duplicate extension lists
  if (!hasSupportedAudioExtension(filename)) {
    const supportedExtensions = getSupportedAudioExtensions();
    return {
      valid: false,
      error: `Unsupported file extension. Supported extensions: ${supportedExtensions.join(', ')}`,
      status: 400,
    };
  }

  return { valid: true, file: fileEntry, filename };
}

/**
 * Call OpenAI Whisper API with retry logic
 */
async function transcribeWithRetry(
  file: Blob,
  filename: string,
  options: {
    model: string;
    language?: string | null;
    responseFormat: AudioResponseFormat;
  },
  retries = MAX_RETRIES
): Promise<{
  response: TranscriptionCreateResponse;
  responseFormat: AudioResponseFormat;
}> {
  let lastError: Error | null = null;
  let currentFormat = options.responseFormat;

  // Create hash for log correlation - never log actual filename (may contain PII)
  const fileHash = hashFilename(filename);

  // Check if this is a diarize model that needs direct REST API call
  const isDiarizeModel = options.model.toLowerCase().includes('diarize');
  const shouldUseDiarizeDirectAPI = isDiarizeModel && isAzureOpenAI();

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Log attempt with hash only (no PII)
      log.debug(`Attempt ${attempt + 1}/${retries} for file`, { fileHash });

      // Use direct REST API for diarize models (SDK doesn't support diarized_json)
      if (shouldUseDiarizeDirectAPI) {
        const response = await transcribeDiarizeDirectAPI(
          file,
          filename,
          options.model,
          options.language
        );
        return { response, responseFormat: 'diarized_json' };
      }

      // For non-diarize models, use the SDK
      const client = getTranscriptionClient();

      // Create a File object for OpenAI API
      // The OpenAI SDK requires a File object with a name property
      // Use obfuscated filename to prevent PII from being sent to Azure/OpenAI
      const safeFilename = obfuscateFilename(filename);
      const fileWithName = new File([file], safeFilename, { type: file.type });

      // Build API request parameters
      const requestParams: Record<string, unknown> = {
        file: fileWithName,
        model: options.model,
      };

      // Add language if specified
      if (options.language) {
        requestParams.language = options.language;
      }

      if (currentFormat) {
        requestParams.response_format = currentFormat;

        if (currentFormat === 'verbose_json') {
          requestParams.timestamp_granularities = ['segment'];
        }
      }

      // Call Whisper API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await client.audio.transcriptions.create(requestParams as any);

      log.debug('Success for file', { fileHash, responseFormat: currentFormat });

      return { response, responseFormat: currentFormat };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Log error with hash only (no PII)
      log.warn(`Attempt ${attempt + 1} failed`, {
        error: lastError.message,
        fileHash,
      });

      const message = lastError.message.toLowerCase();
      const formatRejected =
        message.includes('response_format') && currentFormat !== 'json';

      if (formatRejected) {
        log.warn(`Response format ${currentFormat} rejected. Falling back to json.`);
        currentFormat = 'json';
        continue;
      }

      // Check if error is retryable
      const isRetryable = isRetryableError(error);

      if (!isRetryable || attempt === retries - 1) {
        // Don't retry non-retryable errors or last attempt
        throw lastError;
      }

      // Exponential backoff
      const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
      log.debug(`Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // This should never be reached due to throw in loop
  throw lastError || new Error('Transcription failed after retries');
}

/**
 * Check if an error is retryable
 *
 * Retryable errors include:
 * - Network errors (connection refused, reset, timeout, DNS failures)
 * - Abort errors from timeout (AbortError)
 * - Rate limit errors (429)
 * - Server errors (5xx: 500, 502, 503, 504)
 * - Request timeout (408)
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // Network errors are retryable
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('econnrefused') ||
    message.includes('etimedout')
  ) {
    return true;
  }

  // Abort errors (from timeout via AbortController) are retryable
  if (error.name === 'AbortError' || message.includes('abort')) {
    return true;
  }

  // Rate limit errors are retryable (429)
  if (message.includes('rate limit') || message.includes('429')) {
    return true;
  }

  // Server errors (5xx) are retryable
  if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504')
  ) {
    return true;
  }

  // Request timeout (408) is retryable
  if (message.includes('408')) {
    return true;
  }

  // Default: not retryable
  return false;
}

/**
 * Parse OpenAI error for user-friendly message
 */
function parseOpenAIError(error: unknown): {
  message: string;
  status: number;
  details?: Record<string, unknown>;
} {
  if (!(error instanceof Error)) {
    return {
      message: 'An unknown error occurred during transcription.',
      status: 500,
    };
  }

  const message = error.message.toLowerCase();

  // Rate limit error (429)
  if (message.includes('rate limit') || message.includes('429')) {
    return {
      message:
        'Rate limit exceeded. Please wait a moment and try again.',
      status: 429,
    };
  }

  // Authentication error (401)
  if (message.includes('unauthorized') || message.includes('401')) {
    return {
      message:
        'Authentication failed. Please check API configuration.',
      status: 500,
      details: { type: 'configuration_error' },
    };
  }

  // Invalid request (400)
  if (message.includes('invalid') || message.includes('400')) {
    return {
      message: `Invalid request: ${error.message}`,
      status: 400,
    };
  }

  // Network/timeout errors
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset')
  ) {
    return {
      message:
        'Network error occurred. Please check your connection and try again.',
      status: 503,
    };
  }

  // Server errors (5xx)
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return {
      message:
        'OpenAI service is temporarily unavailable. Please try again later.',
      status: 503,
    };
  }

  // Default error
  return {
    message: `Transcription failed: ${error.message}`,
    status: 500,
  };
}

/**
 * POST /api/transcribe
 *
 * Handles audio file upload and transcription.
 *
 * Request:
 * - Content-Type: multipart/form-data
 * - Body: FormData with 'file' field containing audio file
 *
 * Response:
 * - Success (200): { success: true, data: Transcript }
 * - Error (4xx/5xx): { success: false, error: string, details?: object }
 *
 * Status Codes:
 * - 200: Success
 * - 400: Bad Request (invalid file, missing file, etc.)
 * - 413: Payload Too Large (file > 25MB)
 * - 429: Too Many Requests (rate limit)
 * - 500: Internal Server Error (API error, config error, etc.)
 * - 503: Service Unavailable (OpenAI service down)
 */
export async function POST(request: NextRequest) {
  log.debug('Received transcription request');

  if (process.env.NODE_ENV === 'production') {
    const decision = checkRateLimit(request, {
      key: 'transcribe',
      windowMs: 10 * 60 * 1000,
      max: 80,
    });
    if (!decision.allowed) {
      return rateLimitResponse(decision);
    }
  }

  try {
    // Validate environment configuration first
    let model: string;
    try {
      model = getWhisperDeployment();
    } catch (error) {
      if (error instanceof OpenAIConfigError) {
        log.error('Configuration error', { message: error.message });
        return errorResponse(
          'Server configuration error. OpenAI API is not properly configured.',
          500,
          {
            type: 'configuration_error',
            message: error.message,
          }
        );
      }
      throw error;
    }

    // Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      log.warn('Failed to parse FormData', {
        message: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(
        'Failed to parse request. Please ensure you are sending FormData with a file.',
        400
      );
    }

    // Validate file
    const validation = await validateFile(formData);
    if (!validation.valid) {
      log.warn('File validation failed', { error: validation.error });
      return errorResponse(
        validation.error!,
        validation.status!
      );
    }

    const file = validation.file!;
    const filename = validation.filename!;

    // Create hash for log correlation - never log actual filename (may contain PII)
    const fileHash = hashFilename(filename);

    // Get optional parameters from formData
    const enableSpeakerDetection = formData.get('enableSpeakerDetection') === 'true';
    const languageParam = formData.get('language') as string | null;
    const modelParam = formData.get('model') as string | null;

    const partIndexParam = formData.get('partIndex');
    const totalPartsParam = formData.get('totalParts');
    const partIndex = partIndexParam ? Number(partIndexParam) : undefined;
    const totalParts = totalPartsParam ? Number(totalPartsParam) : undefined;

    // Log with hash only - never log actual filename (may contain PII)
    log.debug('Processing file', {
      fileHash,
      size: file.size,
      type: file.type,
      enableSpeakerDetection,
      language: languageParam,
      model: modelParam || model,
      partIndex,
      totalParts,
    });

    // Use model parameter from request or default
    const transcriptionModel = modelParam || model;
    const responseFormat = determineResponseFormat(
      transcriptionModel
    );

    // Transcribe with OpenAI Whisper API (with retry logic)
    let transcriptionResult:
      | {
          response: TranscriptionCreateResponse;
          responseFormat: AudioResponseFormat;
        }
      | undefined;
    try {
      transcriptionResult = await transcribeWithRetry(
        file,
        filename,
        {
          model: transcriptionModel,
          language: languageParam,
          responseFormat,
        }
      );
    } catch (error) {
      log.error('OpenAI API error', {
        message: error instanceof Error ? error.message : String(error),
      });
      const { message, status, details } = parseOpenAIError(error);
      return errorResponse(message, status, details);
    }

    const { response: rawResponse, responseFormat: finalFormat } =
      transcriptionResult;
    const whisperResponse = normalizeTranscriptionResponse(rawResponse);

    log.debug('Normalized transcription response', {
      format: finalFormat,
      hasSegments: Array.isArray(whisperResponse.segments),
      segmentCount: whisperResponse.segments?.length || 0,
    });

    // Convert and sanitize response segments
    const convertedSegments = convertWhisperResponse(whisperResponse);
    const allowSegmentOverlaps = finalFormat === 'diarized_json';
    const { segments, warnings: sanitationWarnings } = sanitizeSegments(
      convertedSegments,
      {
        allowOverlaps: allowSegmentOverlaps,
        overlapEpsilon: 0.05,
        minDuration: 0.001,
      }
    );

    if (sanitationWarnings.length > 0) {
      log.warn('Segment sanitation warnings', { warnings: sanitationWarnings });
    }

    // Validate segments - log warnings but don't fail the request
    // A single invalid segment should not cause the entire transcript to be rejected
    const segmentValidation = validateSegments(segments, {
      allowOverlaps: allowSegmentOverlaps,
      overlapEpsilon: 0.05,
      minDuration: 0.001,
    });
    if (!segmentValidation.valid) {
      // Log validation issues as warnings, but continue processing with available segments
      log.warn('Segment validation warnings (continuing with available segments)', {
        errors: segmentValidation.errors,
        segmentCount: segments.length,
        ...(sanitationWarnings.length > 0 ? { sanitationWarnings } : {}),
      });
    }

    // Extract metadata
    const metadata = extractMetadata(whisperResponse, file.size, transcriptionModel);
    if (!metadata.language && languageParam) {
      metadata.language = languageParam;
    }

    // Build transcript response
    const transcript: Transcript = {
      id: generateTranscriptId(),
      filename: filename,
      text: whisperResponse.text,
      segments,
      metadata,
      createdAt: new Date(),
      partIndex,
      totalParts,
    };

    // Generate AI summary (non-blocking - won't fail transcription if summary fails)
    if (transcript.text && transcript.text.length > 50) {
      log.debug('Generating AI summary...');
      const summary = await generateTranscriptSummary(transcript.text);
      if (summary) {
        transcript.summary = summary;
        log.debug('Summary generated', {
          summaryLength: summary.length,
        });
      }
    }

    // Log completion with hash only (no PII)
    log.info('Transcription completed', {
      id: transcript.id,
      fileHash,
      segmentCount: segments.length,
      duration: metadata.duration,
      language: metadata.language,
    });

    return successResponse(transcript);
  } catch (error) {
    // Catch-all for unexpected errors
    log.error('Unexpected error', {
      message: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof z.ZodError) {
      return errorResponse(
        'Validation error',
        400,
        {
          type: 'validation_error',
          errors: error.issues,
        }
      );
    }

    return errorResponse(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
}

/**
 * GET /api/transcribe
 *
 * Returns API information and supported formats.
 */
export async function GET() {
  const supportedTypes = getSupportedAudioTypes();
  const maxSize = getMaxFileSize();
  const maxSizeMB = getMaxFileSizeMB();

  return NextResponse.json({
    success: true,
    data: {
      endpoint: '/api/transcribe',
      method: 'POST',
      contentType: 'multipart/form-data',
      supportedFormats: supportedTypes,
      maxFileSize: maxSize,
      maxFileSizeMB: maxSizeMB,
      features: [
        'Audio transcription using Azure OpenAI Whisper',
        'Timestamp segments for each phrase',
        'Language detection and specification',
        'Automatic retry on transient failures',
        'MP4 video to MP3 audio conversion (client-side)',
        'Large file splitting at silence points (client-side)',
        'Speaker detection (UI ready, implementation pending)',
      ],
      usage: {
        description: 'Upload an audio file for transcription',
        example: 'POST /api/transcribe with FormData containing "file" field',
      },
    },
  });
}
