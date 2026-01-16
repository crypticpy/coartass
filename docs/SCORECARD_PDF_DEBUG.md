# Scorecard PDF Export Debug Report

## Issue Summary

The scorecard PDF export feature fails with a generic "PDF generation failed" error. The underlying error is React error #31: "Objects are not valid as a React child (found: object with keys {$$typeof, type, key, props, _owner, _store})".

This error indicates that a React element is being passed where a primitive (string, number, null) is expected.

## Resolution (Current Approach)

To restore a working "Export PDF" button for scorecards, we switched scorecard PDF export to the client-side React-PDF exporter (same approach already used for transcript PDF export), avoiding the broken server-side `renderToBuffer` route execution path in Next.js App Router.

## Error Details

```
Error: Minified React error #31; visit https://reactjs.org/docs/error-decoder.html?invariant=31&args[]=object%20with%20keys%20%7B%24%24typeof%2C%20type%2C%20key%2C%20props%2C%20_owner%2C%20_store%7D&args[]=
```

The error originates from `@react-pdf/reconciler/lib/reconciler-23.js` during the `renderToBuffer` call.

## Files Involved

### Primary Files
| File | Purpose |
|------|---------|
| `lib/pdf/scorecard-pdf.tsx` | Main PDF component for scorecard rendering |
| `app/api/pdf/scorecard/route.ts` | API route that handles PDF generation requests |
| `components/rtass/scorecard-viewer.tsx` | Client component with Export PDF button |

### Related Working Files (for comparison)
| File | Purpose |
|------|---------|
| `lib/pdf/transcript-pdf.tsx` | Working PDF component for transcripts |
| `app/api/pdf/transcript/route.ts` | Working API route for transcript PDFs |

### Type Definitions
| File | Purpose |
|------|---------|
| `types/rtass.ts` | TypeScript types for RtassScorecard, RtassRubricTemplate, etc. |

## Troubleshooting Attempts

### 1. Added String() Coercion to Dynamic Fields

**Hypothesis:** Some fields in the PDF weren't being coerced to strings, causing React to receive objects as children.

**Changes made to `lib/pdf/scorecard-pdf.tsx`:**

| Line | Before | After |
|------|--------|-------|
| 626 | `{transcriptFilename}` | `{String(transcriptFilename)}` |
| 633 | `{incidentInfo.incidentNumber}` | `{String(incidentInfo.incidentNumber)}` |
| 648 | `{incidentInfo.location}` | `{String(incidentInfo.location)}` |
| 655 | `{rubric.name} v{rubric.version}` | `{String(rubric.name \|\| '')} v{String(rubric.version \|\| '')}` |
| 668-675 | Direct `scorecard.modelInfo` access | Added null check + String() coercion |
| 755 | `{criterion.verdict.replace("_", " ")}` | `{String(criterion.verdict \|\| '').replace("_", " ")}` |

**Result:** Error persisted. Type-check passed.

### 2. Created Minimal Inline PDF Component

**Hypothesis:** Something in the complex scorecard PDF component was causing the issue.

**Test:** Created a minimal PDF component directly in the route file with just a title and text:

```typescript
function MinimalTestPDF({ title }: { title: string }) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: minimalStyles.page },
      React.createElement(Text, { style: minimalStyles.title }, String(title)),
      React.createElement(Text, { style: minimalStyles.text }, "This is a minimal test PDF.")
    )
  );
}
```

**Result:** Same error occurred. This ruled out the scorecard-pdf.tsx component as the source.

### 3. Used TranscriptPDFDocument in Scorecard Route

**Hypothesis:** Something specific to the scorecard route is causing the issue.

**Test:** Imported TranscriptPDFDocument (which works in its own route) and used it in the scorecard route with mock data.

**Changes made to `app/api/pdf/scorecard/route.ts`:**

