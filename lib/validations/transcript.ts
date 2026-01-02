/**
 * Transcript Validation Schemas
 *
 * Zod schemas for validating transcript data, file uploads, segments, and metadata.
 * Provides runtime validation for transcription operations.
 */

import { z } from 'zod';

/**
 * Supported audio/video file MIME types (Whisper API compatible)
 */
const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg', // MP3
  'audio/mp4', // M4A
  'audio/wav', // WAV
  'audio/wave', // WAV alternative
  'audio/x-wav', // WAV alternative
  'audio/webm', // WebM
  'audio/ogg', // OGG
  'audio/flac', // FLAC
  'audio/aac', // AAC
  'audio/x-m4a', // M4A alternative
  'video/mp4', // MP4 video (Teams recordings, etc.)
] as const;

/**
 * Supported audio/video file extensions (Whisper API compatible)
 */
const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3',
  '.mp4',
  '.m4a',
  '.wav',
  '.webm',
  '.ogg',
  '.flac',
  '.aac',
] as const;

/**
 * Maximum file size (25MB - OpenAI Whisper limit)
 */
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes

/**
 * Minimum file size (1KB - to prevent empty files)
 */
const MIN_FILE_SIZE = 1024; // 1KB in bytes

/**
 * Maximum duration (4 hours)
 */
const MAX_DURATION = 4 * 60 * 60; // 4 hours in seconds

/**
 * Minimum duration (1 second)
 */
const MIN_DURATION = 1; // 1 second

/**
 * Maximum filename length
 */
const MAX_FILENAME_LENGTH = 255;

/**
 * Audio file magic numbers (file signatures) for binary validation.
 * Each format maps to an array of possible signatures (some formats have multiple valid headers).
 * Used to detect corrupted or misnamed files before they waste API calls.
 */
export const AUDIO_MAGIC_NUMBERS: Record<string, number[][]> = {
  // MP3: ID3 tag or MPEG sync word
  mp3: [
    [0x49, 0x44, 0x33], // ID3
    [0xff, 0xfb], // MPEG Layer 3
    [0xff, 0xfa], // MPEG Layer 3
    [0xff, 0xf3], // MPEG Layer 3
    [0xff, 0xf2], // MPEG Layer 3
  ],
  // WAV: RIFF header
  wav: [[0x52, 0x49, 0x46, 0x46]], // "RIFF"
  // WebM/MKV: EBML header
  webm: [[0x1a, 0x45, 0xdf, 0xa3]],
  // OGG: OggS
  ogg: [[0x4f, 0x67, 0x67, 0x53]], // "OggS"
  // FLAC
  flac: [[0x66, 0x4c, 0x61, 0x43]], // "fLaC"
  // MP4/M4A: Check for 'ftyp' at offset 4
  mp4: [[0x66, 0x74, 0x79, 0x70]], // "ftyp" - check at offset 4
};

/**
 * Processing plan metadata describing how oversized files will be handled client-side.
 */
const fileProcessingPlanSchema = z.object({
  willConvert: z.boolean().optional(),
  willSplit: z.boolean().optional(),
  estimatedConvertedBytes: z
    .number()
    .int('Estimated converted size must be an integer')
    .positive('Estimated converted size must be positive')
    .optional(),
  targetChunkBytes: z
    .number()
    .int('Estimated chunk size must be an integer')
    .positive('Estimated chunk size must be positive')
    .optional(),
  expectedChunkCount: z
    .number()
    .int('Chunk count must be an integer')
    .positive('Chunk count must be positive')
    .optional(),
});

/**
 * Transcription Status Schema
 */
export const transcriptionStatusSchema = z.enum(
  ['uploading', 'processing', 'transcribing', 'complete', 'error'],
  {
    message:
      'Transcription status must be one of: uploading, processing, transcribing, complete, error',
  }
);

/**
 * Transcript Segment Schema
 */
