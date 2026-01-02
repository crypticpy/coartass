# Analysis Components - Multi-Strategy System

This directory contains UI components for the multi-strategy analysis system with self-evaluation support.

## Components

### 1. StrategySelector (`strategy-selector.tsx`)

Allows users to select an analysis strategy with intelligent recommendations and self-evaluation options.

**Features:**
- Radio button selection for: Auto, Basic, Hybrid, Advanced strategies
- Color-coded badges showing time estimates, API calls, and quality levels
- Automatic recommendation based on transcript length
- Warning alerts when manual selection differs from recommendation
- Self-evaluation checkbox (default: enabled)
- Fully responsive design
- Austin Public Health theme colors

**Props:**
```typescript
interface StrategySelectorProps {
  transcriptText: string;              // For recommendation calculation
  value: AnalysisStrategy | 'auto';    // Current selection
  onChange: (strategy: AnalysisStrategy | 'auto') => void;
  runEvaluation: boolean;              // Evaluation toggle state
  onEvaluationChange: (value: boolean) => void;
  disabled?: boolean;                  // Optional: disable controls
}
```

**Usage Example:**
```tsx
import { StrategySelector } from '@/components/analysis/strategy-selector';
import { useState } from 'react';

export function AnalyzeTranscriptPage({ transcript }) {
  const [strategy, setStrategy] = useState<'auto' | AnalysisStrategy>('auto');
  const [runEvaluation, setRunEvaluation] = useState(true);

  return (
    <StrategySelector
      transcriptText={transcript.text}
      value={strategy}
      onChange={setStrategy}
      runEvaluation={runEvaluation}
      onEvaluationChange={setRunEvaluation}
    />
  );
}
```

---

### 2. EvaluationDisplay (`evaluation-display.tsx`)

Displays self-evaluation results with before/after comparison and quality metrics.

**Features:**
- Color-coded quality score (0-10) with progress bar
- Draft vs Final results toggle
- Collapsible accordion sections for:
  - Improvements made
  - Additions made
  - Evaluation reasoning
  - Warnings
  - Orphaned items detection
- Statistics comparison (draft vs final)
- Responsive layout with Mantine Grid

**Props:**
```typescript
interface EvaluationDisplayProps {
  evaluation: EvaluationResults;       // Evaluation metadata
  draftResults: AnalysisResults;       // Pre-evaluation results
  finalResults: AnalysisResults;       // Post-evaluation results
  currentView: 'draft' | 'final';      // Current view mode
  onViewChange: (view: 'draft' | 'final') => void;
  disabled?: boolean;
}
```

**Quality Score Color Mapping:**
- 9-10: Blue (Excellent)
- 7-8: Green (Good)
- 5-6: Yellow (Fair)
- 4: Orange (Below Average)
- 0-3: Red (Poor)

**Usage Example:**
```tsx
import { EvaluationDisplay } from '@/components/analysis/evaluation-display';
import { useState } from 'react';

export function AnalysisResultsPage({ analysis }) {
  const [view, setView] = useState<'draft' | 'final'>('final');

  // Only show if evaluation was run
  if (!analysis.evaluation) return null;

  return (
    <EvaluationDisplay
      evaluation={analysis.evaluation}
      draftResults={analysis.draftResults}
      finalResults={analysis.results}
      currentView={view}
      onViewChange={setView}
    />
  );
}
```

---

### 3. StrategyBadge (`strategy-badge.tsx`)

Compact badge component showing which strategy was used with detailed tooltip.

**Features:**
- Color-coded badge (yellow=basic, cyan=hybrid, purple=advanced)
- Strategy icon (Zap, Scale, Target)
- Auto/Manual selection indicator
- Rich tooltip with metadata on hover
- Multiple size variants
- Bonus: `StrategyIconBadge` for even more compact display

