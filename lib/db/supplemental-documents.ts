/**
 * Supplemental Documents Database Operations
 *
 * CRUD operations for persistent supplemental documents stored in IndexedDB.
 * These documents are attached to transcripts and automatically included
 * in subsequent analyses.
 */

import { getDatabase, DatabaseError } from "./core";
import type {
  SupplementalDocument,
  PersistedSupplementalDocument,
} from "@/types/supplemental";
import { getCategoryLabel } from "@/types/supplemental";
import { formatVisinetForAnalysis } from "@/lib/visinet-parser";

/**
 * Convert a SupplementalDocument to a PersistedSupplementalDocument.
 * Used when persisting documents that were initially created for one-time use.
 *
 * @param doc - The in-memory supplemental document
 * @param transcriptId - The parent transcript ID
 * @returns A persisted document ready for storage
 */
export function toPersistedDocument(
  doc: SupplementalDocument,
  transcriptId: string,
): PersistedSupplementalDocument {
  return {
    ...doc,
    transcriptId,
  };
}

/**
 * Save a supplemental document to the database.
 *
 * @param doc - The document to save (must include transcriptId)
 * @returns The saved document
 * @throws {DatabaseError} If save fails
 */
export async function saveSupplementalDocument(
  doc: PersistedSupplementalDocument,
): Promise<PersistedSupplementalDocument> {
  const db = getDatabase();

  try {
    await db.supplementalDocuments.put(doc);
    return doc;
  } catch (error) {
    throw new DatabaseError(
      `Failed to save supplemental document: ${error instanceof Error ? error.message : "Unknown error"}`,
      "SUPPLEMENTAL_DOC_SAVE_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Save multiple supplemental documents in a batch.
 *
 * @param docs - Array of documents to save
 * @returns The saved documents
 * @throws {DatabaseError} If batch save fails
 */
export async function saveSupplementalDocumentsBatch(
  docs: PersistedSupplementalDocument[],
): Promise<PersistedSupplementalDocument[]> {
  const db = getDatabase();

  try {
    await db.supplementalDocuments.bulkPut(docs);
    return docs;
  } catch (error) {
    throw new DatabaseError(
      `Failed to save supplemental documents batch: ${error instanceof Error ? error.message : "Unknown error"}`,
      "SUPPLEMENTAL_DOCS_BATCH_SAVE_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Get a supplemental document by its ID.
 *
 * @param id - The document ID
 * @returns The document or undefined if not found
 * @throws {DatabaseError} If retrieval fails
 */
export async function getSupplementalDocument(
  id: string,
): Promise<PersistedSupplementalDocument | undefined> {
  const db = getDatabase();

  try {
    return await db.supplementalDocuments.get(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to get supplemental document: ${error instanceof Error ? error.message : "Unknown error"}`,
      "SUPPLEMENTAL_DOC_GET_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Get all supplemental documents for a transcript, sorted by addedAt.
 *
 * @param transcriptId - The parent transcript ID
 * @returns Array of documents sorted by addedAt ascending
 * @throws {DatabaseError} If retrieval fails
 */
export async function getSupplementalDocumentsByTranscript(
  transcriptId: string,
): Promise<PersistedSupplementalDocument[]> {
  const db = getDatabase();

  try {
    return await db.supplementalDocuments
      .where("transcriptId")
      .equals(transcriptId)
      .sortBy("addedAt");
  } catch (error) {
    throw new DatabaseError(
      `Failed to get supplemental documents for transcript: ${error instanceof Error ? error.message : "Unknown error"}`,
      "SUPPLEMENTAL_DOCS_GET_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Delete a supplemental document by its ID.
 *
 * @param id - The document ID to delete
 * @throws {DatabaseError} If deletion fails
 */
export async function deleteSupplementalDocument(id: string): Promise<void> {
  const db = getDatabase();

  try {
    await db.supplementalDocuments.delete(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete supplemental document: ${error instanceof Error ? error.message : "Unknown error"}`,
      "SUPPLEMENTAL_DOC_DELETE_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Delete all supplemental documents for a transcript.
 * Used when deleting a transcript to cascade the deletion.
 *
 * @param transcriptId - The parent transcript ID
 * @returns The number of documents deleted
 * @throws {DatabaseError} If deletion fails
 */
export async function deleteSupplementalDocumentsByTranscript(
  transcriptId: string,
): Promise<number> {
  const db = getDatabase();

  try {
    return await db.supplementalDocuments
      .where("transcriptId")
      .equals(transcriptId)
      .delete();
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete supplemental documents for transcript: ${error instanceof Error ? error.message : "Unknown error"}`,
      "SUPPLEMENTAL_DOCS_DELETE_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Count supplemental documents for a transcript.
 *
 * @param transcriptId - The parent transcript ID
 * @returns The number of documents
 * @throws {DatabaseError} If count fails
 */
export async function countSupplementalDocumentsByTranscript(
  transcriptId: string,
): Promise<number> {
  const db = getDatabase();

  try {
    return await db.supplementalDocuments
      .where("transcriptId")
      .equals(transcriptId)
      .count();
  } catch (error) {
    throw new DatabaseError(
      `Failed to count supplemental documents: ${error instanceof Error ? error.message : "Unknown error"}`,
      "SUPPLEMENTAL_DOCS_COUNT_FAILED",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Get total token count for all supplemental documents attached to a transcript.
 *
 * @param transcriptId - The parent transcript ID
 * @returns Total token count across all documents
 * @throws {DatabaseError} If calculation fails
 */
export async function getTotalSupplementalTokens(
  transcriptId: string,
): Promise<number> {
  const docs = await getSupplementalDocumentsByTranscript(transcriptId);
  return docs.reduce((sum, doc) => sum + doc.tokenCount, 0);
}

/**
 * Format all supplemental documents as a single string for analysis inclusion.
 * Each document is prefixed with its filename as a header.
 *
 * Respects the includeInAnalysis flag and formats Visinet documents specially
 * to provide structured dispatch data.
 *
 * @param transcriptId - The parent transcript ID
 * @returns Formatted string combining all document content, or undefined if none
 * @throws {DatabaseError} If retrieval fails
 */
export async function getFormattedSupplementalContent(
  transcriptId: string,
): Promise<string | undefined> {
  const docs = await getSupplementalDocumentsByTranscript(transcriptId);

  if (docs.length === 0) {
    return undefined;
  }

  // Filter to only ready documents that are included in analysis and have content
  const includedDocs = docs.filter(
    (doc) =>
      doc.status === "ready" &&
      doc.text.trim() &&
      doc.includeInAnalysis !== false,
  );

  if (includedDocs.length === 0) {
    return undefined;
  }

  // Format each document based on its category
  const parts = includedDocs.map((doc) => {
    const categoryLabel = doc.category
      ? getCategoryLabel(doc.category)
      : "Document";

    // For Visinet reports with parsed data, use the formatted summary
    if (doc.category === "visinet" && doc.visinetData) {
      return formatVisinetForAnalysis(doc.visinetData);
    }

    // For other documents, use the filename as header with raw text
    return `### ${doc.filename} (${categoryLabel})\n\n${doc.text}`;
  });

  return parts.join("\n\n---\n\n");
}
