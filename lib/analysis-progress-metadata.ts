/**
 * Analysis Progress Metadata
 *
 * Provides strategy-specific metadata for progress tracking, including:
 * - Time estimates based on strategy type
 * - Progress phases with messages for each strategy
 * - Progress calculation helpers
 */

import type { Template } from '@/types';
import type { AnalysisStrategy } from '@/lib/analysis-strategy';

/**
 * Metadata about an analysis strategy
 */
export interface StrategyMetadata {
  /** Strategy identifier */
  strategy: AnalysisStrategy;
  /** Display name for UI */
  displayName: string;
  /** Number of API calls this strategy makes */
  apiCalls: number;
  /** Estimated time range in seconds (min, max) */
  estimatedTime: [number, number];
  /** Whether this strategy runs in batches */
  batched: boolean;
  /** Additional time if evaluation is enabled (seconds) */
  evaluationTime: number;
}

/**
 * A phase in the analysis progress
 */
export interface ProgressPhase {
  /** Phase identifier */
  id: string;
  /** Display name for this phase */
  name: string;
  /** Progress range for this phase [start%, end%] */
  range: [number, number];
  /** Message to display during this phase */
  message: string;
  /** Optional detailed description */
  description?: string;
}

/**
 * Get metadata for a strategy
 */
export function getStrategyMetadata(strategy: AnalysisStrategy): StrategyMetadata {
  // Time estimates updated for GPT-5.2 model upgrade
  const metadata: Record<AnalysisStrategy, StrategyMetadata> = {
    basic: {
      strategy: 'basic',
      displayName: 'Basic Analysis',
      apiCalls: 1,
      estimatedTime: [120, 240],  // 2-4 min (GPT-5.2)
      batched: false,
      evaluationTime: 60,  // ~1 min additional
    },
    hybrid: {
      strategy: 'hybrid',
      displayName: 'Hybrid Analysis',
      apiCalls: 3,
      estimatedTime: [240, 360],  // 4-6 min (GPT-5.2)
      batched: true,
      evaluationTime: 75,  // ~1.25 min additional
    },
    advanced: {
      strategy: 'advanced',
      displayName: 'Advanced Analysis',
      apiCalls: 10, // Average: can be 9-11 depending on template
      estimatedTime: [360, 480],  // 6-8 min (GPT-5.2)
      batched: false,
      evaluationTime: 90,  // ~1.5 min additional
    },
  };

  return metadata[strategy];
}

/**
 * Calculate total estimated time for an analysis
 */
export function calculateEstimatedTime(
  strategy: AnalysisStrategy,
  sectionCount: number,
  runEvaluation: boolean
): number {
  const meta = getStrategyMetadata(strategy);

  // Base time from strategy metadata
  let baseTime = (meta.estimatedTime[0] + meta.estimatedTime[1]) / 2;

  // Adjust for section count (updated for GPT-5.2)
  if (strategy === 'advanced') {
    // Advanced is roughly linear with sections
    baseTime = 40 * sectionCount + 120; // ~40 sec per section + 2 min overhead
  } else if (strategy === 'hybrid') {
    // Hybrid is based on batches (3 batches regardless of sections)
    baseTime = 300; // ~5 min relatively constant
  } else {
    // Basic is one call, scales slightly with sections
    baseTime = 120 + (sectionCount * 8); // 2 min base + 8 sec per section
  }

  // Add evaluation time if enabled
  if (runEvaluation) {
    baseTime += meta.evaluationTime;
  }

  return baseTime;
}

/**
 * Get progress phases for a strategy
 */
export function getStrategyPhases(
  strategy: AnalysisStrategy,
  template: Template,
  runEvaluation: boolean
): ProgressPhase[] {
  switch (strategy) {
    case 'basic':
      return getBasicPhases(runEvaluation);

    case 'hybrid':
      return getHybridPhases(template, runEvaluation);

    case 'advanced':
      return getAdvancedPhases(template, runEvaluation);

    default:
      return getBasicPhases(runEvaluation);
  }
}

/**
 * Get phases for basic strategy
 */
function getBasicPhases(runEvaluation: boolean): ProgressPhase[] {
  const phases: ProgressPhase[] = [
    {
      id: 'analysis',
      name: 'Analysis',
      range: [5, runEvaluation ? 70 : 85],
      message: 'Running comprehensive analysis...',
      description: 'Analyzing all sections in a single pass',
    },
  ];

  if (runEvaluation) {
    phases.push({
      id: 'evaluation',
      name: 'Quality Review',
      range: [70, 85],
      message: 'Running quality review and self-evaluation...',
      description: 'Reviewing analysis for accuracy, completeness, and relationship mapping',
    });
  }

  phases.push({
    id: 'saving',
    name: 'Saving',
    range: [85, 100],
    message: 'Saving analysis results...',
    description: 'Storing analysis in database',
  });

  return phases;
}

