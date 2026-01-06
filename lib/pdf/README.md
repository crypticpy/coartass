# PDF Export Functionality

Professional PDF generation for transcripts and analysis results using `@react-pdf/renderer`.

## Features

- Professional business report styling
- Timestamped transcript segments
- Analysis results with evidence citations
- Action items table
- Decisions timeline
- Notable quotes section
- Table of contents for analysis PDFs
- Automatic pagination and page numbers
- Client-side and server-side generation support

## Installation

Dependencies are already installed:
- `@react-pdf/renderer` - React components for PDF generation
- `@types/react-pdf` - TypeScript definitions

## Usage

### Client-Side PDF Export

#### Export Transcript

```tsx
import { exportAndDownloadTranscript } from '@/lib/pdf';

// Simple export with default options
const result = await exportAndDownloadTranscript(transcript);

if (result.success) {
  console.log('PDF downloaded successfully');
} else {
  console.error('Export failed:', result.error);
}

// With custom options
const result = await exportAndDownloadTranscript(transcript, {
  includeFullText: true,
  includeSegments: true,
});
```

#### Export Analysis

```tsx
import { exportAndDownloadAnalysis } from '@/lib/pdf';

// Export analysis with transcript context
const result = await exportAndDownloadAnalysis(
  analysis,
  transcript,
  {
    template,  // optional
    includeTableOfContents: true,
  }
);
```

#### Manual PDF Generation

```tsx
import { exportTranscriptToPDF, triggerPDFDownload } from '@/lib/pdf';

// Generate PDF blob without downloading
const result = await exportTranscriptToPDF(transcript, {
  includeFullText: true,
  includeSegments: true,
});

if (result.success && result.blob) {
  // Use the blob as needed
  // For example, upload to server or store locally

  // Or trigger download manually
  triggerPDFDownload(result.blob, 'my-transcript.pdf');
}
```

### Server-Side PDF Export

#### Transcript PDF API

```tsx
// POST /api/pdf/transcript
const response = await fetch('/api/pdf/transcript', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    transcript: myTranscript,
    includeFullText: true,
    includeSegments: true,
  }),
});

if (response.ok) {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  // Trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transcript.pdf';
  a.click();

  URL.revokeObjectURL(url);
}
```

#### Analysis PDF API

```tsx
// POST /api/pdf/analysis
const response = await fetch('/api/pdf/analysis', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    analysis: myAnalysis,
    transcript: myTranscript,
    template: myTemplate,  // optional
    includeTableOfContents: true,
  }),
});

if (response.ok) {
  const blob = await response.blob();
  // Handle blob
}
```

## PDF Document Structure

### Transcript PDF

```
┌─────────────────────────────────────┐
│ Header                               │
│ - Title: "Transcript"                │
│ - Filename                           │
│ - Generation date                    │
├─────────────────────────────────────┤
│ Metadata                             │
│ - File, Created, Duration            │
│ - File Size, Language, Model         │
│ - Segment count                      │
├─────────────────────────────────────┤
│ Full Transcript                      │
│ - Continuous text (if enabled)       │
├─────────────────────────────────────┤
│ Timestamped Segments                 │
│ [00:00 - 00:05] Speaker Name         │
│ Transcript text...                   │
│                                      │
│ [00:05 - 00:12] Speaker Name         │
│ More text...                         │
├─────────────────────────────────────┤
│ Footer                               │
│ - Filename | Page X of Y             │
│ - Branding                           │
└─────────────────────────────────────┘
```

### Analysis PDF

```
┌─────────────────────────────────────┐
│ Header                               │
│ - Title: "Analysis Report"           │
│ - Source filename                    │
│ - Template name                      │
│ - Generation date                    │
├─────────────────────────────────────┤
│ Metadata                             │
│ - Source file, Analyzed date         │
│ - Template, Category                 │
│ - Counts: sections, actions, etc.    │
├─────────────────────────────────────┤
│ Table of Contents                    │
│ - Executive Summary                  │
│ - Section names                      │
│ - Action Items, Decisions, Quotes    │
├─────────────────────────────────────┤
│ Executive Summary (if available)     │
│ - Summary text                       │
├─────────────────────────────────────┤
│ Analysis Sections                    │
│ Section Name                         │
│ Content text...                      │
│                                      │
│ Evidence Citations:                  │
│ "Quote from transcript"              │
│ 00:10 - 00:15 (Relevance: 90%)      │
├─────────────────────────────────────┤
│ Action Items                         │
│ ┌──────────────────────────────────┐│
│ │ Task │ Owner │ Deadline │ Time  ││
│ ├──────────────────────────────────┤│
│ │ ...  │ ...   │ ...      │ ...   ││
│ └──────────────────────────────────┘│
├─────────────────────────────────────┤
│ Decisions Timeline                   │
│ ▌Decision text                       │
│ ▌Context (if available)              │
│ ▌00:45                               │
├─────────────────────────────────────┤
│ Notable Quotes                       │
│ "Quote text..."                      │
│ — Speaker Name        00:30          │
├─────────────────────────────────────┤
│ Footer                               │
│ - Analysis Report - Filename         │
│ - Page X of Y                        │
└─────────────────────────────────────┘
```

