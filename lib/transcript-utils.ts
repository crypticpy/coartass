/**
 * Transcript Utility Functions
 *
 * Provides utility functions for formatting, searching, and manipulating
 * transcript data for display and interaction purposes.
 */

import React from 'react';

/**
 * Formats a duration in seconds to HH:MM:SS or MM:SS format
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 *
 * @example
 * formatDuration(65) // "01:05"
 * formatDuration(3665) // "01:01:05"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0 || !isFinite(seconds)) {
    return '00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats a timestamp in seconds to MM:SS or HH:MM:SS format
 * Same as formatDuration but more semantically clear for timestamps
 *
 * @param seconds - Timestamp in seconds
 * @returns Formatted timestamp string
 */
export function formatTimestamp(seconds: number): string {
  return formatDuration(seconds);
}

/**
 * Calculates the word count in a text string
 *
 * @param text - The text to count words in
 * @returns Number of words
 *
 * @example
 * calculateWordCount("Hello world") // 2
 */
export function calculateWordCount(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  // Trim whitespace and split by whitespace, then filter out empty strings
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

/**
 * Match information for search highlighting
 */
export interface SearchMatch {
  /** Start index of the match in the text */
  start: number;
  /** End index of the match in the text */
  end: number;
  /** The matched text */
  text: string;
}

/**
 * Finds all matches of a search term in text (case-insensitive)
 *
 * @param text - The text to search in
 * @param searchTerm - The term to search for
 * @returns Array of match information
 */
export function findMatches(text: string, searchTerm: string): SearchMatch[] {
  if (!text || !searchTerm) {
    return [];
  }

  const matches: SearchMatch[] = [];
  const lowerText = text.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();
  let startIndex = 0;

  while (true) {
    const index = lowerText.indexOf(lowerSearch, startIndex);
    if (index === -1) break;

    matches.push({
      start: index,
      end: index + searchTerm.length,
      text: text.substring(index, index + searchTerm.length)
    });

    startIndex = index + 1;
  }

  return matches;
}

/**
 * Highlights search matches in text by wrapping them in mark elements
 *
 * @param text - The text to highlight matches in
 * @param searchTerm - The term to search for and highlight
 * @param currentMatchIndex - Index of the current match to highlight differently (optional)
 * @returns React fragment with highlighted text
 */
export function highlightText(
  text: string,
  searchTerm: string,
  currentMatchIndex?: number
): React.ReactNode {
  if (!searchTerm || !text) {
    return text;
  }

  const matches = findMatches(text, searchTerm);

  if (matches.length === 0) {
    return text;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, index) => {
    // Add text before the match
    if (match.start > lastIndex) {
      parts.push(text.substring(lastIndex, match.start));
    }

    // Add the highlighted match
    const isCurrent = currentMatchIndex !== undefined && currentMatchIndex === index;
    parts.push(
      React.createElement(
        'mark',
        {
          key: `match-${index}`,
          id: isCurrent ? 'current-search-match' : undefined,
          className: isCurrent
            ? 'bg-yellow-400 text-black font-semibold ring-2 ring-yellow-600'
            : 'bg-yellow-200 text-black',
          'data-match-index': index
        },
        match.text
      )
    );

    lastIndex = match.end;
  });

  // Add remaining text after the last match
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return React.createElement(React.Fragment, null, ...parts);
}

/**
 * Extracts context around a specific position in text
 *
 * @param text - The full text
 * @param position - The position to extract context around
 * @param contextLength - Number of characters to include on each side
 * @returns Object with extracted context and relative position
 */
export function extractContext(
  text: string,
  position: number,
  contextLength: number = 50
): {
  before: string;
  match: string;
  after: string;
  start: number;
  end: number;
} {
  const start = Math.max(0, position - contextLength);
  const end = Math.min(text.length, position + contextLength);

  return {
    before: text.substring(start, position),
    match: text.charAt(position),
    after: text.substring(position + 1, end),
    start,
    end
  };
}

/**
 * Formats a file size in bytes to a human-readable string
 *
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 *
 * @example
 * formatFileSize(1024) // "1.00 KB"
 * formatFileSize(1536) // "1.50 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0 || !isFinite(bytes)) return 'Invalid';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats a date to a readable string
 *
 * @param date - Date to format
 * @returns Formatted date string
 *
 * @example
 * formatDate(new Date('2024-01-15')) // "Jan 15, 2024"
 */
export function formatDate(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Formats a date to include time
 *
 * @param date - Date to format
 * @returns Formatted date and time string
 *
 * @example
 * formatDateTime(new Date('2024-01-15T14:30:00')) // "Jan 15, 2024 at 2:30 PM"
 */
export function formatDateTime(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return `${dateStr} at ${timeStr}`;
}

/**
 * Truncates text to a maximum length with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Copies text to clipboard
 *
 * @param text - Text to copy
 * @returns Promise that resolves when copy is complete
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (!navigator.clipboard) {
    // Fallback for browsers that don't support clipboard API
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textArea);
    }
    return;
  }

  await navigator.clipboard.writeText(text);
}

/**
 * Downloads text as a file
 *
 * @param text - Text content to download
 * @param filename - Name of the file to download
 * @param mimeType - MIME type of the file (default: text/plain)
 */
export function downloadTextAsFile(
  text: string,
  filename: string,
  mimeType: string = 'text/plain'
): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Converts transcript to plain text format
 *
 * @param transcript - The transcript object
 * @returns Formatted plain text
 */
export function exportTranscriptAsText(transcript: {
  filename: string;
  text: string;
  createdAt: Date;
  metadata: {
    duration: number;
    language?: string;
    model: string;
  };
}): string {
  const header = [
    `Transcript: ${transcript.filename}`,
    `Date: ${formatDateTime(transcript.createdAt)}`,
    `Duration: ${formatDuration(transcript.metadata.duration)}`,
    `Language: ${transcript.metadata.language || 'Auto-detected'}`,
    `Model: ${transcript.metadata.model}`,
    '=' .repeat(80),
    ''
  ].join('\n');

  return header + transcript.text;
}

/**
 * Converts transcript to SRT subtitle format
 *
 * @param segments - Array of transcript segments
 * @returns SRT formatted string
 */
export function exportTranscriptAsSRT(
  segments: Array<{ start: number; end: number; text: string }>
): string {
  return segments
    .map((segment, index) => {
      const startTime = formatSRTTimestamp(segment.start);
      const endTime = formatSRTTimestamp(segment.end);
      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
    })
    .join('\n');
}

/**
 * Formats seconds to SRT timestamp format (HH:MM:SS,mmm)
 *
 * @param seconds - Time in seconds
 * @returns SRT formatted timestamp
 */
function formatSRTTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Converts transcript to VTT subtitle format
 *
 * @param segments - Array of transcript segments
 * @returns VTT formatted string
 */
export function exportTranscriptAsVTT(
  segments: Array<{ start: number; end: number; text: string }>
): string {
  const header = 'WEBVTT\n\n';
  const content = segments
    .map((segment, index) => {
      const startTime = formatVTTTimestamp(segment.start);
      const endTime = formatVTTTimestamp(segment.end);
      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
    })
    .join('\n');

  return header + content;
}

/**
 * Formats seconds to VTT timestamp format (HH:MM:SS.mmm)
 *
 * @param seconds - Time in seconds
 * @returns VTT formatted timestamp
 */
function formatVTTTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}
