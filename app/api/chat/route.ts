/**
 * Chat API Route Handler
 *
 * POST endpoint for Q&A chat with transcripts using OpenAI GPT models.
 *
 * CRITICAL: This endpoint is STATELESS - it stores NOTHING on the server.
 * All conversation data is managed client-side in browser IndexedDB.
 *
 * Privacy Model:
 * - Receives transcript text + question in each request
 * - Calls OpenAI API with context
 * - Returns answer immediately
 * - NO server-side storage or logging of conversations
 * - All persistence handled by client
 *
 * Features:
 * - GPT-5/GPT-41 powered Q&A
 * - Automatic deployment selection based on transcript size
 * - Conversation history support for multi-turn context
 * - Token limit validation
 * - Comprehensive error handling
 *
 * @route POST /api/chat
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getOpenAIClient,
  OpenAIConfigError,
} from '@/lib/openai';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  estimateTokens,
  selectDeploymentByTokens,
  getDeploymentInfo,
} from '@/lib/token-utils';
import { createLogger } from '@/lib/logger';

const log = createLogger('Chat');
/**
 * API-specific message type with string timestamp (JSON serializable).
 * Different from ChatMessage which uses Date objects for client-side storage.
 */
interface ApiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO 8601 string from JSON
}

/**
 * Maximum tokens to reserve for system prompt, question, and response overhead.
 * This ensures we don't exceed the model's context window.
 */
const OVERHEAD_TOKEN_RESERVE = 10000;

/**
 * Maximum tokens allowed in conversation history.
 * Limits total context size to prevent token overflow.
 */
const MAX_HISTORY_TOKENS = 20000;

/**
 * Request body validation schema
 */
const chatRequestSchema = z.object({
  transcriptId: z.string().min(1, 'Transcript ID is required'),
  transcriptText: z.string()
    .min(1, 'Transcript text is required')
    .max(4000000, 'Transcript text is too large (max 4M characters)'),
  question: z.string()
    .min(1, 'Question is required')
    .max(2000, 'Question is too long (max 2000 characters)'),
  conversationHistory: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      timestamp: z.string().datetime(), // ISO 8601 datetime string from JSON.stringify
    })
  ).optional(),
});

type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * Error response helper with custom error structure for chat endpoint
 */
function chatErrorResponse(
  type: 'validation' | 'token_limit' | 'api_failure' | 'unknown',
  message: string,
  status: number,
  details?: Record<string, unknown>,
  headers?: HeadersInit
) {
  const errorBody: Record<string, unknown> = {
    success: false,
    error: {
      type,
      message,
      details,
    },
  };

  return NextResponse.json(errorBody, { status, headers });
}

/**
 * Success response helper with custom structure for chat endpoint
 */
function chatSuccessResponse(answer: string, model: string) {
  return NextResponse.json(
    {
      success: true,
      data: {
        answer,
        model,
      },
    },
    { status: 200 }
  );
}

/**
 * Build the system prompt with transcript context
 */
function buildSystemPrompt(transcriptText: string): string {
  return `You are analyzing a meeting transcript. Answer questions based ONLY on the transcript content provided. If the answer is not in the transcript, say "I don't have that information in this transcript."

Transcript:
${transcriptText}

Instructions:
- Answer concisely and accurately
- Cite specific parts of the transcript when relevant
- Maintain conversation context from previous questions
- If asked about something not in the transcript, be honest about it
- Format your responses in a clear, readable manner`;
}

/**
 * Estimate total tokens for the request
 */
function estimateTotalTokens(
  transcriptText: string,
  question: string,
  conversationHistory: ApiChatMessage[] = []
): {
  transcriptTokens: number;
  questionTokens: number;
  historyTokens: number;
  systemPromptTokens: number;
  totalTokens: number;
} {
  const transcriptTokens = estimateTokens(transcriptText);
  const questionTokens = estimateTokens(question);

  // Estimate conversation history tokens
  const historyTokens = conversationHistory.reduce((sum, msg) => {
    return sum + estimateTokens(msg.content);
  }, 0);

  // System prompt overhead (base + transcript)
  const systemPromptTokens = 200 + transcriptTokens;

  const totalTokens = systemPromptTokens + historyTokens + questionTokens + OVERHEAD_TOKEN_RESERVE;

  return {
    transcriptTokens,
    questionTokens,
    historyTokens,
    systemPromptTokens,
    totalTokens,
  };
}

/**
 * Truncate conversation history to fit within token limits
 */