export const transcriptSegmentSchema = z.object({
  index: z
    .number()
    .int('Segment index must be an integer')
    .nonnegative('Segment index must be non-negative'),
  start: z
    .number()
    .nonnegative('Start time must be non-negative')
    .max(MAX_DURATION, `Start time cannot exceed ${MAX_DURATION} seconds`),
  end: z
    .number()
    .nonnegative('End time must be non-negative')
    .max(MAX_DURATION, `End time cannot exceed ${MAX_DURATION} seconds`),
  text: z
    .string()
    .min(1, 'Segment text cannot be empty')
    .max(5000, 'Segment text must be 5000 characters or less')
    .trim(),
  speaker: z.string().optional(),
}).refine(
  (segment) => segment.end > segment.start,
  {
    message: 'End time must be greater than start time',
  }
);

/**
 * Whisper Model Schema
 */
const whisperModelSchema = z
  .string()
  .regex(
    /^whisper(-1)?$/,
    'Model must be "whisper-1" or a valid Whisper model identifier'
  );

/**
 * Language Code Schema (ISO 639-1)
 */
const languageCodeSchema = z
  .string()
  .length(2, 'Language code must be 2 characters (ISO 639-1)')
  .regex(/^[a-z]{2}$/, 'Language code must be lowercase letters')
  .optional();

/**
 * Transcript Metadata Schema
 */
export const transcriptMetadataSchema = z.object({
  model: whisperModelSchema,
  language: languageCodeSchema,
  fileSize: z
    .number()
    .int('File size must be an integer')
    .min(MIN_FILE_SIZE, `File size must be at least ${MIN_FILE_SIZE} bytes`)
    .max(MAX_FILE_SIZE, `File size cannot exceed ${MAX_FILE_SIZE} bytes`),
  duration: z
    .number()
    .nonnegative('Duration must be non-negative')
    .min(MIN_DURATION, `Duration must be at least ${MIN_DURATION} second`)
    .max(MAX_DURATION, `Duration cannot exceed ${MAX_DURATION} seconds`),
});

/**
 * Filename Schema
 */
const filenameSchema = z
  .string()
  .min(1, 'Filename cannot be empty')
  .max(MAX_FILENAME_LENGTH, `Filename must be ${MAX_FILENAME_LENGTH} characters or less`)
  .refine(
    (filename) => {
      // Check for valid filename characters (no path separators)
      return !/[/\\]/.test(filename);
    },
    {
      message: 'Filename cannot contain path separators',
    }
  )
  .refine(
    (filename) => {
      // Check for supported extensions
      const lower = filename.toLowerCase();
      return SUPPORTED_AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
    },
    {
      message: `Filename must have a supported audio extension: ${SUPPORTED_AUDIO_EXTENSIONS.join(', ')}`,
    }
  );

/**
 * Transcript ID Schema
 */
const transcriptIdSchema = z
  .string()
  .min(1, 'Transcript ID cannot be empty')
  .max(100, 'Transcript ID must be 100 characters or less');

/**
 * Transcript Schema
 */
export const transcriptSchema = z.object({
  id: transcriptIdSchema,
  filename: filenameSchema,
  text: z
    .string()
    .min(1, 'Transcript text cannot be empty')
    .max(1000000, 'Transcript text must be 1,000,000 characters or less'),
  segments: z
    .array(transcriptSegmentSchema)
    .min(1, 'Transcript must have at least one segment')
    .max(10000, 'Transcript cannot have more than 10,000 segments'),
  audioUrl: z.string().url('Audio URL must be a valid URL').optional(),
  createdAt: z.date(),
  metadata: transcriptMetadataSchema,
});

/**
 * Transcript Input Schema (before ID and createdAt are assigned)
 */
export const transcriptInputSchema = transcriptSchema.omit({ id: true, createdAt: true });

/**
 * Transcript Update Schema (partial with required ID)
 */
export const transcriptUpdateSchema = transcriptSchema.partial().required({ id: true });

/**
 * Transcription Progress Schema
 */
