/**
 * Supplemental Upload Hook
 *
 * Manages state for supplemental source material uploads:
 * - Multiple document uploads with parsing
 * - Pasted text content
 * - Token counting and limits
 * - Combined content for API submission
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { parseDocument, validateFile } from '@/lib/document-parser';
import { estimateTokens } from '@/lib/token-utils';
import type { SupplementalDocument } from '@/types/supplemental';
import { SUPPLEMENTAL_LIMITS } from '@/types/supplemental';
import { getDocumentTypeFromExtension } from '@/types/supplemental';

/**
 * Return type for the useSupplementalUpload hook.
 */
export interface UseSupplementalUploadReturn {
  // State
  /** List of uploaded/parsed documents */
  documents: SupplementalDocument[];
  /** Pasted text content */
  pastedText: string;
  /** Token count for pasted text */
  pastedTextTokens: number;
  /** Combined token count of all supplemental materials */
  totalTokens: number;
  /** Whether any document is currently being parsed */
  isProcessing: boolean;
  /** Whether supplemental upload is enabled */
  isEnabled: boolean;

  // Actions
  /** Enable/disable supplemental upload */
  setEnabled: (enabled: boolean) => void;
  /** Add one or more files for parsing */
  addFiles: (files: File[]) => Promise<void>;
  /** Remove a document by ID */
  removeDocument: (id: string) => void;
  /** Update pasted text content */
  setPastedText: (text: string) => void;
  /** Clear all supplemental content */
  clear: () => void;

  // For API submission
  /** Get combined supplemental content for API (undefined if no content) */
  getSupplementalContent: () => string | undefined;
  /** Check if there's any supplemental content */
  hasContent: boolean;
}

/**
 * Generate a unique ID for documents.
 */
function generateId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook for managing supplemental source material uploads.
 *
 * @example
 * ```tsx
 * function AnalysisPage() {
 *   const {
 *     documents,
 *     pastedText,
 *     totalTokens,
 *     addFiles,
 *     removeDocument,
 *     setPastedText,
 *     getSupplementalContent,
 *   } = useSupplementalUpload();
 *
 *   const handleAnalyze = async () => {
 *     const supplemental = getSupplementalContent();
 *     await analyzeTranscript(transcript, template, { supplementalMaterial: supplemental });
 *   };
 * }
 * ```
 */
export function useSupplementalUpload(): UseSupplementalUploadReturn {
  const [isEnabled, setIsEnabled] = useState(false);
  const [documents, setDocuments] = useState<SupplementalDocument[]>([]);
  const [pastedText, setPastedTextState] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate pasted text tokens
  const pastedTextTokens = useMemo(() => {
    return pastedText.trim() ? estimateTokens(pastedText.trim()) : 0;
  }, [pastedText]);

  // Calculate total tokens from all sources
  const totalTokens = useMemo(() => {
    const documentTokens = documents
      .filter((doc) => doc.status === 'ready')
      .reduce((sum, doc) => sum + doc.tokenCount, 0);
    return documentTokens + pastedTextTokens;
  }, [documents, pastedTextTokens]);

  // Check if there's any content
  const hasContent = useMemo(() => {
    return (
      documents.some((doc) => doc.status === 'ready' && doc.text.trim()) ||
      pastedText.trim().length > 0
    );
  }, [documents, pastedText]);

  /**
   * Add one or more files for parsing.
   * Files are validated and parsed asynchronously.
   */
  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsProcessing(true);

    // Process files in parallel
    const parsePromises = files.map(async (file) => {
      const id = generateId();
      const docType = getDocumentTypeFromExtension(file.name);

      // Create initial document entry
      const initialDoc: SupplementalDocument = {
        id,
        filename: file.name,
        type: docType || 'txt',
        text: '',
        tokenCount: 0,
        status: 'parsing',
        fileSize: file.size,
        addedAt: new Date(),
      };

      // Add to state immediately to show loading
      setDocuments((prev) => [...prev, initialDoc]);

      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === id
              ? {
                  ...doc,
                  status: 'error' as const,
                  error: validationError,
                }
              : doc
          )
        );
        return;
      }

      // Parse file
      try {
        const result = await parseDocument(file);

        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === id
              ? {
                  ...doc,
                  text: result.text,
                  tokenCount: result.tokenCount,
                  status: 'ready' as const,
                  warnings: result.warnings,
                }
              : doc
          )
        );
      } catch (error) {
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === id
              ? {
                  ...doc,
                  status: 'error' as const,
                  error: error instanceof Error ? error.message : 'Failed to parse document',
                }
              : doc
          )
        );
      }
    });

    await Promise.all(parsePromises);
    setIsProcessing(false);
  }, []);

  /**
   * Remove a document by ID.
   */
  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  /**
   * Update pasted text content.
   */
  const setPastedText = useCallback((text: string) => {
    setPastedTextState(text);
  }, []);

  /**
   * Clear all supplemental content.
   */
  const clear = useCallback(() => {
    setDocuments([]);
    setPastedTextState('');
  }, []);

  /**
   * Enable/disable supplemental upload.
   * When disabled, content is preserved but not used.
   */
  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
  }, []);

  /**
   * Get combined supplemental content for API submission.
   * Returns undefined if no content or if disabled.
   */
  const getSupplementalContent = useCallback((): string | undefined => {
    if (!isEnabled) return undefined;

    const parts: string[] = [];

    // Add document content
    const readyDocs = documents.filter((doc) => doc.status === 'ready' && doc.text.trim());
    for (const doc of readyDocs) {
      parts.push(`### ${doc.filename}\n\n${doc.text}`);
    }

    // Add pasted text
    if (pastedText.trim()) {
      parts.push(`### Pasted Notes\n\n${pastedText.trim()}`);
    }

    if (parts.length === 0) {
      return undefined;
    }

    return parts.join('\n\n---\n\n');
  }, [isEnabled, documents, pastedText]);

  return {
    // State
    documents,
    pastedText,
    pastedTextTokens,
    totalTokens,
    isProcessing,
    isEnabled,

    // Actions
    setEnabled,
    addFiles,
    removeDocument,
    setPastedText,
    clear,

    // For API
    getSupplementalContent,
    hasContent,
  };
}

/**
 * Calculate warning level based on token usage.
 *
 * @param supplementalTokens - Tokens from supplemental materials
 * @param transcriptTokens - Tokens from transcript
 * @param contextLimit - Total context limit
 * @returns Warning level: 'none' | 'warning' | 'critical'
 */
export function getTokenWarningLevel(
  supplementalTokens: number,
  transcriptTokens: number,
  contextLimit: number
): 'none' | 'warning' | 'critical' {
  const totalTokens = supplementalTokens + transcriptTokens;
  const usagePercent = (totalTokens / contextLimit) * 100;

  if (usagePercent >= 95) {
    return 'critical';
  }
  if (usagePercent >= SUPPLEMENTAL_LIMITS.WARNING_THRESHOLD_PERCENT) {
    return 'warning';
  }
  return 'none';
}

/**
 * Format token count for display.
 *
 * @param tokens - Token count
 * @returns Formatted string (e.g., "1.2k", "45k", "125k")
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toString();
  }
  if (tokens < 10000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return `${Math.round(tokens / 1000)}k`;
}
