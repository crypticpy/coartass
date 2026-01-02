# Transcript Export Module

Comprehensive export functionality for meeting transcriptions supporting multiple formats (TXT, JSON, SRT, VTT).

## Overview

This module provides a complete solution for exporting transcript data with:
- Multiple export formats (TXT, JSON, SRT, VTT)
- Proper timestamp formatting for each format
- Browser-compatible file downloads
- Comprehensive error handling
- TypeScript type safety

## Module Structure

```
lib/export/
├── formatters.ts          # Format conversion and timestamp utilities
├── download-helper.ts     # Browser download and blob management
├── transcript-exporter.ts # Main export API
├── index.ts              # Public API exports
└── README.md             # This file
```

## Usage

### Basic Export

```typescript
import { exportTranscript } from '@/lib/export';

// Export to a specific format
const result = exportTranscript(transcript, 'txt');

if (result.success) {
  console.log('Export successful!');
} else {
  console.error('Export failed:', result.error);
}
```

### Using Individual Export Functions

```typescript
import {
  exportToTXT,
  exportToJSON,
  exportToSRT,
  exportToVTT
} from '@/lib/export';

// Export to plain text
exportToTXT(transcript);

// Export to JSON with custom filename
exportToJSON(transcript, {
  customFilename: 'meeting-notes',
  includeTimestamp: false
});

// Export to SRT subtitles
exportToSRT(transcript);

// Export to WebVTT
exportToVTT(transcript);
```

### Using the Export Menu Component

```typescript
import { ExportMenu } from '@/components/transcript/export-menu';

function TranscriptView({ transcript }) {
  return (
    <ExportMenu
      transcript={transcript}
      onExportSuccess={(format) => {
        console.log(`Exported as ${format}`);
      }}
      onExportError={(format, error) => {
        console.error(`Failed to export as ${format}:`, error);
      }}
    />
  );
}
```

## Export Formats

### TXT (Plain Text)

Human-readable format with timestamps and metadata header.

**Example Output:**
```
Meeting Transcription
==================================================

Date: 2024-11-17 14:30:00
Duration: 45:30
Filename: meeting.mp3
Language: en

==================================================

[00:00:00] Welcome everyone to today's meeting...
[00:00:15] Let's start with the quarterly review...
```

**Best For:**
- Simple text viewing
- Email attachments
- Quick sharing

### JSON

Structured data format with complete metadata and segments.

**Example Output:**
```json
{
  "id": "abc123",
  "filename": "meeting.mp3",
  "text": "Full transcript...",
  "segments": [
    {
      "index": 0,
      "start": 0,
      "end": 15.5,
      "text": "Welcome everyone..."
    }
  ],
  "metadata": {
    "model": "whisper-1",
    "language": "en",
    "duration": 2730
  },
  "createdAt": "2024-11-17T14:30:00.000Z"
}
```

**Best For:**
- API integration
- Data processing
- Archival storage

### SRT (SubRip Subtitles)

Standard subtitle format compatible with most video players.

**Example Output:**
```
1
00:00:00,000 --> 00:00:15,500
Welcome everyone to today's meeting...

2
00:00:15,500 --> 00:00:32,000
Let's start with the quarterly review...
```

**Best For:**
- Video subtitles
- Video editing software
- Accessibility features

### VTT (WebVTT)

Web Video Text Tracks format for HTML5 video.

**Example Output:**
```
WEBVTT

00:00:00.000 --> 00:00:15.500
Welcome everyone to today's meeting...

00:00:15.500 --> 00:00:32.000
Let's start with the quarterly review...
```

**Features:**
- Speaker identification with voice tags
- Web standard format
- HTML5 video compatible

## API Reference

### Main Export Functions

#### `exportTranscript(transcript, format, options?)`

Generic export function that routes to format-specific exporters.

**Parameters:**
- `transcript: Transcript` - The transcript to export
- `format: ExportFormat` - Format ('txt', 'json', 'srt', 'vtt')
- `options?: ExportOptions` - Optional export configuration

**Returns:** `ExportResult`