**Props:**
```typescript
interface StrategyBadgeProps {
  strategy: AnalysisStrategy;
  wasAutoSelected?: boolean;           // Default: false
  metadata?: AnalysisExecutionResult['metadata'];
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'filled' | 'light' | 'outline' | 'dot';
  showIcon?: boolean;                  // Default: true
  showSelection?: boolean;             // Default: true
}
```

**Usage Example:**
```tsx
import { StrategyBadge, StrategyIconBadge } from '@/components/analysis/strategy-badge';

export function AnalysisHeader({ analysis }) {
  return (
    <Group gap="xs">
      <Text>Analysis completed using:</Text>

      {/* Full badge */}
      <StrategyBadge
        strategy={analysis.analysisStrategy}
        wasAutoSelected={analysis.metadata?.wasAutoSelected}
        metadata={analysis.metadata}
      />

      {/* Or compact icon-only badge */}
      <StrategyIconBadge
        strategy={analysis.analysisStrategy}
        wasAutoSelected={analysis.metadata?.wasAutoSelected}
      />
    </Group>
  );
}
```

---

## Integration Guide

### Typical Analysis Flow

**Step 1: Let user select strategy**
```tsx
// On /transcripts/[id]/analyze page
const [strategy, setStrategy] = useState<'auto' | AnalysisStrategy>('auto');
const [runEvaluation, setRunEvaluation] = useState(true);

<StrategySelector
  transcriptText={transcript.text}
  value={strategy}
  onChange={setStrategy}
  runEvaluation={runEvaluation}
  onEvaluationChange={setRunEvaluation}
/>

<Button onClick={handleStartAnalysis}>Start Analysis</Button>
```

**Step 2: Execute analysis with selected settings**
```tsx
import { executeAnalysis } from '@/lib/analysis-strategies';

async function handleStartAnalysis() {
  const result = await executeAnalysis(
    template,
    transcript.text,
    openaiClient,
    deployment,
    {
      strategy: strategy, // 'auto' or specific strategy
      runEvaluation: runEvaluation,
      progressCallback: (current, total, message) => {
        // Update progress UI
      }
    }
  );

  // Save to IndexedDB
  await db.analyses.add({
    id: generateId(),
    transcriptId: transcript.id,
    templateId: template.id,
    analysisStrategy: result.strategy,
    results: result.results,
    draftResults: result.draftResults,
    evaluation: result.evaluation,
    createdAt: new Date(),
  });
}
```

**Step 3: Display results with evaluation (if run)**
```tsx
// On analysis results page
const [view, setView] = useState<'draft' | 'final'>('final');

<Stack gap="xl">
  {/* Show which strategy was used */}
  <Group>
    <Text>Analyzed using:</Text>
    <StrategyBadge
      strategy={analysis.analysisStrategy}
      wasAutoSelected={analysis.metadata?.wasAutoSelected}
    />
  </Group>

  {/* Show evaluation results if available */}
  {analysis.evaluation && (
    <EvaluationDisplay
      evaluation={analysis.evaluation}
      draftResults={analysis.draftResults!}
      finalResults={analysis.results}
      currentView={view}
      onViewChange={setView}
    />
  )}

  {/* Show analysis sections (using existing AnalysisViewer) */}
  <AnalysisViewer
    analysis={view === 'draft' ? draftAnalysis : analysis}
    template={template}
  />
</Stack>
```

---

## Type Imports

All necessary types are available from existing modules:

```typescript
// Strategy types
import type { AnalysisStrategy } from '@/lib/analysis-strategy';
import {
  getStrategyRecommendation,
  getStrategyMetadata,
  validateStrategy,
  recommendStrategy,
  formatTimeEstimate
} from '@/lib/analysis-strategy';

// Execution types
import type { AnalysisExecutionResult } from '@/lib/analysis-strategies';
import { executeAnalysis } from '@/lib/analysis-strategies';

// Analysis result types
import type {
  AnalysisResults,
  EvaluationResults,
  Analysis
} from '@/types';
```

---

## Design System

