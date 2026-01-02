# Validation Library - Quick Reference

## Import from Central Location

```typescript
import {
  // Config validation
  validateEnvironmentVariables,
  buildOpenAIConfig,

  // Template validation
  validateTemplateInput,
  validateTemplateSection,
  validateLucideIcon,

  // Transcript validation
  validateFileUpload,
  validateTranscript,
  validateTranscriptSegment,

  // Type guards
  isOutputFormat,
  isTemplateCategory,
  isSupportedAudioType,

  // Utilities
  getSupportedAudioTypes,
  getMaxFileSizeMB,
  getCommonLucideIcons,
} from '@/lib/validations';

// Sanitization
import {
  sanitizeHtml,
  sanitizeFilename,
  sanitizeUrl,
  sanitizeText,
} from '@/lib/sanitize';
```

## Common Use Cases

### 1. Validate File Upload

```typescript
import { validateFileUpload, safeValidateFileUpload } from '@/lib/validations';

// Throwing version (use in try-catch)
try {
  const validated = validateFileUpload({
    file,
    name: file.name,
    size: file.size,
    type: file.type,
  });
  await uploadFile(validated);
} catch (error) {
  showError(error.message);
}

// Non-throwing version (use for form validation)
const result = safeValidateFileUpload(fileData);
if (result.success) {
  await uploadFile(result.data);
} else {
  setFormErrors(result.error.format());
}
```

### 2. Validate Template Creation

```typescript
import { validateTemplateInput } from '@/lib/validations';
import { sanitizeText } from '@/lib/sanitize';

const validated = validateTemplateInput({
  name: sanitizeText(formData.name),
  description: sanitizeText(formData.description),
  icon: formData.icon, // Already validated by form
  category: formData.category,
  sections: formData.sections,
  outputs: formData.outputs,
  isCustom: true,
});
```

### 3. Validate Environment Variables

```typescript
import { validateEnvironmentVariables } from '@/lib/validations';

// In app startup or API route
const env = validateEnvironmentVariables(process.env);
// env is now type-safe and validated
```

### 4. Sanitize User Input

```typescript
import { sanitizeHtml, sanitizeText, sanitizeFilename } from '@/lib/sanitize';

// Before displaying user content
const safeContent = sanitizeHtml(userInput);

// Before using in search or text operations
const cleanText = sanitizeText(userInput);

// Before saving files
const safeFilename = sanitizeFilename(userProvidedName);
```

### 5. Type Guards

```typescript
import { isOutputFormat, isSupportedAudioType } from '@/lib/validations';

if (isOutputFormat(userSelection)) {
  // TypeScript knows this is 'bullet_points' | 'paragraph' | 'table'
}

if (isSupportedAudioType(file.type)) {
  // File type is supported
}
```

## Validation Schemas Available

### Config (`lib/validations/config.ts`)
- `azureOpenAIConfigSchema` - Azure OpenAI configuration
- `standardOpenAIConfigSchema` - Standard OpenAI configuration
- `environmentVariablesSchema` - All environment variables

### Template (`lib/validations/template.ts`)
- `templateSchema` - Complete template
- `templateInputSchema` - Template creation (no ID/timestamp)
- `templateSectionSchema` - Individual section
- `outputFormatSchema` - Output format enum
- `templateCategorySchema` - Category enum
- `lucideIconSchema` - Icon name validation

### Transcript (`lib/validations/transcript.ts`)
- `transcriptSchema` - Complete transcript
- `transcriptSegmentSchema` - Individual segment
- `transcriptMetadataSchema` - Metadata
- `fileUploadSchema` - File upload validation
- `transcriptionProgressSchema` - Progress tracking
- `transcriptionStatusSchema` - Status enum

## Sanitization Functions

### HTML & Text
- `sanitizeHtml(input)` - Escape HTML entities (prevent XSS)
- `stripHtmlTags(html)` - Remove HTML tags
- `sanitizeText(input)` - Clean text (remove control chars, normalize whitespace)

### Files & URLs
- `sanitizeFilename(filename)` - Safe filename (no path traversal)
- `sanitizeUrl(url, protocols)` - Validate URL with allowed protocols
- `sanitizeObjectUrl(url)` - Validate blob:/data: URLs

### Data
- `sanitizeEmail(email)` - Validate and normalize email
- `sanitizeNumber(input, min, max)` - Validate numeric input
- `sanitizeTimestamp(timestamp)` - Validate timestamp

### Identifiers
- `createSafeId(input)` - Create safe HTML/CSS ID
- `sanitizeSpeaker(speaker)` - Clean speaker name

## Constants & Utilities