#### `exportToTXT(transcript, options?)`
#### `exportToJSON(transcript, options?)`
#### `exportToSRT(transcript, options?)`
#### `exportToVTT(transcript, options?)`

Format-specific export functions.

### Formatting Functions

#### `formatTimestamp(seconds, format)`

Converts seconds to formatted timestamp string.

**Parameters:**
- `seconds: number` - Time in seconds
- `format: 'srt' | 'vtt' | 'txt'` - Timestamp format

**Returns:** `string`

**Examples:**
```typescript
formatTimestamp(75.5, 'srt')  // "00:01:15,500"
formatTimestamp(75.5, 'vtt')  // "00:01:15.500"
formatTimestamp(75.5, 'txt')  // "[00:01:15]"
```

#### `formatDuration(seconds)`

Formats duration to human-readable string.

**Example:**
```typescript
formatDuration(3665)  // "1:01:05"
formatDuration(125)   // "2:05"
```

### Download Helpers

#### `downloadFile(content, format, filename, includeTimestamp?)`

Creates and triggers file download.

**Parameters:**
- `content: string` - File content
- `format: ExportFormat` - File format
- `filename: string` - Original filename
- `includeTimestamp?: boolean` - Add timestamp to filename (default: true)

#### `isBrowserCompatible()`

Checks if browser supports file downloads.

**Returns:** `boolean`

### Validation

#### `validateTranscriptForExport(transcript)`

Validates transcript data before export.

**Returns:**
```typescript
{
  valid: boolean;
  error?: string;
}
```

## Types

### ExportFormat

```typescript
type ExportFormat = 'txt' | 'json' | 'srt' | 'vtt';
```

### ExportOptions

```typescript
interface ExportOptions {
  /** Include timestamp in filename (default: true) */
  includeTimestamp?: boolean;
  /** Custom filename (overrides original) */
  customFilename?: string;
}
```

### ExportResult

```typescript
interface ExportResult {
  success: boolean;
  format: ExportFormat;
  filename?: string;
  error?: string;
}
```

## Error Handling

All export functions return `ExportResult` with detailed error information:

```typescript
const result = exportTranscript(transcript, 'json');

if (!result.success) {
  switch (result.error) {
    case 'Content cannot be empty':
      // Handle empty content
      break;
    case 'Browser does not support file downloads':
      // Handle browser incompatibility
      break;
    default:
      // Handle other errors
  }
}
```

## Browser Compatibility

The export module requires:
- `Blob` API
- `URL.createObjectURL()` API
- `document.createElement()`

All modern browsers (Chrome, Firefox, Safari, Edge) are supported.

Use `isBrowserCompatible()` to check at runtime:

```typescript
import { isBrowserCompatible } from '@/lib/export';

if (!isBrowserCompatible()) {
  alert('Your browser does not support file downloads');
}
```

## Edge Cases Handled

1. **Empty Transcripts**: Provides fallback behavior
2. **Missing Segments**: Falls back to full text
3. **Special Characters**: Proper sanitization and encoding
4. **Large Files**: Validates content size before download
5. **Browser Limitations**: Checks compatibility before operations
6. **Memory Management**: Cleans up blob URLs after download

## Performance Considerations

- Blob creation is synchronous but fast
- File download is non-blocking
- Memory cleanup is automatic with timeout
- No external dependencies for core functionality

## Testing

Test with various transcript scenarios:

```typescript
// Empty transcript
const emptyTranscript = { /* minimal data */ };
exportToTXT(emptyTranscript);

// Single segment
const singleSegment = { segments: [{ /* one segment */ }] };
exportToJSON(singleSegment);

// Large transcript (100+ segments)
const largeTranscript = { segments: Array(150).fill({ /* ... */ }) };
exportToSRT(largeTranscript);

// Special characters
const specialChars = { text: "Quote: \"Hello\" & 'World'" };
exportToVTT(specialChars);
```

## Future Enhancements

Potential additions:
- PDF export with formatting
- DOCX export for Word
- Custom template support
- Batch export multiple transcripts
- Scheduled exports
- Cloud storage integration
