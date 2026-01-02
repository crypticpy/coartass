/**
 * Analysis API Route Handler
 *
 * POST endpoint that accepts transcript and template IDs and returns AI-powered analysis.
 * Uses Azure OpenAI GPT-5 (or GPT-41 for extended context) to analyze transcripts
 * based on template sections.
 *
 * Features:
 * - Multi-strategy analysis system (basic, hybrid, advanced)
 * - Automatic strategy selection based on transcript length
 * - Optional self-evaluation pass for quality improvement
 * - Template-based analysis configuration
 * - GPT-5 powered content analysis with automatic extended-context fallback
 * - Structured output (agenda items, action items, decisions, quotes)
 * - Relationship mapping between agenda, decisions, and action items
 * - Comprehensive error handling
 * - Progress tracking
 *
 * @route POST /api/analyze
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getOpenAIClient,
  OpenAIConfigError,
} from '@/lib/openai';
import { executeAnalysis, formatTranscriptWithTimestamps } from '@/lib/analysis-strategies';
import {
  estimateTokens,
  selectDeploymentByTokens,
  getDeploymentInfo,
} from '@/lib/token-utils';
import { errorResponse, successResponse } from '@/lib/api-utils';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import type {
  Analysis,
  Template,
  TranscriptSegment,
} from '@/types';

const log = createLogger('Analysis');


/**
 * Request body validation schema
 */
const analyzeRequestSchema = z.object({
  transcriptId: z.string().min(1, 'Transcript ID is required'),
  templateId: z.string().min(1, 'Template ID is required'),
  transcript: z.object({
    text: z.string().min(1, 'Transcript text is required'),
    segments: z.array(
      z.object({
        index: z.number(),
        start: z.number(),
        end: z.number(),
        text: z.string(),
        speaker: z.string().optional(),
      })
    ),
  }),
  template: z.object({
    name: z.string(),
    sections: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        prompt: z.string(),
        extractEvidence: z.boolean(),
        outputFormat: z.enum(['bullet_points', 'paragraph', 'table']),
      })
    ),
    outputs: z.array(z.enum(['summary', 'action_items', 'quotes', 'decisions'])),
  }),
  strategy: z.enum(['basic', 'hybrid', 'advanced', 'auto']).optional(),
  runEvaluation: z.boolean().optional(),
  // Supplemental material: extracted text from uploaded Word docs, PDFs, PowerPoints, or pasted text
  // Sent separately from transcript to preserve timestamp citation logic
  supplementalMaterial: z.string().optional(),
  // Note: config field reserved for future use (advanced configuration options)
  // Currently not implemented in analysis execution
});

type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;


/**
 * POST /api/analyze
 *
 * Analyzes a transcript using a specified template and GPT-5/GPT-41
 * with the new multi-strategy analysis system.
 *
 * Request Body:
 * {
 *   transcriptId: string,
 *   templateId: string,
 *   transcript: {
 *     text: string,
 *     segments: TranscriptSegment[]
 *   },
 *   template: {
 *     name: string,
 *     sections: TemplateSection[],
 *     outputs: OutputType[]
 *   },
 *   strategy?: 'basic' | 'hybrid' | 'advanced' | 'auto',  // Optional, defaults to 'auto'
 *   runEvaluation?: boolean  // Optional, defaults to true
 * }
 *
 * Response:
 * - Success (200): { success: true, data: Analysis }
 *   Analysis includes:
 *   - analysisStrategy: The strategy used ('basic', 'hybrid', or 'advanced')
 *   - results: Final analysis results (post-evaluation if runEvaluation=true)
 *   - draftResults: Pre-evaluation results (if runEvaluation=true)
 *   - evaluation: Evaluation metadata (if runEvaluation=true)
 * - Error (4xx/5xx): { success: false, error: string, details?: object }
 */
