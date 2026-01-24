/**
 * Persistent Supplemental Documents Hook
 *
 * Manages supplemental documents attached to a transcript with IndexedDB persistence.
 * Unlike useSupplementalUpload which is for one-time analysis use, this hook
 * manages documents that are permanently attached to an incident.
 *
 * Features:
 * - Live reactive updates via useLiveQuery
 * - Document parsing and token counting
 * - CRUD operations with persistence
 * - Integration with useSupplementalUpload for migration
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  saveSupplementalDocument,
  saveSupplementalDocumentsBatch,
  getSupplementalDocumentsByTranscript,
  deleteSupplementalDocument as dbDeleteDocument,
  getFormattedSupplementalContent,
} from "@/lib/db";
import { parseDocument, validateFile } from "@/lib/document-parser";
import { estimateTokens } from "@/lib/token-utils";
import {
  getDocumentTypeFromExtension,
  detectDocumentCategory,
} from "@/types/supplemental";
import type {
  SupplementalDocument,
  PersistedSupplementalDocument,
} from "@/types/supplemental";
import { isVisinetReport, parseVisinetReport } from "@/lib/visinet-parser";
import { v4 as uuidv4 } from "uuid";

/**
 * Return type for the useSupplementalDocsPersistent hook.
 */
export interface UseSupplementalDocsPersistentReturn {
  /** All documents attached to the transcript */
  documents: PersistedSupplementalDocument[];

  /** Whether documents are loading from IndexedDB */
  isLoading: boolean;

  /** Whether an operation is in progress */
  isProcessing: boolean;

  /** Error message if any operation failed */
  error: string | null;

  /** Total token count of all ready documents */
  totalTokens: number;

  /** Number of documents */
  count: number;

  /** Add one or more files for parsing and persistence */
  addFiles: (files: File[]) => Promise<void>;

  /** Add pasted text as a document */
  addPastedText: (text: string, title?: string) => Promise<void>;

  /** Remove a document by ID */
  removeDocument: (id: string) => Promise<void>;

  /** Persist documents from useSupplementalUpload */
  persistFromUpload: (documents: SupplementalDocument[]) => Promise<void>;

  /** Get formatted content for analysis inclusion */
  getFormattedContent: () => Promise<string | undefined>;

  /** Check if there are any ready documents */
  hasContent: boolean;

  /** Clear error */
  clearError: () => void;

  /** Toggle whether a document is included in analysis */
  toggleIncludeInAnalysis: (id: string) => Promise<void>;

  /** Update a specific document */
  updateDocument: (
    id: string,
    updates: Partial<PersistedSupplementalDocument>,
  ) => Promise<void>;
}

