/**
 * Demo Data Loader Hook
 *
 * Provides functionality to load sample demonstration data into IndexedDB
 * for showcasing the application's features without real audio files.
 *
 * IMPORTANT: Demo data uses the 'demo-' ID prefix convention.
 * All demo transcript IDs start with 'demo-transcript-'
 * All demo analysis IDs start with 'demo-analysis-'
 */

'use client';

import { useState, useCallback } from 'react';
import { generateDemoData, DEMO_DATA_INFO } from '@/lib/demo-data';
import { saveTranscript, saveAnalysis, getAllTranscripts, deleteTranscript } from '@/lib/db';
import type { Transcript } from '@/types/transcript';
import type { Analysis } from '@/types/analysis';

/**
 * Check if demo data exists in the database
 * Used to determine if cleanup is needed before loading new demo data
 */
export async function hasDemoData(): Promise<boolean> {
  try {
    const allTranscripts = await getAllTranscripts();
    return allTranscripts.some(t => t.id.startsWith('demo-'));
  } catch (error) {
    console.error('[hasDemoData] Error checking for demo data:', error);
    return false;
  }
}

/**
 * Get count of demo transcripts in the database
 */
export async function getDemoDataCount(): Promise<number> {
  try {
    const allTranscripts = await getAllTranscripts();
    return allTranscripts.filter(t => t.id.startsWith('demo-')).length;
  } catch (error) {
    console.error('[getDemoDataCount] Error counting demo data:', error);
    return 0;
  }
}

/**
 * Clear all demo data from the database
 * Standalone function that can be called outside of the hook context
 */
export async function clearAllDemoData(): Promise<number> {
  try {
    const allTranscripts = await getAllTranscripts();
    const demoTranscripts = allTranscripts.filter(t => t.id.startsWith('demo-'));

    // Delete demo transcripts (cascades to analyses and conversations)
    for (const transcript of demoTranscripts) {
      await deleteTranscript(transcript.id);
    }

    console.log(`[clearAllDemoData] Cleared ${demoTranscripts.length} demo transcripts`);
    return demoTranscripts.length;
  } catch (error) {
    console.error('[clearAllDemoData] Error clearing demo data:', error);
    return 0;
  }
}

export interface UseDemoDataReturn {
  /** Whether demo data is currently being loaded */
  isLoading: boolean;
  /** Whether demo data has been successfully loaded */
  isLoaded: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Load demo data into the database */
  loadDemoData: () => Promise<void>;
  /** Clear all demo data from the database */
  clearDemoData: () => Promise<void>;
  /** Information about the demo data */
  info: typeof DEMO_DATA_INFO;
  /** Number of demo items successfully loaded */
  loadedCount: { transcripts: number; analyses: number };
}

/**
 * Hook for managing demo data loading
 *
 * @example
 * ```tsx
 * const { loadDemoData, isLoading, isLoaded, error } = useDemoData();
 *
 * return (
 *   <Button onClick={loadDemoData} loading={isLoading} disabled={isLoaded}>
 *     {isLoaded ? 'Demo Data Loaded' : 'Load Demo Data'}
 *   </Button>
 * );
 * ```
 */
export function useDemoData(): UseDemoDataReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState({ transcripts: 0, analyses: 0 });

  const loadDemoData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const demoData = generateDemoData();
      let transcriptsLoaded = 0;
      let analysesLoaded = 0;

      // Load transcripts
      for (const transcript of demoData.transcripts) {
        await saveTranscript(transcript as Transcript);
        transcriptsLoaded++;
      }

      // Load analyses
      for (const analysis of demoData.analyses) {
        await saveAnalysis(analysis as Analysis);
        analysesLoaded++;
      }

      setLoadedCount({ transcripts: transcriptsLoaded, analyses: analysesLoaded });
      setIsLoaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load demo data';
      setError(message);
      console.error('[useDemoData] Error loading demo data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearDemoData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get all transcripts and filter for demo ones
      const allTranscripts = await getAllTranscripts();
      const demoTranscripts = allTranscripts.filter(t => t.id.startsWith('demo-'));

      // Delete demo transcripts (this also deletes associated analyses via cascade)
      const { deleteTranscript } = await import('@/lib/db');
      for (const transcript of demoTranscripts) {
        await deleteTranscript(transcript.id);
      }

      setIsLoaded(false);
      setLoadedCount({ transcripts: 0, analyses: 0 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear demo data';
      setError(message);
      console.error('[useDemoData] Error clearing demo data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    isLoaded,
    error,
    loadDemoData,
    clearDemoData,
    info: DEMO_DATA_INFO,
    loadedCount,
  };
}
