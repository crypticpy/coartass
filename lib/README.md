# Database Wrapper Documentation

This directory contains the IndexedDB wrapper implementation using Dexie.js for the Meeting Transcriber application.

## Overview

The database wrapper provides a type-safe interface for storing and managing:
- **Transcripts**: Audio transcription data with segments and metadata
- **Templates**: Analysis templates that define how transcripts are processed
- **Analyses**: Results from analyzing transcripts with templates

## Architecture

### Database Schema

#### Transcripts Table
- **Primary Key**: `id` (string)
- **Indexes**: `filename`, `createdAt`, `metadata.duration`
- **Purpose**: Stores transcription results with timing information and metadata

#### Templates Table
- **Primary Key**: `id` (string)
- **Indexes**: `category`, `isCustom`, `createdAt`, `name`
- **Purpose**: Stores analysis templates (both built-in and custom)

#### Analyses Table
- **Primary Key**: `id` (string)
- **Indexes**: `transcriptId`, `templateId`, `createdAt`
- **Purpose**: Stores analysis results linking transcripts and templates

## API Reference

### Initialization

```typescript
import getDatabase from './lib/db';

// Get the database instance (singleton)
const db = getDatabase();
```

### Transcript Operations

#### saveTranscript(transcript: Transcript): Promise<string>
Saves a transcript to the database.

```typescript
import { saveTranscript } from './lib/db';

const transcript: Transcript = {
  id: 'transcript-1',
  filename: 'meeting.mp3',
  text: 'Full transcript...',
  segments: [...],
  createdAt: new Date(),
  metadata: {
    model: 'whisper-1',
    fileSize: 1024000,
    duration: 300
  }
};

const id = await saveTranscript(transcript);
```

#### getTranscript(id: string): Promise<Transcript | undefined>
Retrieves a transcript by ID.

```typescript
const transcript = await getTranscript('transcript-1');
if (transcript) {
  console.log(transcript.filename);
}
```

#### getAllTranscripts(): Promise<Transcript[]>
Retrieves all transcripts, sorted by creation date (newest first).

```typescript
const transcripts = await getAllTranscripts();
```

#### deleteTranscript(id: string): Promise<void>
Deletes a transcript and all associated analyses.

```typescript
await deleteTranscript('transcript-1');
```

### Template Operations

#### saveTemplate(template: Template): Promise<string>
Saves a template to the database.

```typescript
const template: Template = {
  id: 'template-1',
  name: 'Meeting Notes',
  description: 'Extract meeting notes',
  icon: 'FileText',
  category: 'meeting',
  sections: [...],
  outputs: ['summary'],
  isCustom: true,
  createdAt: new Date()
};

await saveTemplate(template);
```

#### getTemplate(id: string): Promise<Template | undefined>
Retrieves a template by ID.

```typescript
const template = await getTemplate('template-1');
```

#### getAllTemplates(): Promise<Template[]>
Retrieves all templates.

```typescript
const templates = await getAllTemplates();
```

#### deleteTemplate(id: string): Promise<void>
Deletes a custom template and all associated analyses.

**Note**: Only custom templates (isCustom === true) can be deleted.

```typescript
try {
  await deleteTemplate('template-1');
} catch (error) {
  if (error.code === 'NOT_CUSTOM') {
    console.error('Cannot delete built-in templates');
  }
}
```

### Analysis Operations

#### saveAnalysis(analysis: Analysis): Promise<string>
Saves an analysis to the database.

```typescript
const analysis: Analysis = {
  id: 'analysis-1',
  transcriptId: 'transcript-1',
  templateId: 'template-1',
  results: {
    sections: [...],
    actionItems: [...],
  },
  createdAt: new Date()
};

await saveAnalysis(analysis);
```

#### getAnalysisByTranscript(transcriptId: string): Promise<Analysis[]>
Retrieves all analyses for a specific transcript.

```typescript
const analyses = await getAnalysisByTranscript('transcript-1');
```

#### deleteAnalysis(id: string): Promise<void>
Deletes an analysis by ID.

```typescript
await deleteAnalysis('analysis-1');
```

### Storage Monitoring