function truncateHistory(
  conversationHistory: ApiChatMessage[],
  maxTokens: number
): ApiChatMessage[] {
  if (conversationHistory.length === 0) {
    return [];
  }

  let totalTokens = 0;
  const truncated: ApiChatMessage[] = [];

  // Include most recent messages first (reverse iteration)
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    const msgTokens = estimateTokens(msg.content);

    if (totalTokens + msgTokens > maxTokens) {
      break;
    }

    totalTokens += msgTokens;
    truncated.unshift(msg); // Add to beginning to maintain chronological order
  }

  if (truncated.length < conversationHistory.length) {
    log.debug('Truncated conversation history', {
      from: conversationHistory.length,
      to: truncated.length,
      maxTokens,
    });
  }

  return truncated;
}

/**
 * POST /api/chat
 *
 * Answers questions about a transcript using GPT-5/GPT-41.
 * This endpoint is STATELESS - all context is provided in each request.
 *
 * Request Body:
 * {
 *   transcriptId: string (UUID),
 *   transcriptText: string,
 *   question: string,
 *   conversationHistory?: ChatMessage[]
 * }
 *
 * Response:
 * - Success (200): { success: true, data: { answer: string } }
 * - Error (4xx/5xx): { success: false, error: { type, message, details? } }
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const decision = checkRateLimit(request, {
      key: 'chat',
      windowMs: 10 * 60 * 1000,
      max: 60,
    });
    if (!decision.allowed) {
      const headers: Record<string, string> = {
        'X-RateLimit-Limit': String(decision.limit),
        'X-RateLimit-Remaining': String(decision.remaining),
        'X-RateLimit-Reset': String(Math.floor(decision.resetAt / 1000)),
      };
      if (decision.retryAfterSeconds) {
        headers['Retry-After'] = String(decision.retryAfterSeconds);
      }

      return chatErrorResponse(
        'api_failure',
        'Too many requests. Please wait and try again.',
        429,
        {
          type: 'rate_limited',
          limit: decision.limit,
          resetAt: decision.resetAt,
        },
        headers
      );
    }
  }

  log.debug('Received chat request');

  try {
    // Parse and validate request body
    let body: ChatRequest;
    try {
      const rawBody = await request.json();
      body = chatRequestSchema.parse(rawBody);
    } catch (error) {
      log.warn('Request validation failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof z.ZodError) {
        return chatErrorResponse(
          'validation',
          'Invalid request body',
          400,
          {
            errors: error.issues,
          }
        );
      }
      return chatErrorResponse('validation', 'Failed to parse request body', 400);
    }

    const { transcriptId, transcriptText, question, conversationHistory = [] } = body;

    // Estimate tokens
    const tokenEstimate = estimateTotalTokens(transcriptText, question, conversationHistory);
    const deploymentInfo = getDeploymentInfo(tokenEstimate.transcriptTokens);

    log.debug('Processing chat request', {
      transcriptId,
      questionLength: question.length,
      transcriptLength: transcriptText.length,
      historyMessageCount: conversationHistory.length,
      tokenEstimate: {
        transcript: tokenEstimate.transcriptTokens,
        question: tokenEstimate.questionTokens,
        history: tokenEstimate.historyTokens,
        total: tokenEstimate.totalTokens,
      },
      deployment: deploymentInfo.deployment,
      tokenLimit: deploymentInfo.tokenLimit,
      utilizationPercentage: deploymentInfo.utilizationPercentage,
    });

    // Check if we're approaching token limits
    if (tokenEstimate.totalTokens > deploymentInfo.tokenLimit) {
      log.warn('Token limit exceeded', {
        totalTokens: tokenEstimate.totalTokens,
        tokenLimit: deploymentInfo.tokenLimit,
        utilizationPercentage: Math.round((tokenEstimate.totalTokens / deploymentInfo.tokenLimit) * 100),
      });

      return chatErrorResponse(
        'token_limit',
        'Transcript and conversation history are too large for Q&A. Consider clearing the conversation history or using a shorter transcript.',
        400,
        {
          totalTokens: tokenEstimate.totalTokens,
          tokenLimit: deploymentInfo.tokenLimit,
          transcriptTokens: tokenEstimate.transcriptTokens,
          historyTokens: tokenEstimate.historyTokens,
        }
      );
    }

    // Truncate history if needed to stay within limits
    let truncatedHistory = conversationHistory;
    if (tokenEstimate.historyTokens > MAX_HISTORY_TOKENS) {
      truncatedHistory = truncateHistory(conversationHistory, MAX_HISTORY_TOKENS);
    }

    // Get OpenAI client and deployment
    let deployment: string;
    let openaiClient;
    try {
      deployment = selectDeploymentByTokens(tokenEstimate.transcriptTokens);
      openaiClient = getOpenAIClient();
    } catch (error) {
      if (error instanceof OpenAIConfigError) {
        log.error('Configuration error', { message: error.message });
        return chatErrorResponse(
          'api_failure',
          'Server configuration error. Chat API is not properly configured.',
          500,
          {
            message: error.message,
          }
        );
      }
      throw error;
    }

    // Build messages array for OpenAI
    const systemPrompt = buildSystemPrompt(transcriptText);
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];

    // Add conversation history for context
    for (const msg of truncatedHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current question
    messages.push({
      role: 'user',
      content: question,
    });

    log.debug('Calling OpenAI API', {
      deployment,
      messageCount: messages.length,
      model: deployment,
    });

    // Call OpenAI API
    let completion;
    try {
      completion = await openaiClient.chat.completions.create({
        model: deployment,
        messages,
        max_completion_tokens: 32000, // GPT-5 is a reasoning model - needs tokens for reasoning + response
        // Note: GPT-5 does not support custom temperature values (only default 1.0)
      });
    } catch (error) {
      log.error('OpenAI API call failed', {
        message: error instanceof Error ? error.message : String(error),
      });

      // Check for specific error types
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();

        // Token limit errors - be more specific to avoid false positives
        if (errorMsg.includes('maximum context length') ||
            errorMsg.includes('context_length_exceeded') ||
            errorMsg.includes('too many tokens')) {
          return chatErrorResponse(
            'token_limit',
            'The conversation is too long for the model. Try clearing the conversation history.',
            400,
            {
              apiError: error.message,
              estimatedTokens: tokenEstimate.totalTokens,
              tokenLimit: deploymentInfo.tokenLimit,
            }
          );
        }

        // Rate limit errors
        if (error.message.includes('rate limit') || error.message.includes('quota')) {
          return chatErrorResponse(
            'api_failure',
            'API rate limit exceeded. Please try again in a moment.',
            429,
            {
              apiError: error.message,
            }
          );
        }
      }

      return chatErrorResponse(
        'api_failure',
        'Failed to get response from AI. Please try again.',
        502,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    // Extract answer from completion
    const answer = completion.choices[0]?.message?.content;

    if (!answer) {
      log.error('No answer in OpenAI response');
      return chatErrorResponse(
        'api_failure',
        'Received empty response from AI. Please try again.',
        502
      );
    }

    log.debug('Chat completed successfully', {
      transcriptId,
      answerLength: answer.length,
      tokensUsed: completion.usage?.total_tokens,
      model: deployment,
    });

    return chatSuccessResponse(answer, deployment);
  } catch (error) {
    // Catch-all for unexpected errors
    log.error('Unexpected error', {
      message: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof z.ZodError) {
      return chatErrorResponse(
        'validation',
        'Validation error',
        400,
        {
          errors: error.issues,
        }
      );
    }

    return chatErrorResponse(
      'unknown',
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
}

/**
 * GET /api/chat
 *
 * Returns API information and usage instructions.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      endpoint: '/api/chat',
      method: 'POST',
      description: 'Q&A chat with transcripts using OpenAI GPT models (STATELESS endpoint)',
      privacyModel: {
        storage: 'CLIENT-SIDE ONLY (browser IndexedDB)',
        serverStorage: 'NONE - endpoint is completely stateless',
        dataRetention: 'No conversation data stored on server',
      },
      requestBody: {
        transcriptId: 'string (UUID, required)',
        transcriptText: 'string (required, max 4M chars)',
        question: 'string (required, max 2000 chars)',
        conversationHistory: 'ChatMessage[] (optional, for context)',
      },
      responseFormat: {
        success: '{ success: true, data: { answer: string } }',
        error: '{ success: false, error: { type, message, details? } }',
      },
      features: [
        'GPT-5/GPT-41 powered Q&A',
        'Automatic deployment selection based on transcript size',
        'Multi-turn conversation support',
        'Token limit validation and truncation',
        'Completely stateless (no server-side storage)',
        'Privacy-first design (all data stored client-side)',
      ],
      errorTypes: {
        validation: 'Invalid request format or parameters',
        token_limit: 'Transcript or conversation too large',
        api_failure: 'OpenAI API error or rate limit',
        unknown: 'Unexpected server error',
      },
      usage: {
        description: 'Send transcript and question to get AI-powered answers',
        example: 'POST /api/chat with JSON body containing transcript and question',
      },
    },
  });
}
