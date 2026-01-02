/**
 * Formatting Utility Functions
 *
 * Common formatting utilities for transcript display
 */

import type { TranscriptSegment } from '@/types/transcript';

/**
 * Format bytes to human-readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "2.5 MB", "850 KB")
 *
 * @example
 * formatFileSize(2560000) // "2.44 MB"
 * formatFileSize(850000)  // "830 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(i > 1 ? 2 : 0))} ${sizes[i]}`;
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS format
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 *
 * @example
 * formatDuration(125)   // "2:05"
 * formatDuration(3725)  // "1:02:05"
 */
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Extract unique speaker count from transcript segments
 *
 * @param segments - Array of transcript segments
 * @returns Number of unique speakers detected
 *
 * @example
 * getSpeakerCount(segments) // 3
 */
export function getSpeakerCount(segments: TranscriptSegment[]): number {
  if (!segments || segments.length === 0) return 0;

  const speakers = new Set<string>();
  for (const segment of segments) {
    if (segment.speaker) {
      speakers.add(segment.speaker);
    }
  }
  return speakers.size;
}

/**
 * Language code to display name mapping
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  pl: 'Polish',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  tr: 'Turkish',
  vi: 'Vietnamese',
  th: 'Thai',
  sv: 'Swedish',
  da: 'Danish',
  fi: 'Finnish',
  no: 'Norwegian',
  cs: 'Czech',
  el: 'Greek',
  he: 'Hebrew',
  id: 'Indonesian',
  ms: 'Malay',
  ro: 'Romanian',
  uk: 'Ukrainian',
  hu: 'Hungarian',
};

/**
 * Get display name for a language code
 *
 * @param code - ISO 639-1 language code (e.g., "en", "es")
 * @returns Full language name or uppercase code if not found
 *
 * @example
 * getLanguageDisplay('en')  // "English"
 * getLanguageDisplay('es')  // "Spanish"
 * getLanguageDisplay('xyz') // "XYZ"
 */
export function getLanguageDisplay(code: string | undefined): string {
  if (!code) return 'Unknown';
  const lowerCode = code.toLowerCase();
  return LANGUAGE_NAMES[lowerCode] || code.toUpperCase();
}

/**
 * Get short language code for badge display
 *
 * @param code - ISO 639-1 language code
 * @returns Uppercase 2-letter code
 *
 * @example
 * getLanguageBadge('english') // "EN"
 * getLanguageBadge('es')      // "ES"
 */
export function getLanguageBadge(code: string | undefined): string {
  if (!code) return '??';
  // Handle full language names
  const entry = Object.entries(LANGUAGE_NAMES).find(
    ([, name]) => name.toLowerCase() === code.toLowerCase()
  );
  if (entry) return entry[0].toUpperCase();
  // Return first 2 chars uppercase
  return code.slice(0, 2).toUpperCase();
}

/**
 * Get display name for transcription model
 *
 * @param model - Model identifier from metadata
 * @returns Human-friendly model name
 *
 * @example
 * getModelDisplay('whisper-1')           // "Whisper"
 * getModelDisplay('gpt-4o-transcribe')   // "GPT-4o"
 */
export function getModelDisplay(model: string | undefined): string {
  if (!model) return 'Unknown';

  const lowerModel = model.toLowerCase();

  if (lowerModel.includes('whisper')) {
    return 'Whisper';
  }
  if (lowerModel.includes('gpt-4o')) {
    return 'GPT-4o';
  }
  if (lowerModel.includes('gpt-4')) {
    return 'GPT-4';
  }

  return model;
}

/**
 * Truncate text to a maximum length with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format date for display (e.g., "Nov 25, 2024")
 *
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date and time for display (e.g., "Nov 25, 2024 at 2:30 PM")
 *
 * @param date - Date to format
 * @returns Formatted date and time string
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
