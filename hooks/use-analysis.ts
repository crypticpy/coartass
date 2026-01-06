/**
 * Analysis Hook
 *
 * Custom React hook for creating and managing transcript analyses.
 * Provides state management, API calls, and IndexedDB persistence.
 *
 * STRATEGY ALIGNMENT NOTE:
 * Strategy selection is handled EXCLUSIVELY by the API endpoint (lib/analysis-strategies/index.ts).
 * The API uses token-based thresholds via recommendStrategy() to determine the optimal strategy.
 * This hook does NOT attempt to pre-determine the strategy - instead, it:
 * 1. Shows "Determining optimal strategy..." during initial progress
 * 2. Updates resolvedStrategy once the API responds with the actual strategy used
 * 3. Adjusts progress display based on the confirmed strategy
 *
 * This ensures the UI accurately reflects what the API is actually doing.
 */

'use client';

import { useState, useCallback } from 'react';
import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Analysis, AnalysisProgress } from '@/types/analysis';
import type { Transcript } from '@/types/transcript';
import type { Template } from '@/types/template';
import type { AnalysisStrategy } from '@/lib/analysis-strategy';
import { normalizeEvidence } from '@/lib/analysis-utils';
import { createLogger } from '@/lib/logger';
import {
  saveAnalysis,
  getAnalysisByTranscript,
  getAnalysesPaginated,
  type PaginationOptions,
  type PaginatedResult
} from '@/lib/db';
import {
  calculateEstimatedTime,
  getStrategyPhases,
  calculatePhaseProgress,
} from '@/lib/analysis-progress-metadata';
import {
  getAnalysisModelPreference,
  getReasoningEffortPreference,
} from '@/lib/storage';

const log = createLogger('useAnalysis');

/**
 * Analysis state interface
 */
export interface AnalysisState {
  /** Current analysis being created/viewed */
  analysis: Analysis | null;

  /** All analyses for a transcript */
  analyses: Analysis[];

  /** Loading state */
  loading: boolean;

  /** Error message if analysis failed */
  error: string | null;

  /** Progress information during analysis creation */
  progress: AnalysisProgress | null;

  /** Abort controller for cancelling in-progress analysis */
  abortController: AbortController | null;

  /** Resolved strategy being used (after 'auto' resolution) */
  resolvedStrategy: AnalysisStrategy | null;
}

/**
 * Hook return interface
 */
export interface UseAnalysisReturn {
  /** Current state */
  state: AnalysisState;

  /** Create a new analysis for a transcript */
  analyzeTranscript: (
    transcript: Transcript,
    template: Template,
    strategy?: AnalysisStrategy | 'auto',
    runEvaluation?: boolean,
    supplementalMaterial?: string
  ) => Promise<Analysis | null>;

  /** Fetch all analyses for a transcript */
  fetchAnalyses: (transcriptId: string, signal?: AbortSignal) => Promise<Analysis[]>;

  /** Cancel an in-progress analysis */
  cancelAnalysis: () => void;

  /** Clear current analysis and error state */
  clearAnalysis: () => void;

  /** Reset all state */
  reset: () => void;
}

/**
 * Initial state
 */
const initialState: AnalysisState = {
  analysis: null,
  analyses: [],
  loading: false,
  error: null,
  progress: null,
  abortController: null,
  resolvedStrategy: null,
};