/**
 * Get phases for hybrid strategy
 */
function getHybridPhases(template: Template, runEvaluation: boolean): ProgressPhase[] {
  // Hybrid groups sections into 3 batches:
  // 1. Foundation: agenda, summary
  // 2. Discussion: key points, topics, decisions
  // 3. Action: action items, next steps, follow-ups

  // Try semantic grouping first
  let foundationSections = template.sections.filter(s =>
    s.name.toLowerCase().includes('agenda') ||
    s.name.toLowerCase().includes('summary')
  );

  let actionSections = template.sections.filter(s =>
    s.name.toLowerCase().includes('action') ||
    s.name.toLowerCase().includes('next step') ||
    s.name.toLowerCase().includes('follow')
  );

  let discussionSections = template.sections.filter(
    s => !foundationSections.includes(s) && !actionSections.includes(s)
  );

  // Fallback to index-based grouping if semantic grouping produces poor distribution
  const hasPoorDistribution =
    foundationSections.length === 0 ||
    actionSections.length === 0 ||
    discussionSections.length === 0 ||
    discussionSections.length > template.sections.length * 0.8; // > 80% in one batch

  if (hasPoorDistribution && template.sections.length >= 3) {
    // Divide sections into thirds by index
    const thirdSize = Math.ceil(template.sections.length / 3);
    foundationSections = template.sections.slice(0, thirdSize);
    discussionSections = template.sections.slice(thirdSize, thirdSize * 2);
    actionSections = template.sections.slice(thirdSize * 2);
  } else if (template.sections.length < 3) {
    // Too few sections for batching, treat as single batch
    discussionSections = template.sections;
    foundationSections = [];
    actionSections = [];
  }

  const phases: ProgressPhase[] = [
    {
      id: 'batch1',
      name: 'Foundation Batch',
      range: [5, 27],
      message: `Processing batch 1/3: Foundation sections${foundationSections.length > 0 ? ` (${foundationSections.map(s => s.name).join(', ')})` : ''}...`,
      description: 'Analyzing agenda and summary sections',
    },
    {
      id: 'batch2',
      name: 'Discussion Batch',
      range: [27, 55],
      message: `Processing batch 2/3: Discussion sections${discussionSections.length > 0 ? ` (${discussionSections.slice(0, 2).map(s => s.name).join(', ')}${discussionSections.length > 2 ? '...' : ''})` : ''}...`,
      description: 'Analyzing discussion and decision sections',
    },
    {
      id: 'batch3',
      name: 'Action Batch',
      range: [55, runEvaluation ? 70 : 85],
      message: `Processing batch 3/3: Action sections${actionSections.length > 0 ? ` (${actionSections.map(s => s.name).join(', ')})` : ''}...`,
      description: 'Analyzing action items and next steps',
    },
  ];

  if (runEvaluation) {
    phases.push({
      id: 'evaluation',
      name: 'Quality Review',
      range: [70, 85],
      message: 'Running quality review and self-evaluation...',
      description: 'Reviewing analysis for accuracy, completeness, and relationship mapping',
    });
  }

  phases.push({
    id: 'saving',
    name: 'Saving',
    range: [85, 100],
    message: 'Saving analysis results...',
    description: 'Storing analysis in database',
  });

  return phases;
}

/**
 * Get phases for advanced strategy
 *
 * Progress budget allocation:
 * - Initialization: [0, 5]     (not tracked in phases)
 * - Analysis:       [5, 70]    (65 points divided among sections)
 * - Evaluation:     [70, 85]   (15 points, optional)
 * - Saving:         [85, 100]  (15 points, always)
 */