#### getStorageEstimate(): Promise<StorageEstimate>
Gets storage quota and usage information.

```typescript
const estimate = await getStorageEstimate();
console.log(`Used: ${estimate.usageFormatted}`);
console.log(`Quota: ${estimate.quotaFormatted}`);
console.log(`Percent: ${estimate.percentUsed?.toFixed(2)}%`);
```

#### calculateStorageUsage(): Promise<UsageStats>
Calculates detailed storage usage by counting records.

```typescript
const usage = await calculateStorageUsage();
console.log(`Transcripts: ${usage.transcriptCount}`);
console.log(`Templates: ${usage.templateCount}`);
console.log(`Analyses: ${usage.analysisCount}`);
```

## Error Handling

All database operations can throw a `DatabaseError` with specific error codes:

```typescript
import { DatabaseError } from './lib/db';

try {
  await saveTranscript(transcript);
} catch (error) {
  if (error instanceof DatabaseError) {
    switch (error.code) {
      case 'QUOTA_EXCEEDED':
        // Storage quota exceeded
        console.error('Storage full!');
        break;
      case 'NOT_CUSTOM':
        // Attempted to delete built-in template
        console.error('Cannot delete built-in templates');
        break;
      case 'INDEXEDDB_NOT_SUPPORTED':
        // IndexedDB not available
        console.error('Browser not supported');
        break;
      default:
        console.error(error.message);
    }
  }
}
```

### Error Codes

- `INDEXEDDB_NOT_SUPPORTED`: Browser doesn't support IndexedDB
- `QUOTA_EXCEEDED`: Storage quota exceeded
- `SAVE_FAILED`: Failed to save record
- `GET_FAILED`: Failed to retrieve record
- `GET_ALL_FAILED`: Failed to retrieve multiple records
- `DELETE_FAILED`: Failed to delete record
- `NOT_FOUND`: Record not found
- `NOT_CUSTOM`: Attempted to delete non-custom template
- `STORAGE_API_NOT_SUPPORTED`: Storage estimation not available
- `STORAGE_ESTIMATE_FAILED`: Failed to get storage estimate
- `USAGE_CALCULATION_FAILED`: Failed to calculate usage
- `DATABASE_DELETE_FAILED`: Failed to delete database

## Browser Compatibility

The database wrapper requires:
- IndexedDB support (all modern browsers)
- StorageManager API for storage estimates (optional, gracefully degrades)

## Data Integrity

### Referential Integrity
The wrapper maintains referential integrity through transactions:

- Deleting a transcript also deletes all associated analyses
- Deleting a template also deletes all associated analyses

### Date Handling
All date fields are automatically converted to JavaScript `Date` objects when saving, regardless of input format.

## Performance Considerations

### Indexing
The database uses strategic indexes for common query patterns:
- Transcripts are indexed by creation date for chronological sorting
- Analyses are indexed by transcript ID and template ID for efficient lookups
- Templates are indexed by category and custom flag for filtering

### Transactions
Multiple related operations use transactions to ensure atomicity:
- Deletion operations that affect multiple tables
- Maintaining referential integrity

## Security

- All data is stored locally in the user's browser
- No data is transmitted to external servers
- Quota limits prevent unbounded storage growth
- Custom error handling prevents exposure of sensitive information

## Maintenance

### Database Closure
```typescript
import { closeDatabase } from './lib/db';

// Close database connection (e.g., on app unmount)
closeDatabase();
```

### Database Deletion
```typescript
import { deleteDatabase } from './lib/db';

// WARNING: Permanently deletes all data!
await deleteDatabase();
```

## Testing

See `db.test.example.ts` for example usage and test cases.

## Future Enhancements

Potential improvements:
- Database versioning and migrations
- Bulk operations for better performance
- Full-text search across transcripts
- Export/import functionality
- Database backup and restore
- Sync with cloud storage (optional)

## Contributing

When modifying the database wrapper:
1. Maintain TypeScript strict mode compliance
2. Add comprehensive JSDoc comments
3. Handle all error cases explicitly
4. Maintain referential integrity
5. Update this documentation
6. Add example usage to `db.test.example.ts`