/**
 * Custom hook for managing transcript analysis operations
 *
 * @returns Analysis state and operations
 *
 * @example
 * ```tsx
 * function AnalysisPage() {
 *   const { state, analyzeTranscript } = useAnalysis();
 *
 *   const handleAnalyze = async () => {
 *     const analysis = await analyzeTranscript(transcript, template);
 *     if (analysis) {
 *       console.log('Analysis complete:', analysis);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {state.loading && <p>Analyzing: {state.progress?.message}</p>}
 *       {state.error && <p>Error: {state.error}</p>}
 *       {state.analysis && <AnalysisViewer analysis={state.analysis} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAnalysis(): UseAnalysisReturn {
  const [state, setState] = useState<AnalysisState>(initialState);

  /**
   * Update progress during analysis
   */
  const updateProgress = useCallback((progress: AnalysisProgress) => {
    setState((prev) => ({ ...prev, progress }));
  }, []);

  /**
   * Fetch all analyses for a transcript from IndexedDB
   * RACE CONDITION FIX: Added cancellation support for async operation
   */
  const fetchAnalyses = useCallback(async (
    transcriptId: string,
    signal?: AbortSignal
  ): Promise<Analysis[]> => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      // Check if cancelled before async operation
      if (signal?.aborted) {
        return [];
      }

      const analyses = await getAnalysisByTranscript(transcriptId);

      // Check if cancelled after async operation
      if (signal?.aborted) {
        return [];
      }

      setState((prev) => ({ ...prev, analyses, loading: false }));
      return analyses;
    } catch (error) {
      // Don't update state if operation was cancelled
      if (signal?.aborted) {
        return [];
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch analyses';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
      return [];
    }
  }, []);

  /**
   * Analyze a transcript using the specified template
   *
   * This function:
   * 1. Calls the analysis API endpoint
   * 2. Tracks progress during analysis with simulated updates
   * 3. Saves the completed analysis to IndexedDB
   * 4. Returns the analysis object
   * 5. Supports cancellation via AbortController
   *
   * @param transcript - The transcript to analyze
   * @param template - The analysis template to use
   * @param strategy - Analysis strategy ('basic' | 'hybrid' | 'advanced' | 'auto'). Defaults to 'auto'
   * @param runEvaluation - Whether to run evaluation on the analysis. Defaults to true
   * @param supplementalMaterial - Optional extracted text from uploaded documents (Word, PDF, etc.)
   */
  const analyzeTranscript = useCallback(
    async (
      transcript: Transcript,
      template: Template,
      strategy?: AnalysisStrategy | 'auto',
      runEvaluation?: boolean,
      supplementalMaterial?: string
    ): Promise<Analysis | null> => {
      // Guard against concurrent analyses
      if (state.loading) {
        log.warn('Analysis already in progress');
        return null;
      }

      // Create abort controller for cancellation
      const abortController = new AbortController();
      let progressInterval: NodeJS.Timeout | null = null;

      try {
        // STRATEGY ALIGNMENT FIX:
        // Do NOT pre-determine strategy here. The API uses token-based thresholds
        // (via recommendStrategy in lib/analysis-strategy.ts) which may differ from
        // section-count based heuristics. Let the API be the single source of truth.
        //
        // If user explicitly specified a strategy (not 'auto'), we know what they want.
        // Otherwise, show "determining..." until API confirms the actual strategy.
        const userSpecifiedStrategy: AnalysisStrategy | null =
          strategy && strategy !== 'auto' ? strategy : null;

        setState((prev) => ({
          ...prev,
          loading: true,
          error: null,
          abortController, // Store controller in state for cancel button
          // Only set resolvedStrategy if user explicitly chose one; otherwise null until API confirms
          resolvedStrategy: userSpecifiedStrategy,
          progress: {
            progress: 0,
            message: userSpecifiedStrategy
              ? `Preparing ${userSpecifiedStrategy} analysis...`
              : 'Determining optimal analysis strategy...',
            complete: false,
            currentSection: 'Initializing',
          },
        }));

        // Get strategy-specific phases and time estimate
        const sectionCount = Math.max(1, template.sections.length);
        const runEval = runEvaluation !== false;

        // If user specified a strategy, we can show strategy-specific progress.
        // Otherwise, show generic progress until API responds with the actual strategy.
        if (userSpecifiedStrategy && userSpecifiedStrategy !== 'basic') {
          // User explicitly chose hybrid/advanced - show their expected progress
          const phases = getStrategyPhases(userSpecifiedStrategy, template, runEval);
          const totalEstimatedTime = calculateEstimatedTime(
            userSpecifiedStrategy,
            sectionCount,
            runEval
          );

          // Track elapsed time and current phase
          const startTime = Date.now();

          // Start strategy-aware progress updates
          progressInterval = setInterval(() => {
            const elapsedSeconds = (Date.now() - startTime) / 1000;

            // Calculate progress and current phase
            const { progress: baseProgress, phase } = calculatePhaseProgress(
              elapsedSeconds,
              totalEstimatedTime,
              phases
            );

            // Asymptotic progress:
            // - Use calculated progress up to 75%
            // - After 75%, continue slowly toward 88% (never reaches 90% until API responds)
            let progress: number;
            let isOvertime = false;

            if (baseProgress < 75) {
              progress = baseProgress;
            } else {
              isOvertime = elapsedSeconds > totalEstimatedTime;
              if (isOvertime) {
                // Overtime: asymptotically approach 88%
                const overtime = elapsedSeconds - totalEstimatedTime;
                const additionalProgress = 13 * (1 - Math.exp(-overtime / 60));
                progress = 75 + additionalProgress;
              } else {
                progress = 75;
              }
            }

            // Determine message
            let message = phase?.message || 'Processing...';
            let currentSection = phase?.name || 'Processing';

            if (isOvertime) {
              const minutes = Math.floor(elapsedSeconds / 60);
              const seconds = Math.floor(elapsedSeconds % 60);
              const timeStr = minutes > 0
                ? `${minutes}m ${seconds}s`
                : `${seconds}s`;
              message = `Still processing... (${timeStr} elapsed)`;
              currentSection = 'Processing';
            }

            updateProgress({
              progress: Math.floor(progress),
              message,
              complete: false,
              currentSection,
            });
          }, 2000); // Update every 2 seconds

          // Initial progress update for user-specified hybrid/advanced
          const initialPhase = phases[0];
          updateProgress({
            progress: 5,
            message: initialPhase?.message || `Starting ${userSpecifiedStrategy} analysis...`,
            complete: false,
            currentSection: initialPhase?.name || 'Initializing',
          });
        } else if (userSpecifiedStrategy === 'basic') {
          // User explicitly chose basic - add progress updates for extraction + enrichment
          // GPT-5.2 update: Basic now takes 2-4 min (~180s avg)
          const startTime = Date.now();
          const estimatedTimeSeconds = 180; // Basic + enrichment with GPT-5.2

          progressInterval = setInterval(() => {
            const elapsedSeconds = (Date.now() - startTime) / 1000;

            // Asymptotic progress formula:
            // - Linear from 5% to 75% during estimated time
            // - Continues slowly from 75% toward 88% after estimate (never reaches 90% until API responds)
            let progress: number;
            let isOvertime = false;

            if (elapsedSeconds <= estimatedTimeSeconds) {
              // Normal linear progression
              progress = 5 + (70 * elapsedSeconds / estimatedTimeSeconds);
            } else {
              // Overtime: asymptotically approach 88%
              // Formula: 75 + 13 * (1 - e^(-overtime/120))
              // Slower asymptote for longer processing times
              isOvertime = true;
              const overtime = elapsedSeconds - estimatedTimeSeconds;
              const additionalProgress = 13 * (1 - Math.exp(-overtime / 120));
              progress = 75 + additionalProgress;
            }

            let message = 'Processing with basic analysis...';
            let currentSection = 'Extraction';

            // Adjusted breakpoints for GPT-5.2 timing (60s, 120s instead of 15s, 30s)
            if (elapsedSeconds > 60) {
              message = 'Running enrichment pass...';
              currentSection = 'Enrichment';
            }
            if (elapsedSeconds > 120) {
              message = 'Finalizing results...';
              currentSection = 'Finalizing';
            }

            // When over estimated time, show elapsed time to indicate it's still working
            if (isOvertime) {
              const minutes = Math.floor(elapsedSeconds / 60);
              const seconds = Math.floor(elapsedSeconds % 60);
              const timeStr = minutes > 0
                ? `${minutes}m ${seconds}s`
                : `${seconds}s`;
              message = `Still processing... (${timeStr} elapsed)`;
              currentSection = 'Processing';
            }

            updateProgress({
              progress: Math.floor(progress),
              message,
              complete: false,
              currentSection,
            });
          }, 2000);

          updateProgress({
            progress: 5,
            message: 'Processing with basic analysis...',
            complete: false,
            currentSection: 'Extraction',
          });
        } else {
          // Auto mode: Show generic progress with periodic updates until API responds
          // The API will determine the actual strategy based on token count
          // GPT-5.2 update: Strategy selection phase extended
          const startTime = Date.now();
          const estimatedStrategySelectionTime = 30; // ~30 seconds for strategy determination

          progressInterval = setInterval(() => {
            const elapsedSeconds = (Date.now() - startTime) / 1000;

            // Asymptotic progress for auto mode:
            // - Linear to 40% during strategy selection phase (~30s)
            // - Then asymptotically approach 75% as we wait for API
            let progress: number;
            let isOvertime = false;

            if (elapsedSeconds <= estimatedStrategySelectionTime) {
              // Strategy selection phase: 5% to 40%
              progress = 5 + (35 * elapsedSeconds / estimatedStrategySelectionTime);
            } else {
              // Waiting for API: asymptotically approach 75%
              isOvertime = true;
              const overtime = elapsedSeconds - estimatedStrategySelectionTime;
              // 40 + 35 * (1 - e^(-overtime/120)) approaches 75% (slower for GPT-5.2)
              const additionalProgress = 35 * (1 - Math.exp(-overtime / 120));
              progress = 40 + additionalProgress;
            }

            let message: string;
            let currentSection: string;

            if (isOvertime) {
              const minutes = Math.floor(elapsedSeconds / 60);
              const seconds = Math.floor(elapsedSeconds % 60);
              const timeStr = minutes > 0
                ? `${minutes}m ${seconds}s`
                : `${seconds}s`;
              message = `Processing analysis... (${timeStr} elapsed)`;
              currentSection = 'Processing';
            } else if (progress < 20) {
              message = 'Analyzing transcript complexity...';
              currentSection = 'Strategy Selection';
            } else {
              message = 'Selecting optimal analysis strategy...';
              currentSection = 'Strategy Selection';
            }

            updateProgress({
              progress: Math.floor(progress),
              message,
              complete: false,
              currentSection,
            });
          }, 2000);

          updateProgress({
            progress: 5,
            message: 'Analyzing transcript complexity...',
            complete: false,
            currentSection: 'Strategy Selection',
          });
        }

        // Get user preferences for model and reasoning effort
        const modelOverride = getAnalysisModelPreference();
        const reasoningEffort = getReasoningEffortPreference();

        log.debug('Using analysis settings', { modelOverride, reasoningEffort });

        // Call the analysis API endpoint with abort signal
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transcriptId: transcript.id,
            templateId: template.id,
            transcript: {
              text: transcript.text,
              segments: transcript.segments,
            },
            template: template,
            strategy: strategy || 'auto',
            runEvaluation: runEvaluation !== false,
            // Include supplemental material if provided (from uploaded Word, PDF, PPT, or pasted text)
            ...(supplementalMaterial && { supplementalMaterial }),
            // User-configurable model and reasoning settings from Settings
            modelOverride,
            reasoningEffort,
          }),
          signal: abortController.signal,
        });

        // Clear progress interval once API responds
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Analysis failed with status ${response.status}`
          );
        }

        const responseData = await response.json();

        // STRATEGY ALIGNMENT: Extract the actual strategy used by the API
        // The API returns analysisStrategy in the response data
        const actualStrategy: AnalysisStrategy =
          responseData.data?.analysisStrategy ||
          responseData.analysisStrategy ||
          userSpecifiedStrategy ||
          'basic';

        // Update resolvedStrategy state to reflect what the API actually used
        // This is the single source of truth for strategy after API responds
        setState((prev) => ({
          ...prev,
          resolvedStrategy: actualStrategy,
        }));

        // Show evaluation phase if enabled, using ACTUAL strategy from API
        if (runEval) {
          updateProgress({
            progress: 78,
            message: 'Running quality review and self-evaluation...',
            complete: false,
            currentSection: 'Quality Review',
          });
        } else {
          updateProgress({
            progress: 80,
            message: 'Processing analysis results...',
            complete: false,
            currentSection: 'Finalizing',
          });
        }

        // The API returns the full Analysis object in responseData.data
        const analysis: Analysis = responseData.data
          ? {
              ...responseData.data,
              // Ensure createdAt is a Date object
              createdAt: responseData.data.createdAt
                ? new Date(responseData.data.createdAt)
                : new Date(),
            }
          : {
              id: responseData.id || uuidv4(),
              transcriptId: transcript.id,
              templateId: template.id,
              results: responseData.results || responseData,
              createdAt: responseData.createdAt
                ? new Date(responseData.createdAt)
                : new Date(),
            };

        updateProgress({
          progress: 90,
          message: 'Saving analysis...',
          complete: false,
          currentSection: 'Saving',
        });

        // Save to IndexedDB
        await saveAnalysis(analysis);

        // LLM-powered citations pass (Advanced only).
        // This generates "View Supporting Evidence" using a small model (e.g. gpt-4.1-mini).
        let finalAnalysis: Analysis = analysis;
        let citationsAborted = false;
        if (actualStrategy === 'advanced') {
          try {
            const citationsEnabled = process.env.NEXT_PUBLIC_CITATIONS_ENABLED !== 'false';
            if (citationsEnabled) {
              updateProgress({
                progress: 95,
                message: 'Selecting supporting evidence...',
                complete: false,
                currentSection: 'Citations',
              });

              const citationsResponse = await fetch('/api/citations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  transcript: { segments: transcript.segments },
                  templateSections: template.sections,
                  sections: analysis.results.sections.map((s) => ({
                    name: s.name,
                    content: s.content,
                  })),
                  maxEvidencePerSection: 3,
                }),
                signal: abortController.signal,
              });

              if (citationsResponse.ok) {
                const citationsData = await citationsResponse.json();
                const evidenceByName = new Map<string, unknown>(
                  (citationsData?.data?.sections || []).map((s: { name: string; evidence: unknown }) => [
                    s.name,
                    s.evidence,
                  ])
                );

                const mergedSections = finalAnalysis.results.sections.map((section) => {
                  const llmEvidence = evidenceByName.get(section.name);
                  const normalized = normalizeEvidence(llmEvidence);
                  if (normalized.length > 0) {
                    return { ...section, evidence: normalized };
                  }
                  return section;
                });

                finalAnalysis = {
                  ...finalAnalysis,
                  results: {
                    ...finalAnalysis.results,
                    sections: mergedSections,
                  },
                };

                // Persist the refined evidence.
                await saveAnalysis(finalAnalysis);
              } else {
                log.warn('Citations generation failed', { status: citationsResponse.status });
              }
            }
          } catch (error) {
            // If citations fail (or are cancelled), keep the analysis without supporting evidence.
            if (error instanceof Error && error.name === 'AbortError') {
              citationsAborted = true;
              log.info('Supporting evidence selection cancelled');
            } else {
              log.warn('Failed to generate supporting evidence', {
                message: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }

        const completionMessage =
          citationsAborted
            ? 'Analysis complete (supporting evidence skipped)'
            : 'Analysis complete!';

        updateProgress({
          progress: 100,
          message: completionMessage,
          complete: true,
          currentSection: 'Complete',
        });

        setState((prev) => ({
          ...prev,
          analysis: finalAnalysis,
          analyses: [...prev.analyses, finalAnalysis],
          loading: false,
          abortController: null,
          // Keep resolvedStrategy set to actualStrategy (already set above)
          progress: {
            progress: 100,
            message: completionMessage,
            complete: true,
            currentSection: 'Complete',
          },
        }));

        return finalAnalysis;
      } catch (error) {
        // Check if error was due to cancellation
        if (error instanceof Error && error.name === 'AbortError') {
          log.info('Analysis cancelled by user');
          setState((prev) => ({
            ...prev,
            loading: false,
            error: 'Analysis cancelled',
            abortController: null,
            progress: {
              progress: 0,
              message: 'Analysis cancelled',
              complete: false,
              error: 'Analysis cancelled',
            },
          }));
          return null;
        }

        log.error('Analysis error', {
          message: error instanceof Error ? error.message : String(error),
        });
        const errorMessage = error instanceof Error ? error.message : 'Analysis failed';

        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
          abortController: null,
          progress: {
            progress: 0,
            message: errorMessage,
            complete: false,
            error: errorMessage,
          },
        }));

        return null;
      } finally {
        // CRITICAL: Always clear interval in finally block to prevent memory leaks
        if (progressInterval) {
          clearInterval(progressInterval);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally omitting state.loading to prevent callback recreation during analysis
    [updateProgress]
  );

  /**
   * Cancel an in-progress analysis
   * Uses setState callback to avoid stale closure issues
   */
  const cancelAnalysis = useCallback(() => {
    setState((prev) => {
      const isInCitationsPhase = prev.progress?.currentSection === 'Citations';
      if (prev.abortController) {
        prev.abortController.abort();
      }

      // If we're already in the citations phase, treat cancel as "skip citations"
      // rather than discarding an analysis result that has already been computed.
      if (isInCitationsPhase) {
        return {
          ...prev,
          abortController: null,
          progress: {
            ...(prev.progress ?? {
              progress: 95,
              message: 'Skipping supporting evidence...',
              complete: false,
              currentSection: 'Citations',
            }),
            message: 'Skipping supporting evidence...',
          },
        };
      }

      return {
        ...prev,
        loading: false,
        abortController: null,
        error: 'Analysis cancelled by user',
        progress: {
          progress: 0,
          message: 'Analysis cancelled',
          complete: false,
          error: 'Analysis cancelled by user',
        },
      };
    });
  }, []);

  /**
   * Clear current analysis and error state
   */
  const clearAnalysis = useCallback(() => {
    setState((prev) => ({
      ...prev,
      analysis: null,
      error: null,
      progress: null,
      abortController: null,
      resolvedStrategy: null,
    }));
  }, []);

  /**
   * Reset all state to initial values
   */
  const reset = useCallback(() => {
    setState((prev) => {
      // Cancel any in-progress analysis before resetting
      if (prev.abortController) {
        prev.abortController.abort();
      }
      return initialState;
    });
  }, []);

  return {
    state,
    analyzeTranscript,
    fetchAnalyses,
    cancelAnalysis,
    clearAnalysis,
    reset,
  };
}

/**
 * Hook for loading existing analyses for a transcript
 * RACE CONDITION FIX: Added AbortController to cancel stale requests
 *
 * @param transcriptId - The transcript ID to load analyses for
 * @returns Analysis state with loaded analyses
 *
 * @example
 * ```tsx
 * function AnalysisList({ transcriptId }: { transcriptId: string }) {
 *   const { analyses, loading } = useAnalysisLoader(transcriptId);
 *
 *   if (loading) return <Loader />;
 *
 *   return (
 *     <ul>
 *       {analyses.map(analysis => (
 *         <li key={analysis.id}>{analysis.createdAt}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useAnalysisLoader(transcriptId: string) {
  const { state, fetchAnalyses } = useAnalysis();

  // Fetch analyses on mount with cancellation support
  React.useEffect(() => {
    if (!transcriptId) return;

    const abortController = new AbortController();

    // Fetch with abort signal
    fetchAnalyses(transcriptId, abortController.signal);

    // Cleanup: abort the request if transcriptId changes or component unmounts
    return () => {
      abortController.abort();
    };
  }, [transcriptId, fetchAnalyses]);

  return {
    analyses: state.analyses,
    loading: state.loading,
    error: state.error,
  };
}

/**
 * Hook for loading analyses with pagination (optimized for large analysis lists)
 *
 * Uses compound indexes for efficient querying on large datasets.
 *
 * @param transcriptId - The transcript ID to load analyses for
 * @param options - Pagination options (limit, offset, orderDirection)
 * @returns Paginated analysis result with loading state
 *
 * @example
 * ```tsx
 * function AnalysisListPaginated({ transcriptId }: { transcriptId: string }) {
 *   const [page, setPage] = useState(0);
 *   const limit = 20;
 *
 *   const { result, loading, error } = useAnalysisLoaderPaginated(
 *     transcriptId,
 *     { limit, offset: page * limit }
 *   );
 *
 *   if (loading) return <Loader />;
 *   if (error) return <Error message={error} />;
 *
 *   return (
 *     <div>
 *       <p>Showing {result.items.length} of {result.total} analyses</p>
 *       {result.items.map(analysis => (
 *         <AnalysisCard key={analysis.id} analysis={analysis} />
 *       ))}
 *       {result.hasMore && (
 *         <button onClick={() => setPage(p => p + 1)}>Load More</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAnalysisLoaderPaginated(
  transcriptId: string,
  options: PaginationOptions = {}
) {
  const [result, setResult] = React.useState<PaginatedResult<Analysis>>({
    items: [],
    total: 0,
    hasMore: false,
    offset: 0,
    limit: 20
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!transcriptId) {
      setLoading(false);
      return;
    }

    const abortController = new AbortController();

    const loadAnalyses = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if cancelled before async operation
        if (abortController.signal.aborted) {
          return;
        }

        const paginatedResult = await getAnalysesPaginated(transcriptId, options);

        // Check if cancelled after async operation
        if (abortController.signal.aborted) {
          return;
        }

        setResult(paginatedResult);
        setLoading(false);
      } catch (err) {
        // Don't update state if operation was cancelled
        if (abortController.signal.aborted) {
          return;
        }

        const errorMessage = err instanceof Error ? err.message : 'Failed to load analyses';
        setError(errorMessage);
        setLoading(false);
      }
    };

    loadAnalyses();

    // Cleanup: abort the request if dependencies change or component unmounts
    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally using specific fields to prevent infinite re-renders
  }, [transcriptId, options.limit, options.offset, options.orderDirection]);

  return {
    result,
    loading,
    error,
  };
}