```typescript
import {
  getSupportedAudioTypes,
  getSupportedAudioExtensions,
  getMaxFileSize,
  getMaxFileSizeMB,
  getCommonLucideIcons,
} from '@/lib/validations';

// Get supported file formats
const types = getSupportedAudioTypes();
// ['audio/mpeg', 'audio/mp4', 'audio/wav', ...]

const extensions = getSupportedAudioExtensions();
// ['.mp3', '.m4a', '.wav', ...]

// Get file size limits
const maxBytes = getMaxFileSize(); // 26214400 (25MB)
const maxMB = getMaxFileSizeMB(); // 25

// Get icon names for UI
const icons = getCommonLucideIcons();
// ['Mic', 'FileAudio', 'FileText', ...]
```

## Error Handling

### Format Zod Errors

```typescript
import { formatValidationError } from '@/lib/validations';
import { z } from 'zod';

try {
  validateSomething(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    const formatted = formatValidationError(error);
    console.error(formatted);
    // Output:
    // name: Template name cannot be empty
    // sections: Template must have at least one section
  }
}
```

### Display Form Errors

```typescript
const result = safeValidateTemplateInput(formData);
if (!result.success) {
  const formatted = result.error.format();

  // Access specific field errors
  if (formatted.name?._errors) {
    setNameError(formatted.name._errors[0]);
  }
  if (formatted.sections?._errors) {
    setSectionsError(formatted.sections._errors[0]);
  }
}
```

## Limits & Constraints

### File Upload
- **Max Size**: 25MB per chunk (OpenAI Whisper limit, larger files are converted/split client-side)
- **Min Size**: 1KB
- **Max Duration**: 4 hours
- **Min Duration**: 1 second
- **Supported Formats**: MP3, M4A, WAV, WebM, OGG, FLAC, AAC

### Templates
- **Sections**: 1-20 per template
- **Outputs**: 1-4 per template
- **Section Prompt**: 10-2000 characters
- **Template Name**: 1-100 characters
- **Template Description**: 10-500 characters

### Transcripts
- **Segments**: 1-10,000 per transcript
- **Segment Text**: 1-5,000 characters
- **Transcript Text**: 1-1,000,000 characters
- **Filename**: 1-255 characters

### Configuration
- **API Key**: Min 20 characters
- **Deployment Name**: 1-64 alphanumeric + hyphens/underscores
- **API Version**: Format YYYY-MM-DD or YYYY-MM-DD-preview

## Type Inference

All schemas provide automatic type inference:

```typescript
import { templateInputSchema } from '@/lib/validations';
import { z } from 'zod';

// Infer TypeScript type from schema
type TemplateInput = z.infer<typeof templateInputSchema>;

// Same as:
// type TemplateInput = {
//   name: string;
//   description: string;
//   icon: string;
//   category: 'meeting' | 'interview' | 'review' | 'custom';
//   sections: TemplateSection[];
//   outputs: ('summary' | 'action_items' | 'quotes' | 'decisions')[];
//   isCustom: boolean;
// }
```

## Best Practices

1. **Always validate at boundaries** (API routes, form submissions, file uploads)
2. **Always sanitize before display** (use `sanitizeHtml` for user content)
3. **Use safe variants in UI** (use `safeValidate*` functions for forms)
4. **Combine validation + sanitization** (sanitize before validating)
5. **Provide clear error messages** (use `formatValidationError`)

## Full Example: Template Form

```typescript
import { useState } from 'react';
import { safeValidateTemplateInput } from '@/lib/validations';
import { sanitizeText } from '@/lib/sanitize';

function TemplateForm() {
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const result = safeValidateTemplateInput({
      name: sanitizeText(formData.get('name')),
      description: sanitizeText(formData.get('description')),
      icon: formData.get('icon'),
      category: formData.get('category'),
      sections: JSON.parse(formData.get('sections')),
      outputs: formData.getAll('outputs'),
      isCustom: true,
    });

    if (!result.success) {
      const formatted = result.error.format();
      setErrors({
        name: formatted.name?._errors?.[0],
        description: formatted.description?._errors?.[0],
        // ... other fields
      });
      return;
    }

    // Validation passed, save template
    await saveTemplate(result.data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" />
      {errors.name && <span className="error">{errors.name}</span>}
      {/* ... other fields */}
    </form>
  );
}
```

## See Also

- [VALIDATION_SUMMARY.md](../../VALIDATION_SUMMARY.md) - Comprehensive documentation
- [config.ts](./config.ts) - Environment variable validation
- [template.ts](./template.ts) - Template validation
- [transcript.ts](./transcript.ts) - Transcript validation
- [../sanitize.ts](../sanitize.ts) - Input sanitization