## Styling

PDFs use professional business report styling:
- **Fonts**: Helvetica (system font for reliability)
- **Colors**: Professional grayscale with blue accents
- **Layout**: A4 page size with proper margins
- **Typography**: Clear hierarchy with varying font sizes
- **Spacing**: Consistent padding and margins throughout
- **Tables**: Zebra-striped for readability
- **Citations**: Bordered and indented for clarity

## API Reference

### Client-Side Functions

#### `exportTranscriptToPDF(transcript, options)`

Generates a PDF blob from transcript data.

**Parameters:**
- `transcript: Transcript` - The transcript to export
- `options?: TranscriptPDFOptions`
  - `includeFullText?: boolean` - Include continuous text (default: true)
  - `includeSegments?: boolean` - Include timestamped segments (default: true)

**Returns:** `Promise<PDFExportResult>`
- `success: boolean`
- `blob?: Blob`
- `error?: string`
- `size?: number`

#### `exportAnalysisToPDF(analysis, transcript, options)`

Generates a PDF blob from analysis results.

**Parameters:**
- `analysis: Analysis` - The analysis results
- `transcript: Transcript` - The source transcript
- `options?: AnalysisPDFOptions`
  - `template?: Template` - Template information
  - `includeTableOfContents?: boolean` - Include TOC (default: true)

**Returns:** `Promise<PDFExportResult>`

#### `exportAndDownloadTranscript(transcript, options)`

Convenience function that generates and downloads a transcript PDF.

**Returns:** `Promise<PDFExportResult>`

#### `exportAndDownloadAnalysis(analysis, transcript, options)`

Convenience function that generates and downloads an analysis PDF.

**Returns:** `Promise<PDFExportResult>`

#### `triggerPDFDownload(blob, filename)`

Triggers a browser download for a PDF blob.

**Parameters:**
- `blob: Blob` - The PDF blob to download
- `filename: string` - Desired filename (auto-appends .pdf)

#### `isPDFExportSupported()`

Checks if PDF export is supported in the current environment.

**Returns:** `boolean`

### Server-Side Endpoints

#### `POST /api/pdf/transcript`

Generates a transcript PDF on the server.

**Request Body:**
```typescript
{
  transcript: Transcript;
  includeFullText?: boolean;
  includeSegments?: boolean;
}
```

**Response:** PDF file (application/pdf)

#### `POST /api/pdf/analysis`

Generates an analysis PDF on the server.

**Request Body:**
```typescript
{
  analysis: Analysis;
  transcript: Transcript;
  template?: Template;
  includeTableOfContents?: boolean;
}
```

**Response:** PDF file (application/pdf)

## Performance Considerations

### Client-Side
- **Pros**: No server load, instant feedback
- **Cons**: Browser memory limits for large documents
- Recommended for: Transcripts < 10,000 segments

### Server-Side
- **Pros**: No browser memory limits, reliable
- **Cons**: Server processing time, network transfer
- Recommended for: Large documents, production use

### Memory Estimation

```tsx
import { estimateTranscriptPDFSize, estimateAnalysisPDFSize } from '@/lib/pdf';

const estimatedSize = estimateTranscriptPDFSize(transcript);
console.log(`Estimated PDF size: ${(estimatedSize / 1024).toFixed(2)} KB`);

// Use server-side if estimated size is large
if (estimatedSize > 5 * 1024 * 1024) { // 5 MB
  // Use server-side API
} else {
  // Use client-side export
}
```

## Browser Compatibility

Requires modern browsers with support for:
- Blob API
- URL.createObjectURL
- Download attribute on anchor elements

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### PDF Generation Fails

1. Check browser console for errors
2. Verify transcript data is valid
3. Try server-side generation for large documents
4. Check browser memory limits

### Large PDFs

For transcripts with many segments (>1000):
- Consider using server-side generation
- Split into multiple PDFs if needed
- Reduce included content (e.g., segments only, no full text)

### Styling Issues

- Fonts are limited to system fonts for reliability
- Custom fonts require additional configuration
- Test on multiple browsers for consistent rendering

## Examples

See `/lib/pdf/examples/` for complete working examples.

## License

Part of the Austin RTASS application.