export const transcriptionProgressSchema = z.object({
  status: transcriptionStatusSchema,
  progress: z
    .number()
    .min(0, 'Progress must be at least 0')
    .max(100, 'Progress cannot exceed 100'),
  message: z.string().max(500, 'Message must be 500 characters or less').optional(),
  error: z.string().max(1000, 'Error message must be 1000 characters or less').optional(),
});

/**
 * File Upload Validation Schema
 *
 * Note: The file field uses z.any() instead of z.instanceof(File) because File
 * is not available in Node.js/server-side environments. The actual File validation
 * happens at runtime in client-side code.
 */
export const fileUploadSchema = z
  .object({
    file: z.any().refine((val) => {
      // Only check instanceof File if in browser environment
      if (typeof window !== 'undefined') {
        return val instanceof File || val instanceof Blob;
      }
      // In server environment, accept any object (validated elsewhere)
      return true;
    }, { message: 'Must be a File or Blob object' }),
    name: filenameSchema,
    size: z
      .number()
      .int('File size must be an integer')
      .min(MIN_FILE_SIZE, `File must be at least ${MIN_FILE_SIZE} bytes`),
    type: z
      .string()
      .refine(
        (type) => (SUPPORTED_AUDIO_TYPES as readonly string[]).includes(type),
        {
          message: `File type must be one of: ${SUPPORTED_AUDIO_TYPES.join(', ')}`,
        }
      ),
    processingPlan: fileProcessingPlanSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    if (data.size <= MAX_FILE_SIZE) {
      return;
    }

    const plan = data.processingPlan;

    // Allow oversized files if they will be converted down beneath the limit
    if (plan?.willConvert && !plan.willSplit) {
      if (!plan.estimatedConvertedBytes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['processingPlan', 'estimatedConvertedBytes'],
          message: 'Estimated converted size is required when allowing oversized files via conversion.',
        });
        return;
      }

      if (plan.estimatedConvertedBytes > MAX_FILE_SIZE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['processingPlan', 'estimatedConvertedBytes'],
          message: `Converted audio would still exceed ${maxSizeMB}MB. Enable splitting.`,
        });
        return;
      }

      return;
    }

    // Allow oversized files if they will be split into compliant chunks
    if (plan?.willSplit) {
      if (!plan.targetChunkBytes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['processingPlan', 'targetChunkBytes'],
          message: 'Estimated chunk size is required when allowing oversized files via splitting.',
        });
        return;
      }

      if (plan.targetChunkBytes > MAX_FILE_SIZE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['processingPlan', 'targetChunkBytes'],
          message: `Estimated chunk size cannot exceed ${maxSizeMB}MB.`,
        });
        return;
      }

      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['size'],
      message: `File cannot exceed ${maxSizeMB}MB`,
    });
  });

/**
 * Type inference from schemas
 */
export type TranscriptionStatus = z.infer<typeof transcriptionStatusSchema>;
export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;
export type TranscriptMetadata = z.infer<typeof transcriptMetadataSchema>;
export type Transcript = z.infer<typeof transcriptSchema>;
export type TranscriptInput = z.infer<typeof transcriptInputSchema>;
export type TranscriptUpdate = z.infer<typeof transcriptUpdateSchema>;
export type TranscriptionProgress = z.infer<typeof transcriptionProgressSchema>;
export type FileProcessingPlan = z.infer<typeof fileProcessingPlanSchema>;
export type FileUpload = z.infer<typeof fileUploadSchema>;

/**
 * Result of magic number validation for audio files.
 * Returned by validateFileMagicNumber to indicate whether the file's
 * binary signature matches a known audio format.
 */
