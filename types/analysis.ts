/**
 * Analysis Type Definitions
 *
 * Types for AI-powered analysis results, including extracted evidence,
 * structured outputs, and content from transcripts.
 */

import type { AnalysisStrategy } from '@/lib/analysis-strategy';
import type { EnrichmentMetadata } from './enrichment';

/**
 * Evidence citation linking extracted content back to the source transcript.
 * Provides timestamp-based references for verification and context.
 */
export interface Evidence {
  /** Verbatim quote from the transcript */
  text: string;

  /** Start timestamp in seconds */
  start: number;

  /** End timestamp in seconds */
  end: number;

  /** Relevance score (0-1) indicating how well this supports the extraction */
  relevance: number;
}

/**
 * A single section of analysis results with supporting evidence.
 */
export interface AnalysisSection {
  /** Name of the section (from template) */
  name: string;

  /** Extracted and formatted content */
  content: string;

  /** Array of evidence citations supporting this content */
  evidence: Evidence[];
}

/**
 * Represents an agenda item from a meeting.
 * Used for relationship mapping with decisions and action items.
 */
export interface AgendaItem {
  /** Unique identifier for this agenda item */
  id: string;

  /** Description of the agenda topic */
  topic: string;

  /** Timestamp in seconds when this agenda item was discussed */
  timestamp?: number;

  /** Optional context or notes about the agenda item */
  context?: string;
}

/**
 * Benchmark assessment status for fireground review.
 *
 * - met: explicitly observed/announced on radio traffic
 * - missed: expected but not announced (coachability/compliance concern)
 * - not_observed: not stated; may be unknown applicability
 * - not_applicable: clearly not applicable to this incident
 */
export type BenchmarkStatus = 'met' | 'missed' | 'not_observed' | 'not_applicable';

/**
 * Benchmark/milestone observation extracted from radio traffic for training/compliance review.
 */
export interface BenchmarkObservation {
  /** Unique identifier for this benchmark row */
  id: string;

  /** Benchmark label (e.g., "Command established", "Primary search complete") */
  benchmark: string;

  /** Assessment status */
  status: BenchmarkStatus;

  /** Timestamp in seconds when the benchmark was announced/observed (if any) */
  timestamp?: number;

  /** Unit or role associated with the benchmark (if stated) */
  unitOrRole?: string;

  /** Short verbatim evidence quote from the transcript (if available) */
  evidenceQuote?: string;

  /** Optional notes for context (kept brief) */
  notes?: string;
}

/**
 * Standard radio report types used in fireground review.
 */
export type RadioReportType =
  | 'initial_radio_report'
  | 'follow_up_360'
  | 'entry_report'
  | 'command_transfer_company_officer'
  | 'command_transfer_chief'
  | 'can_report'
  | 'other';

/**
 * Structured radio report extracted from transcript.
 */
export interface RadioReport {
  /** Unique identifier for this report */
  id: string;

  /** Type of report */
  type: RadioReportType;

  /** Timestamp in seconds when the report occurred */
  timestamp: number;

  /** Speaking unit or role (if identifiable) */
  from?: string;

  /**
   * Structured fields extracted from the report.
   * Kept flexible to support variations across incidents and policies.
   */
  fields?: Record<string, unknown>;

  /** Required fields that were missing/incomplete (for compliance coaching) */
  missingRequired?: string[];

  /** Short verbatim quote capturing the core of the report (if helpful) */
  evidenceQuote?: string;
}

/**
 * Safety/accountability event types for fireground review.
 */
export type SafetyEventType =
  | 'par'
  | 'mayday'
  | 'urgent_traffic'
  | 'evacuation_order'
  | 'strategy_change'
  | 'ric_established'
  | 'safety_officer_assigned'
  | 'rehab'
  | 'utilities_hazard'
  | 'collapse_hazard'
  | 'other';

/**
 * Severity level for safety events.
 */
export type SafetyEventSeverity = 'info' | 'warning' | 'critical';

/**
 * Safety/accountability event extracted from radio traffic.
 */