```typescript
import { TranscriptPDFDocument } from "@/lib/pdf/transcript-pdf";

const mockTranscript = {
  id: "test-transcript",
  filename: "test.mp3",
  text: "This is a test transcript.",
  segments: [{ index: 0, start: 0, end: 5, text: "This is a test transcript." }],
  metadata: { model: "whisper-1", duration: 5, fileSize: 1000 },
  createdAt: new Date(),
};

// In POST handler:
const USE_TRANSCRIPT_PDF_TEST = true;
if (USE_TRANSCRIPT_PDF_TEST) {
  pdfBuffer = await renderToBuffer(
    React.createElement(TranscriptPDFDocument, {
      transcript: mockTranscript,
      includeFullText: true,
      includeSegments: true,
    }) as React.ReactElement
  );
}
```

**Result:** SAME ERROR! TranscriptPDFDocument fails in the scorecard route even though it works in its own route. This definitively proves the issue is NOT in the PDF components but in the scorecard route itself or its compilation.

### 4. Verified No Version Conflicts

**Check:** Ran `npm ls react @react-pdf/renderer` to verify consistent versions.

**Findings:**
- React: 18.3.1 (consistent across all packages)
- @react-pdf/renderer: 4.3.1
- @react-pdf/reconciler: 1.1.4

No version conflicts detected.

## Key Observations

1. **Transcript PDF export works** - The exact same `renderToBuffer` call pattern works in `app/api/pdf/transcript/route.ts`

2. **Error occurs in reconciler** - The stack trace shows the error originates in `@react-pdf/reconciler`, not in our code

3. **Minimal components fail too** - Even a "Hello World" PDF fails when rendered from the scorecard route

4. **The error signature** - `{$$typeof, type, key, props, _owner, _store}` is the internal structure of a React element, suggesting somewhere a React element is being treated as a child value

## Working vs Non-Working Comparison

| Aspect | Transcript Route (Works) | Scorecard Route (Fails) |
|--------|-------------------------|------------------------|
| Import pattern | `import { TranscriptPDFDocument }` | `import { ScorecardPDFDocument }` |
| Logger | `console.error` | `createLogger("PDF.Scorecard")` |
| Data transformation | Simple (createdAt only) | Complex (createdAt, rubric dates, incidentInfo dates) |
| Props passed | 3 props | 4 props (with optional undefined) |

## Current State

The `app/api/pdf/scorecard/route.ts` file currently has:
- Import of TranscriptPDFDocument for testing
- Mock transcript data
- Toggle flag `USE_TRANSCRIPT_PDF_TEST = true` to test with working component

## Critical Finding

**TranscriptPDFDocument also fails in the scorecard route!**

This is the smoking gun:
- TranscriptPDFDocument works perfectly in `/api/pdf/transcript`
- TranscriptPDFDocument FAILS with the same React error #31 in `/api/pdf/scorecard`
- The exact same component, the exact same mock data, different route = different result

This definitively proves the issue is NOT in any PDF component. The problem is specific to how the scorecard route file is being compiled or executed by Next.js.

## Next Steps to Try

1. ~~Test TranscriptPDFDocument in scorecard route~~ - **DONE: Same error**
2. **Clear .next cache** - Run `rm -rf .next` and restart dev server - **DONE**
3. **Compare route file imports** - Check if scorecard route has different imports that could cause issues
4. **Copy transcript route code** - Replace scorecard route with exact transcript route code to test
5. **Check for conflicting imports** - The logger or type imports might be causing issues
6. **Create new route file** - Create a fresh `/api/pdf/scorecard-test/route.ts` to test

## How to Reproduce

1. Start dev server: `npm run dev`
2. Navigate to a transcript with a scorecard: `http://localhost:3000/transcripts/TMMTHQ7kw4FX_KAVzZLHF`
3. Click on "Scorecard" tab
4. Click "Export PDF" button
5. Observe error in browser console and server logs

## Server Log Location

Server logs are output to the terminal running `npm run dev`. Key log lines:
- `[PDF.Scorecard] Received PDF generation request`
- `[PDF.Scorecard] Generating PDF { scorecardId: '...', sectionCount: N, hasRubric: true/false }`
- `[PDF.Scorecard] Scorecard PDF generation error { message: '...', stack: '...' }`