export interface MagicNumberValidationResult {
  /** Whether the file has a valid audio magic number */
  valid: boolean;
  /** The detected audio format type (e.g., 'mp3', 'wav', 'mp4'), or null if invalid */
  detectedType: string | null;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Validate transcript segment
 *
 * @param segment - Segment data to validate
 * @returns Validated segment
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * const segment = {
 *   index: 0,
 *   start: 0.5,
 *   end: 5.2,
 *   text: 'Hello, world!',
 * };
 *
 * const validated = validateTranscriptSegment(segment);
 * ```
 */
export function validateTranscriptSegment(segment: unknown): TranscriptSegment {
  return transcriptSegmentSchema.parse(segment);
}

/**
 * Validate transcript metadata
 *
 * @param metadata - Metadata to validate
 * @returns Validated metadata
 * @throws {z.ZodError} If validation fails
 */
export function validateTranscriptMetadata(metadata: unknown): TranscriptMetadata {
  return transcriptMetadataSchema.parse(metadata);
}

/**
 * Validate complete transcript
 *
 * @param transcript - Transcript data to validate
 * @returns Validated transcript
 * @throws {z.ZodError} If validation fails
 */
export function validateTranscript(transcript: unknown): Transcript {
  return transcriptSchema.parse(transcript);
}

/**
 * Validate transcript input
 *
 * @param input - Transcript input data
 * @returns Validated transcript input
 * @throws {z.ZodError} If validation fails
 */
export function validateTranscriptInput(input: unknown): TranscriptInput {
  return transcriptInputSchema.parse(input);
}

/**
 * Validate transcript update
 *
 * @param update - Transcript update data
 * @returns Validated update
 * @throws {z.ZodError} If validation fails
 */
export function validateTranscriptUpdate(update: unknown): TranscriptUpdate {
  return transcriptUpdateSchema.parse(update);
}

/**
 * Validate transcription progress
 *
 * @param progress - Progress data to validate
 * @returns Validated progress
 * @throws {z.ZodError} If validation fails
 */
export function validateTranscriptionProgress(progress: unknown): TranscriptionProgress {
  return transcriptionProgressSchema.parse(progress);
}

/**
 * Validate file upload
 *
 * @param fileData - File data to validate
 * @returns Validated file upload data
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * const fileInput = document.getElementById('audio-file') as HTMLInputElement;
 * const file = fileInput.files?.[0];
 *
 * if (file) {
 *   try {
 *     const validated = validateFileUpload({
 *       file,
 *       name: file.name,
 *       size: file.size,
 *       type: file.type,
 *       processingPlan: file.size > getMaxFileSize()
 *         ? {
 *             willSplit: true,
 *             targetChunkBytes: 20 * 1024 * 1024,
 *             expectedChunkCount: 6,
 *           }
 *         : undefined,
 *     });
 *     console.log('File is valid:', validated);
 *   } catch (error) {
 *     console.error('File validation failed:', error);
 *   }
 * }
 * ```
 */
export function validateFileUpload(fileData: unknown): FileUpload {
  return fileUploadSchema.parse(fileData);
}

/**
 * Validate transcription status
 *
 * @param status - Status to validate
 * @returns Validated status
 * @throws {z.ZodError} If validation fails
 */
export function validateTranscriptionStatus(status: unknown): TranscriptionStatus {
  return transcriptionStatusSchema.parse(status);
}

/**
 * Safe file upload validation that returns success/error result
 *
 * @param fileData - File data to validate
 * @returns Result object with success flag and data or error
 *
 * @example
 * ```typescript
 * const result = safeValidateFileUpload({ file, name, size, type });
 * if (result.success) {
 *   console.log('Valid file:', result.data);
 *   // Proceed with upload
 * } else {
 *   console.error('Validation errors:', result.error.format());
 *   // Show error to user
 * }
 * ```
 */
export function safeValidateFileUpload(
  fileData: unknown
): { success: true; data: FileUpload } | { success: false; error: z.ZodError } {
  const result = fileUploadSchema.safeParse(fileData);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Safe transcript validation that returns success/error result
 *
 * @param transcript - Transcript to validate
 * @returns Result object with success flag and data or error
 */
export function safeValidateTranscript(
  transcript: unknown
): { success: true; data: Transcript } | { success: false; error: z.ZodError } {
  const result = transcriptSchema.safeParse(transcript);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Check if a file type is supported (type guard)
 *
 * @param mimeType - MIME type to check
 * @returns True if supported
 */
export function isSupportedAudioType(mimeType: string): boolean {
  return (SUPPORTED_AUDIO_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Check if a filename has a supported extension
 *
 * @param filename - Filename to check
 * @returns True if extension is supported
 */
export function hasSupportedAudioExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Get list of supported audio MIME types
 *
 * @returns Array of supported MIME types
 */
export function getSupportedAudioTypes(): readonly string[] {
  return SUPPORTED_AUDIO_TYPES;
}

/**
 * Get list of supported audio file extensions
 *
 * @returns Array of supported extensions
 */
export function getSupportedAudioExtensions(): readonly string[] {
  return SUPPORTED_AUDIO_EXTENSIONS;
}

/**
 * Get maximum allowed file size
 *
 * @returns Maximum file size in bytes
 */
export function getMaxFileSize(): number {
  return MAX_FILE_SIZE;
}

/**
 * Get maximum allowed file size in MB
 *
 * @returns Maximum file size in megabytes
 */
export function getMaxFileSizeMB(): number {
  return MAX_FILE_SIZE / (1024 * 1024);
}

/**
 * Check if a file size is within limits
 *
 * @param size - File size in bytes
 * @returns True if within limits
 */
export function isValidFileSize(size: number): boolean {
  return size >= MIN_FILE_SIZE && size <= MAX_FILE_SIZE;
}

/**
 * Check if a duration is within limits
 *
 * @param duration - Duration in seconds
 * @returns True if within limits
 */
export function isValidDuration(duration: number): boolean {
  return duration >= MIN_DURATION && duration <= MAX_DURATION;
}

/**
 * Check if a string is a valid transcription status (type guard)
 *
 * @param value - Value to check
 * @returns True if valid transcription status
 */
export function isTranscriptionStatus(value: unknown): value is TranscriptionStatus {
  return transcriptionStatusSchema.safeParse(value).success;
}

/**
 * Validate a file's magic number (file signature) to ensure it's actually an audio file.
 * This catches misnamed or corrupted files before they waste API calls.
 *
 * Magic numbers are the first few bytes of a file that identify its format.
 * For example, MP3 files start with 'ID3' (0x49 0x44 0x33) or MPEG sync bytes.
 *
 * @param file - The File object to validate
 * @returns Promise resolving to validation result with detected type
 *
 * @example
 * ```typescript
 * const fileInput = document.getElementById('audio-input') as HTMLInputElement;
 * const file = fileInput.files?.[0];
 *
 * if (file) {
 *   const result = await validateFileMagicNumber(file);
 *
 *   if (!result.valid) {
 *     console.error('Invalid file:', result.error);
 *     return;
 *   }
 *
 *   console.log('Detected audio format:', result.detectedType);
 *   // Proceed with transcription...
 * }
 * ```
 */
export async function validateFileMagicNumber(
  file: File
): Promise<MagicNumberValidationResult> {
  try {
    // Read first 12 bytes for magic number checking
    // This is enough to detect all supported formats including MP4 (ftyp at offset 4)
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check each format's magic numbers
    for (const [type, signatures] of Object.entries(AUDIO_MAGIC_NUMBERS)) {
      for (const sig of signatures) {
        // Special case for MP4: check at offset 4 where 'ftyp' marker appears
        if (type === 'mp4') {
          const mp4Bytes = bytes.slice(4, 8);
          if (sig.every((b, i) => mp4Bytes[i] === b)) {
            return { valid: true, detectedType: 'mp4' };
          }
        } else {
          // Check from start of file for other formats
          if (sig.every((b, i) => bytes[i] === b)) {
            return { valid: true, detectedType: type };
          }
        }
      }
    }

    return {
      valid: false,
      detectedType: null,
      error:
        'File does not appear to be a valid audio file. Please ensure the file is not corrupted.',
    };
  } catch {
    return {
      valid: false,
      detectedType: null,
      error: 'Failed to read file for validation.',
    };
  }
}