export interface SafetyEvent {
  /** Unique identifier for this event */
  id: string;

  /** Type of safety event */
  type: SafetyEventType;

  /** Severity level for prioritization in review */
  severity: SafetyEventSeverity;

  /** Timestamp in seconds when the event occurred */
  timestamp: number;

  /** Unit or role associated with the event (if identifiable) */
  unitOrRole?: string;

  /** Brief description of what happened */
  details: string;

  /** Optional evidence quote */
  evidenceQuote?: string;
}

/**
 * Priority level for action items (enrichment field).
 * Inferred from urgency language in the transcript.
 */
export type ActionPriority = 'high' | 'medium' | 'low';

/**
 * Represents a single action item extracted from the transcript.
 */
export interface ActionItem {
  /** Unique identifier for this action item */
  id: string;

  /** Description of the task to be completed */
  task: string;

  /** Optional person responsible for the task */
  owner?: string;

  /** Optional deadline (can be relative or absolute) */
  deadline?: string;

  /**
   * Timestamp in seconds when the action item was mentioned.
   * REQUIRED: Extracted from [MM:SS] markers in the transcript.
   */
  timestamp: number;

  /**
   * Optional array of agenda item IDs this action item relates to.
   * Enables linking action items back to specific agenda topics.
   */
  agendaItemIds?: string[];

  /**
   * Optional array of decision IDs that spawned this action item.
   * Links actions to the decisions that created them.
   */
  decisionIds?: string[];

  // ============ Enrichment Fields (optional) ============

  /**
   * Who assigned or mentioned this action item (speaker).
   * Populated by enrichment engine.
   */
  assignedBy?: string;

  /**
   * Timestamp when the assignment occurred.
   * May differ from task timestamp if task was mentioned before assignment.
   * Populated by enrichment engine.
   */
  assignmentTimestamp?: number;

  /**
   * Inferred priority based on urgency language.
   * Populated by enrichment engine.
   */
  priority?: ActionPriority;

  /**
   * Whether the action was explicitly stated vs inferred from context.
   * Populated by enrichment engine.
   */
  isExplicit?: boolean;

  /**
   * Confidence score (0-1) for this action item extraction.
   * Populated by enrichment engine.
   */
  confidence?: number;
}

/**
 * Vote tally for decisions that involved voting (enrichment field).
 */
export interface VoteTally {
  /** Number of votes in favor */
  for: number;

  /** Number of votes against */
  against: number;

  /** Number of abstentions */
  abstain: number;
}

/**
 * Represents a decision made during the meeting or discussion.
 */
export interface Decision {
  /** Unique identifier for this decision */
  id: string;

  /** Description of the decision */
  decision: string;

  /** Timestamp in seconds when the decision was made */
  timestamp: number;

  /** Optional context or rationale for the decision */
  context?: string;

  /**
   * Optional array of agenda item IDs this decision relates to.
   * Links decisions back to the agenda topics they address.
   */
  agendaItemIds?: string[];

  // ============ Enrichment Fields (optional) ============

  /**
   * Who made or announced the decision.
   * Populated by enrichment engine.
   */
  madeBy?: string;

  /**
   * People who participated in the discussion leading to this decision.
   * Populated by enrichment engine.
   */
  participants?: string[];

  /**
   * Whether the decision was explicitly stated vs inferred from context.
   * Populated by enrichment engine.
   */
  isExplicit?: boolean;

  /**
   * Vote tally if the decision involved voting.
   * Populated by enrichment engine.
   */
  voteTally?: VoteTally;

  /**
   * Confidence score (0-1) for this decision extraction.
   * Populated by enrichment engine.
   */
  confidence?: number;
}

/**
 * Category for notable quotes (enrichment field).
 * Helps organize and filter quotes by their significance.
 */
export type QuoteCategory =
  | 'decision'    // Quote about a decision being made
  | 'commitment'  // Quote expressing a commitment or promise
  | 'concern'     // Quote expressing concern or objection
  | 'insight'     // Quote providing valuable insight
  | 'humor';      // Memorable humorous moment