export async function POST(request: NextRequest) {
  log.debug('Received analysis request');

  if (process.env.NODE_ENV === 'production') {
    const decision = checkRateLimit(request, {
      key: 'analyze',
      windowMs: 10 * 60 * 1000,
      max: 30,
    });
    if (!decision.allowed) {
      return rateLimitResponse(decision);
    }
  }

  try {
    // Parse and validate request body first to get transcript for token estimation
    let body: AnalyzeRequest;
    try {
      const rawBody = await request.json();
      body = analyzeRequestSchema.parse(rawBody);
    } catch (error) {
      log.warn('Request validation failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof z.ZodError) {
        return errorResponse('Invalid request body', 400, {
          type: 'validation_error',
          errors: error.issues,
        });
      }
      return errorResponse('Failed to parse request body', 400);
    }

    const { transcriptId, templateId, transcript, template, strategy, runEvaluation, supplementalMaterial } = body;

    // Validate transcript has at least one segment
    if (!transcript.segments || transcript.segments.length === 0) {
      return errorResponse('Transcript has no segments', 400, {
        type: 'invalid_transcript',
        transcriptId,
      });
    }

    // Validate template has sections (check early to avoid wasted computation)
    if (!template.sections || template.sections.length === 0) {
      return errorResponse('Template has no sections to analyze', 400, {
        type: 'invalid_template',
        templateId,
      });
    }

    // Estimate tokens and select appropriate deployment
    const estimatedTokens = estimateTokens(transcript.text);
    const deploymentInfo = getDeploymentInfo(estimatedTokens);

    log.debug('Processing analysis request', {
      transcriptId,
      templateId,
      templateName: template.name,
      segmentCount: transcript.segments.length,
      transcriptLength: transcript.text.length,
      estimatedTokens: deploymentInfo.estimatedTokens,
      deployment: deploymentInfo.deployment,
      tokenLimit: deploymentInfo.tokenLimit,
      utilization: `${deploymentInfo.utilizationPercentage}%`,
      isExtendedContext: deploymentInfo.isExtended,
      sectionCount: template.sections.length,
      requestedStrategy: strategy || 'auto',
      runEvaluation: runEvaluation !== false,
      hasSupplementalMaterial: !!supplementalMaterial,
      supplementalLength: supplementalMaterial?.length || 0,
    });

    // Validate environment configuration and get model/client
    let deployment: string;
    let openaiClient;
    try {
      // Use token-based deployment selection
      deployment = selectDeploymentByTokens(estimatedTokens);
      openaiClient = getOpenAIClient();
    } catch (error) {
      if (error instanceof OpenAIConfigError) {
        log.error('Configuration error', { message: error.message });
        return errorResponse(
          'Server configuration error. GPT API is not properly configured.',
          500,
          {
            type: 'configuration_error',
            message: error.message,
          }
        );
      }
      throw error;
    }

    // Format transcript with timestamp markers for accurate timestamp extraction
    // This enables the LLM to provide precise timestamps for action items, decisions, and quotes
    const timestampedTranscript = formatTranscriptWithTimestamps(
      transcript.segments as TranscriptSegment[]
    );

    log.debug('Formatted transcript with timestamps', {
      originalLength: transcript.text.length,
      timestampedLength: timestampedTranscript.length,
      segmentCount: transcript.segments.length,
    });

    // Execute the unified analysis
    let result;
    try {
      result = await executeAnalysis(
        template as Template,
        timestampedTranscript,
        openaiClient,
        deployment,
        {
          strategy: strategy || 'auto',
          runEvaluation: runEvaluation !== false, // Default to true
          progressCallback: (current, total, message) => {
            log.debug(`Progress: ${current}/${total} - ${message}`);
          },
          segments: transcript.segments as TranscriptSegment[],
          // Supplemental material from uploaded docs (Word, PDF, PPT) or pasted text
          // This is passed separately to prompts to preserve transcript timestamp citation logic
          supplementalMaterial,
        }
      );
    } catch (error) {
      log.error('Analysis execution failed', {
        message: error instanceof Error ? error.message : String(error),
      });

      // Build error details - only include stack trace in development
      const errorDetails: Record<string, unknown> = {
        type: 'analysis_error',
      };

      if (process.env.NODE_ENV === 'development' && error instanceof Error) {
        errorDetails.details = error.stack;
      }

      return errorResponse(
        error instanceof Error ? error.message : 'Analysis execution failed',
        500,
        errorDetails
      );
    }

    // Create analysis record with new fields
    const analysis: Analysis = {
      id: crypto.randomUUID(),
      transcriptId,
      templateId,
      analysisStrategy: result.strategy,
      draftResults: result.draftResults,
      evaluation: result.evaluation,
      results: result.results,
      metadata: result.metadata,
      createdAt: new Date(),
    };

    log.info('Analysis completed successfully', {
      id: analysis.id,
      strategy: result.strategy,
      wasAutoSelected: result.metadata.wasAutoSelected,
      sectionsAnalyzed: result.results.sections.length,
      hasSummary: !!result.results.summary,
      agendaItemCount: result.results.agendaItems?.length || 0,
      actionItemCount: result.results.actionItems?.length || 0,
      decisionCount: result.results.decisions?.length || 0,
      quoteCount: result.results.quotes?.length || 0,
      hadEvaluation: !!result.evaluation,
      qualityScore: result.evaluation?.qualityScore,
    });

    return successResponse(analysis);
  } catch (error) {
    // Catch-all for unexpected errors
    log.error('Unexpected error', {
      message: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof z.ZodError) {
      return errorResponse('Validation error', 400, {
        type: 'validation_error',
        errors: error.issues,
      });
    }

    return errorResponse(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
}

/**
 * GET /api/analyze
 *
 * Returns API information and usage instructions.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      endpoint: '/api/analyze',
      method: 'POST',
      description: 'AI-powered transcript analysis using GPT-5 with multi-strategy system',
      requestBody: {
        transcriptId: 'string (required)',
        templateId: 'string (required)',
        transcript: {
          text: 'string (required)',
          segments: 'TranscriptSegment[] (required)',
        },
        template: {
          name: 'string (required)',
          sections: 'TemplateSection[] (required)',
          outputs: 'OutputType[] (required)',
        },
        strategy: 'string (optional, default: "auto", values: "basic" | "hybrid" | "advanced" | "auto")',
        runEvaluation: 'boolean (optional, default: true)',
      },
      strategies: {
        basic: {
          description: 'Fast single-pass analysis (2-4 min)',
          bestFor: 'Short meetings, quick overviews',
          apiCalls: '1 call',
        },
        hybrid: {
          description: 'Balanced batched analysis (4-6 min)',
          bestFor: 'Medium meetings, good quality/speed balance',
          apiCalls: '3 calls',
        },
        advanced: {
          description: 'Deep contextual cascading (6-8 min)',
          bestFor: 'Long meetings, maximum quality',
          apiCalls: '9-10 calls',
        },
        auto: {
          description: 'Automatically selects strategy based on transcript length',
          bestFor: 'Recommended for most use cases',
        },
      },
      features: [
        'Multi-strategy analysis system (basic, hybrid, advanced)',
        'Automatic strategy selection based on transcript length',
        'Self-evaluation pass for quality improvement',
        'Template-based analysis configuration',
        'GPT-5 powered content analysis',
        'Agenda item extraction with relationship mapping',
        'Action item extraction linked to decisions',
        'Decision extraction linked to agenda items',
        'Notable quote extraction',
        'Comprehensive error handling',
        'Progress tracking',
      ],
      usage: {
        description: 'Send transcript and template for AI analysis',
        example: 'POST /api/analyze with JSON body containing transcript and template data',
      },
    },
  });
}