function getAdvancedPhases(template: Template, runEvaluation: boolean): ProgressPhase[] {
  const sectionCount = template.sections.length;

  // Guard against invalid section counts
  if (sectionCount <= 0) {
    console.warn('[Analysis Progress] Advanced strategy requires at least one section, falling back to basic phases');
    return getBasicPhases(runEvaluation);
  }

  const phases: ProgressPhase[] = [];
  const analysisEndProgress = runEvaluation ? 70 : 85;

  // For very large section counts, group sections to avoid too many phases
  const maxDisplayPhases = 10;
  const shouldGroup = sectionCount > maxDisplayPhases;

  if (shouldGroup) {
    // Group sections for display
    const phaseGroupSize = Math.ceil(sectionCount / maxDisplayPhases);
    const actualPhaseCount = Math.ceil(sectionCount / phaseGroupSize);
    const progressPerPhase = (analysisEndProgress - 5) / actualPhaseCount;

    for (let i = 0; i < actualPhaseCount; i++) {
      const startIdx = i * phaseGroupSize;
      const endIdx = Math.min((i + 1) * phaseGroupSize - 1, sectionCount - 1);
      const groupSections = template.sections.slice(startIdx, endIdx + 1);
      const groupNames = groupSections.map(s => s.name).join(', ');

      // Ensure continuous phases: each phase start = previous phase end
      const startProgress = i === 0 ? 5 : phases[i - 1].range[1];
      const endProgress = i === actualPhaseCount - 1
        ? analysisEndProgress
        : Math.round(5 + ((i + 1) * progressPerPhase));

      phases.push({
        id: `sections-${startIdx + 1}-${endIdx + 1}`,
        name: groupNames.length > 40 ? `${groupNames.substring(0, 37)}...` : groupNames,
        range: [startProgress, endProgress],
        message: `Analyzing ${groupNames} with full context...`,
        description: `Processing with cascading context from previous sections`,
      });
    }
  } else {
    // Show individual sections with actual names
    const progressPerSection = (analysisEndProgress - 5) / sectionCount;

    for (let i = 0; i < sectionCount; i++) {
      const section = template.sections[i];
      // Ensure continuous phases: each phase start = previous phase end
      const startProgress = i === 0 ? 5 : phases[i - 1].range[1];
      const endProgress = i === sectionCount - 1
        ? analysisEndProgress
        : Math.round(5 + ((i + 1) * progressPerSection));

      phases.push({
        id: `section-${section.id}`,
        name: section.name,
        range: [startProgress, endProgress],
        message: `Analyzing ${section.name} with full context...`,
        description: i > 0
          ? `Processing with cascading context from previous ${i} section${i > 1 ? 's' : ''}`
          : 'Processing first section',
      });
    }
  }

  if (runEvaluation) {
    phases.push({
      id: 'evaluation',
      name: 'Quality Review',
      range: [70, 85],
      message: 'Running quality review and self-evaluation...',
      description: 'Reviewing analysis for accuracy, completeness, and relationship mapping',
    });
  }

  phases.push({
    id: 'saving',
    name: 'Saving',
    range: [85, 100],
    message: 'Saving analysis results...',
    description: 'Storing analysis in database',
  });

  return phases;
}

/**
 * Get current phase based on progress percentage
 */
export function getCurrentPhase(
  progress: number,
  phases: ProgressPhase[]
): ProgressPhase | null {
  for (const phase of phases) {
    if (progress >= phase.range[0] && progress <= phase.range[1]) {
      return phase;
    }
  }
  return null;
}

/**
 * Calculate progress within a phase
 */
export function calculatePhaseProgress(
  elapsedSeconds: number,
  totalEstimatedSeconds: number,
  phases: ProgressPhase[]
): { progress: number; phase: ProgressPhase | null } {
  // Calculate overall progress (0-100)
  const overallProgress = Math.min(95, (elapsedSeconds / totalEstimatedSeconds) * 100);

  // Find current phase
  const currentPhase = getCurrentPhase(overallProgress, phases);

  return {
    progress: Math.round(overallProgress),
    phase: currentPhase,
  };
}

/**
 * Format time remaining for display
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get strategy icon for UI display
 */
export function getStrategyIcon(strategy: AnalysisStrategy): string {
  const icons: Record<AnalysisStrategy, string> = {
    basic: '⚡',
    hybrid: '🔄',
    advanced: '🎯',
  };

  return icons[strategy];
}

/**
 * Get strategy color for UI display
 */
export function getStrategyColor(strategy: AnalysisStrategy): string {
  const colors: Record<AnalysisStrategy, string> = {
    basic: 'blue',
    hybrid: 'violet',
    advanced: 'grape',
  };

  return colors[strategy];
}

/**
 * Progress range constants for section-based progress tracking
 * Used by advanced strategy to calculate per-section completion
 */
export const SECTION_PROGRESS_START = 5;
export const SECTION_PROGRESS_END = 80;

/**
 * Get display time range string for a strategy (e.g., "2-4", "4-6", "6-8")
 * Returns the estimated time range in minutes for user display
 */
export function getDisplayTimeRange(strategy: AnalysisStrategy): string {
  const meta = getStrategyMetadata(strategy);
  const minMinutes = Math.round(meta.estimatedTime[0] / 60);
  const maxMinutes = Math.round(meta.estimatedTime[1] / 60);
  return `${minMinutes}-${maxMinutes}`;
}