/**
 * Sentiment classification for quotes (enrichment field).
 */
export type QuoteSentiment = 'positive' | 'negative' | 'neutral';

/**
 * Represents a notable quote from the transcript.
 */
export interface Quote {
  /** The quoted text */
  text: string;

  /** Optional speaker attribution */
  speaker?: string;

  /** Timestamp in seconds when the quote occurred */
  timestamp: number;

  // ============ Enrichment Fields (optional) ============

  /**
   * Why this quote is notable or important.
   * Populated by enrichment engine.
   */
  context?: string;

  /**
   * Category of the quote.
   * Populated by enrichment engine.
   */
  category?: QuoteCategory;

  /**
   * Sentiment of the quote.
   * Populated by enrichment engine.
   */
  sentiment?: QuoteSentiment;

  /**
   * Confidence score (0-1) for this quote extraction.
   * Populated by enrichment engine.
   */
  confidence?: number;
}

/**
 * Complete results from analyzing a transcript with a template.
 */
export interface AnalysisResults {
  /** Optional overall summary of the transcript */
  summary?: string;

  /** Array of extracted sections (defined by template) */
  sections: AnalysisSection[];

  /** Optional extracted agenda items (for relationship mapping) */
  agendaItems?: AgendaItem[];

  /** Optional benchmark/milestone observations (fireground review) */
  benchmarks?: BenchmarkObservation[];

  /** Optional structured radio reports/CAN logs (fireground review) */
  radioReports?: RadioReport[];

  /** Optional safety/accountability events (fireground review) */
  safetyEvents?: SafetyEvent[];

  /** Optional extracted action items */
  actionItems?: ActionItem[];

  /** Optional extracted decisions */
  decisions?: Decision[];

  /** Optional notable quotes */
  quotes?: Quote[];
}

/**
 * Results from the self-evaluation pass that reviews and improves the analysis.
 */
export interface EvaluationResults {
  /** List of improvements made to the draft analysis */
  improvements: string[];

  /** List of additions made during evaluation */
  additions: string[];

  /** Self-assessed quality score (0-10) */
  qualityScore: number;

  /** Explanation of why changes were made */
  reasoning: string;

  /** Warnings about potential issues or missing content */
  warnings?: string[];

  /** Notes about orphaned items (e.g., decisions without agenda items) */
  orphanedItems?: {
    decisionsWithoutAgenda?: string[];
    actionItemsWithoutDecisions?: string[];
    agendaItemsWithoutDecisions?: string[];
  };
}

/**
 * Complete analysis record linking a transcript to its analyzed results.
 */
export interface Analysis {
  /** Unique identifier for this analysis */
  id: string;

  /** ID of the transcript that was analyzed */
  transcriptId: string;

  /** ID of the template used for analysis */
  templateId: string;

  /**
   * Analysis strategy used for this analysis.
   * Determines processing approach (single-pass, batched, or cascading).
   */
  analysisStrategy: AnalysisStrategy;

  /**
   * Draft results before self-evaluation pass (optional).
   * Stored to allow before/after comparison in UI.
   */
  draftResults?: AnalysisResults;

  /**
   * Results from the self-evaluation pass (optional).
   * Includes improvements, additions, and quality assessment.
   */
  evaluation?: EvaluationResults;

  /** The complete analysis results (post-evaluation if evaluation was run) */
  results: AnalysisResults;

  /**
   * Metadata about the analysis execution (optional).
   * Includes information about strategy selection, timing, and quality.
   */
  metadata?: {
    estimatedDuration: string;
    apiCalls: string;
    quality: string;
    actualTokens: number;
    wasAutoSelected: boolean;
  };

  /**
   * Metadata about enrichment execution (optional).
   * Present when enrichment engine was run on the analysis.
   */
  enrichmentMetadata?: EnrichmentMetadata;

  /** Timestamp when the analysis was created */
  createdAt: Date;
}

/**
 * Type guard to validate evidence relevance score.
 */
export function isValidRelevanceScore(score: number): boolean {
  return score >= 0 && score <= 1;
}