/**
 * Hook for managing persistent supplemental documents attached to a transcript.
 *
 * @param transcriptId - The ID of the transcript to manage documents for
 *
 * @example
 * ```tsx
 * function IncidentDocuments({ transcriptId }) {
 *   const {
 *     documents,
 *     addFiles,
 *     removeDocument,
 *     totalTokens,
 *   } = useSupplementalDocsPersistent(transcriptId);
 *
 *   return (
 *     <div>
 *       <h3>Attached Documents ({documents.length})</h3>
 *       <p>Total tokens: {totalTokens}</p>
 *       <Dropzone onDrop={addFiles} />
 *       {documents.map((doc) => (
 *         <DocumentCard
 *           key={doc.id}
 *           document={doc}
 *           onRemove={() => removeDocument(doc.id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSupplementalDocsPersistent(
  transcriptId: string | undefined,
): UseSupplementalDocsPersistentReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live query for documents
  const documents = useLiveQuery(
    async () => {
      if (!transcriptId) return [];
      return getSupplementalDocumentsByTranscript(transcriptId);
    },
    [transcriptId],
    [], // Default to empty array while loading
  );

  const isLoading = documents === undefined;

  // Calculate total tokens from ready documents that are included in analysis
  const totalTokens = useMemo(() => {
    if (!documents) return 0;
    return documents
      .filter(
        (doc) => doc.status === "ready" && doc.includeInAnalysis !== false,
      )
      .reduce((sum, doc) => sum + doc.tokenCount, 0);
  }, [documents]);

  // Check if there's any ready content
  const hasContent = useMemo(() => {
    if (!documents) return false;
    return documents.some((doc) => doc.status === "ready" && doc.text.trim());
  }, [documents]);

  /**
   * Add one or more files for parsing and persistence.
   */
  const addFiles = useCallback(
    async (files: File[]) => {
      if (!transcriptId) {
        setError("No transcript ID provided");
        return;
      }

      if (files.length === 0) return;

      setIsProcessing(true);
      setError(null);

      try {
        // Process files in parallel
        const parsePromises = files.map(async (file) => {
          const id = uuidv4();
          const docType = getDocumentTypeFromExtension(file.name);

          // Validate file
          const validationError = validateFile(file);
          if (validationError) {
            return {
              id,
              transcriptId,
              filename: file.name,
              type: docType || "txt",
              text: "",
              tokenCount: 0,
              status: "error" as const,
              error: validationError,
              fileSize: file.size,
              addedAt: new Date(),
            } satisfies PersistedSupplementalDocument;
          }

          // Parse file
          try {
            const result = await parseDocument(file);

            // Detect document category
            const category = detectDocumentCategory(file.name, result.text);

            // Build base document
            const doc: PersistedSupplementalDocument = {
              id,
              transcriptId,
              filename: file.name,
              type: docType || "txt",
              category,
              text: result.text,
              tokenCount: result.tokenCount,
              status: "ready" as const,
              warnings: result.warnings,
              fileSize: file.size,
              addedAt: new Date(),
              includeInAnalysis: true,
            };

            // If it's a Visinet report, parse structured data
            if (category === "visinet" && isVisinetReport(result.text)) {
              try {
                const visinetData = parseVisinetReport(result.text);
                doc.visinetData = visinetData;
                // Add any parse warnings
                if (visinetData.parseWarnings.length > 0) {
                  doc.warnings = [
                    ...(doc.warnings || []),
                    ...visinetData.parseWarnings,
                  ];
                }
              } catch (_visinetError) {
                // Non-fatal: we still have the raw text
                doc.warnings = [
                  ...(doc.warnings || []),
                  "Could not parse Visinet structured data",
                ];
              }
            }

            return doc;
          } catch (parseError) {
            return {
              id,
              transcriptId,
              filename: file.name,
              type: docType || "txt",
              text: "",
              tokenCount: 0,
              status: "error" as const,
              error:
                parseError instanceof Error
                  ? parseError.message
                  : "Failed to parse document",
              fileSize: file.size,
              addedAt: new Date(),
            } satisfies PersistedSupplementalDocument;
          }
        });

        const parsedDocs = await Promise.all(parsePromises);
        await saveSupplementalDocumentsBatch(parsedDocs);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to add documents";
        setError(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [transcriptId],
  );

  /**
   * Add pasted text as a document.
   */
  const addPastedText = useCallback(
    async (text: string, title: string = "Pasted Notes") => {
      if (!transcriptId) {
        setError("No transcript ID provided");
        return;
      }

      if (!text.trim()) {
        setError("Text cannot be empty");
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const doc: PersistedSupplementalDocument = {
          id: uuidv4(),
          transcriptId,
          filename: title,
          type: "pasted",
          text: text.trim(),
          tokenCount: estimateTokens(text.trim()),
          status: "ready",
          addedAt: new Date(),
        };

        await saveSupplementalDocument(doc);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to add pasted text";
        setError(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [transcriptId],
  );

  /**
   * Remove a document by ID.
   */
  const removeDocument = useCallback(async (id: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      await dbDeleteDocument(id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to remove document";
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Persist documents from useSupplementalUpload.
   * Used when migrating from one-time upload to persistent storage.
   */
  const persistFromUpload = useCallback(
    async (uploadDocs: SupplementalDocument[]) => {
      if (!transcriptId) {
        setError("No transcript ID provided");
        return;
      }

      if (uploadDocs.length === 0) return;

      setIsProcessing(true);
      setError(null);

      try {
        // Convert to persisted documents
        const persistedDocs: PersistedSupplementalDocument[] = uploadDocs
          .filter((doc) => doc.status === "ready" && doc.text.trim())
          .map((doc) => ({
            ...doc,
            transcriptId,
          }));

        if (persistedDocs.length > 0) {
          await saveSupplementalDocumentsBatch(persistedDocs);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to persist documents";
        setError(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [transcriptId],
  );

  /**
   * Get formatted content for analysis inclusion.
   */
  const getFormattedContent = useCallback(async () => {
    if (!transcriptId) return undefined;
    return getFormattedSupplementalContent(transcriptId);
  }, [transcriptId]);

  /**
   * Clear the error state.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Toggle whether a document is included in analysis.
   */
  const toggleIncludeInAnalysis = useCallback(
    async (id: string) => {
      const doc = documents?.find((d) => d.id === id);
      if (!doc) return;

      setIsProcessing(true);
      setError(null);

      try {
        const updatedDoc: PersistedSupplementalDocument = {
          ...doc,
          includeInAnalysis: !(doc.includeInAnalysis !== false),
        };
        await saveSupplementalDocument(updatedDoc);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update document";
        setError(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [documents],
  );

  /**
   * Update a specific document with partial changes.
   */
  const updateDocument = useCallback(
    async (id: string, updates: Partial<PersistedSupplementalDocument>) => {
      const doc = documents?.find((d) => d.id === id);
      if (!doc) return;

      setIsProcessing(true);
      setError(null);

      try {
        const updatedDoc: PersistedSupplementalDocument = {
          ...doc,
          ...updates,
          id, // Ensure ID is not overwritten
          transcriptId: doc.transcriptId, // Ensure transcriptId is not overwritten
        };
        await saveSupplementalDocument(updatedDoc);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update document";
        setError(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [documents],
  );

  return {
    documents: documents ?? [],
    isLoading,
    isProcessing,
    error,
    totalTokens,
    count: documents?.length ?? 0,
    addFiles,
    addPastedText,
    removeDocument,
    persistFromUpload,
    getFormattedContent,
    hasContent,
    clearError,
    toggleIncludeInAnalysis,
    updateDocument,
  };
}
