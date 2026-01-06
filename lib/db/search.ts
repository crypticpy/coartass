/**
 * Transcript Search Index Helpers
 *
 * Provides lightweight tokenization + indexing helpers to avoid full-table scans
 * when searching transcripts in IndexedDB (Dexie).
 */

import type { Transcript } from "@/types/transcript";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "he",
  "her",
  "hers",
  "him",
  "his",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "ours",
  "she",
  "so",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "too",
  "up",
  "us",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "will",
  "with",
  "you",
  "your",
  "yours",
]);

function extractTokensFromText(text: string, maxTokens: number): string[] {
  const tokens = new Set<string>();
  const tokenRe = /[a-z0-9]{2,64}/gi;

  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(text)) !== null) {
    const token = match[0].toLowerCase();
    if (STOPWORDS.has(token)) continue;
    tokens.add(token);
    if (tokens.size >= maxTokens) break;
  }

  return Array.from(tokens);
}

export function tokenizeSearchQuery(searchTerm: string): string[] {
  const trimmed = searchTerm.trim();
  if (!trimmed) return [];

  // Keep the query narrow: a small number of tokens prevents expensive intersections.
  return extractTokensFromText(trimmed, 6);
}

export function computeTranscriptSearchTokens(
  transcript: Pick<Transcript, "filename" | "text" | "summary" | "department">
): string[] {
  const MAX_TOKENS = 600;
  const TEXT_SLICE_LEN = 20_000;

  const filename = transcript.filename ?? "";
  const department = transcript.department ?? "";
  const summary = transcript.summary ?? "";
  const text = transcript.text ?? "";

  const head = text.slice(0, TEXT_SLICE_LEN);
  const tail = text.slice(Math.max(0, text.length - TEXT_SLICE_LEN));

  const combined = `${filename} ${department} ${summary} ${head} ${tail}`;
  return extractTokensFromText(combined, MAX_TOKENS);
}