All components follow the existing Mantine theme configuration in `/lib/mantine-theme.ts`:

**Colors:**
- Primary Blue (aphBlue): System defaults, Auto-select
- Yellow (aphYellow): Basic strategy
- Cyan (aphCyan): Hybrid strategy
- Purple (aphPurple): Advanced strategy
- Green (aphGreen): Success, evaluation, quality indicators
- Orange (aphOrange): Warnings
- Red (aphRed): Errors, poor quality
- Gray (aphGray): Neutral states

**Spacing:**
- Gap between elements: `md` (1rem)
- Card padding: `lg` (1.5rem)
- Section padding: `xl` (2rem)

**Accessibility:**
- All interactive elements have proper ARIA labels
- Color-blind friendly color combinations
- Keyboard navigation support
- Screen reader compatible
- WCAG 2.1 AA compliant

---

## Testing Recommendations

**Unit Tests:**
```typescript
// Test strategy recommendation logic
describe('StrategySelector', () => {
  it('recommends basic for short transcripts', () => {
    const shortTranscript = 'Short meeting content...';
    const recommendation = getStrategyRecommendation(shortTranscript);
    expect(recommendation.strategy).toBe('basic');
  });

  it('shows warning when manual override conflicts', () => {
    // Test validation warnings
  });
});
```

**Integration Tests:**
```typescript
// Test full analysis flow
describe('Analysis Flow', () => {
  it('completes auto-selected analysis with evaluation', async () => {
    // 1. Select auto strategy
    // 2. Enable evaluation
    // 3. Execute analysis
    // 4. Verify results contain draft, final, and evaluation
  });
});
```

**Visual Tests:**
```typescript
// Test responsive behavior
describe('Component Responsiveness', () => {
  it('renders correctly on mobile', () => {
    // Test mobile layout
  });

  it('renders correctly on desktop', () => {
    // Test desktop layout
  });
});
```

---

## Migration from Existing Code

If you have existing analysis code, here's how to migrate:

**Before:**
```tsx
// Old single-strategy approach
const results = await analyzeTranscript(transcript, template);
```

**After:**
```tsx
// New multi-strategy approach with evaluation
const result = await executeAnalysis(
  template,
  transcript.text,
  openaiClient,
  deployment,
  {
    strategy: 'auto',  // Let system choose
    runEvaluation: true,
  }
);

// Access results
const strategy = result.strategy;           // Which strategy was used
const finalResults = result.results;        // Final (post-evaluation) results
const draftResults = result.draftResults;   // Draft (pre-evaluation) results
const evaluation = result.evaluation;       // Evaluation metadata
```

---

## Performance Considerations

**Strategy Selection:**
- Auto-select adds <1ms overhead (token counting)
- Recommendation caching via useMemo in components
- No network calls during selection

**Evaluation Display:**
- Accordion lazy-loads section content
- Draft/Final toggle uses client-side state (no re-fetch)
- Statistics calculated once on mount with useMemo

**Memory:**
- Storing both draft and final results adds ~20-40KB per analysis
- Consider cleanup for old analyses if storage is constrained
- IndexedDB handles large datasets efficiently

---

## Future Enhancements

Potential additions for future versions:

1. **Strategy Comparison Tool**: Side-by-side comparison of different strategies on same transcript
2. **Performance Analytics**: Track actual vs estimated processing times
3. **Quality Trends**: Show quality score trends across multiple analyses
4. **Custom Strategy Configuration**: Let users tweak strategy parameters
5. **Evaluation History**: Track improvements across multiple evaluation passes
6. **Export Evaluation Report**: Generate PDF/Markdown report of evaluation results

---

## Support

For questions or issues:
- Check `/lib/analysis-strategies/README.md` for backend documentation
- Review type definitions in `/types/analysis.ts`
- See Mantine documentation: https://mantine.dev
- Contact development team

---

**Last Updated:** 2025-11-23
**Component Version:** 1.0.0
**Mantine Version:** 7.x