/**
 * Helper type for creating evidence (ensures valid relevance score).
 */
export type EvidenceInput = Omit<Evidence, 'relevance'> & {
  relevance: number;
};

/**
 * Helper type for analysis creation (before ID and timestamp are assigned).
 */
export type AnalysisInput = Omit<Analysis, 'id' | 'createdAt'>;

/**
 * Helper type for updating analysis fields (all fields optional except ID).
 */
export type AnalysisUpdate = Partial<Omit<Analysis, 'id'>> & Pick<Analysis, 'id'>;

/**
 * Progress tracking for long-running analysis operations.
 */
export interface AnalysisProgress {
  /** Current section being processed */
  currentSection?: string;

  /** Progress percentage (0-100) */
  progress: number;

  /** Current status message */
  message: string;

  /** Whether the analysis is complete */
  complete: boolean;

  /** Error message if analysis failed */
  error?: string;
}

/**
 * Configuration options for analysis execution.
 */
export interface AnalysisConfig {
  /** Whether to extract evidence citations */
  includeEvidence: boolean;

  /** Whether to extract benchmark/milestone observations */
  extractBenchmarks: boolean;

  /** Whether to extract structured radio reports/CAN logs */
  extractRadioReports: boolean;

  /** Whether to extract safety/accountability events */
  extractSafetyEvents: boolean;

  /** Whether to extract action items */
  extractActionItems: boolean;

  /** Whether to extract decisions */
  extractDecisions: boolean;

  /** Whether to extract notable quotes */
  extractQuotes: boolean;

  /** Maximum number of evidence citations per section */
  maxEvidencePerSection?: number;

  /** Minimum relevance score for evidence (0-1) */
  minRelevanceScore?: number;

  /**
   * Analysis strategy to use.
   * If 'auto', strategy is selected based on transcript length.
   * If a specific strategy is provided, it overrides the auto-selection.
   */
  strategy?: AnalysisStrategy | 'auto';

  /**
   * Whether to run self-evaluation pass after main analysis.
   * Adds extra processing time but improves quality and completeness.
   */
  runEvaluation?: boolean;
}

/**
 * Default analysis configuration.
 */
export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  includeEvidence: true,
  extractBenchmarks: true,
  extractRadioReports: true,
  extractSafetyEvents: true,
  extractActionItems: true,
  extractDecisions: true,
  extractQuotes: true,
  maxEvidencePerSection: 5,
  minRelevanceScore: 0.7,
  strategy: 'auto',
  runEvaluation: true,
};

/**
 * Statistics about an analysis for display purposes.
 */
export interface AnalysisStats {
  /** Total number of sections analyzed */
  totalSections: number;

  /** Total number of evidence citations */
  totalEvidence: number;

  /** Number of benchmark observations extracted */
  benchmarkCount: number;

  /** Number of radio reports extracted */
  radioReportCount: number;

  /** Number of safety events extracted */
  safetyEventCount: number;

  /** Number of action items extracted */
  actionItemCount: number;

  /** Number of decisions extracted */
  decisionCount: number;

  /** Number of quotes extracted */
  quoteCount: number;

  /** Total word count of extracted content */
  wordCount: number;
}

/**
 * Helper function to calculate statistics from analysis results.
 */
export function calculateAnalysisStats(results: AnalysisResults): AnalysisStats {
  const totalEvidence = results.sections.reduce(
    (sum, section) => sum + (section.evidence?.length || 0),
    0
  );

  const wordCount = results.sections.reduce(
    (sum, section) => sum + section.content.split(/\s+/).length,
    0
  ) + (results.summary?.split(/\s+/).length || 0);

  return {
    totalSections: results.sections.length,
    totalEvidence,
    benchmarkCount: results.benchmarks?.length || 0,
    radioReportCount: results.radioReports?.length || 0,
    safetyEventCount: results.safetyEvents?.length || 0,
    actionItemCount: results.actionItems?.length || 0,
    decisionCount: results.decisions?.length || 0,
    quoteCount: results.quotes?.length || 0,
    wordCount,
  };
}
