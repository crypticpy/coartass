export type RtassCriterionType = 'boolean' | 'graded' | 'enum' | 'timing';

export type RtassVerdict =
  | 'met'
  | 'missed'
  | 'partial'
  | 'not_observed'
  | 'not_applicable';

export interface RtassEvidence {
  quote: string;
  start: number;
  end?: number;
  speaker?: string;
  relevance?: number;
}

export interface RtassObservedEvent {
  name: string;
  at: number;
}

export interface RtassCriterion {
  id: string;
  title: string;
  description: string;
  required: boolean;
  weight?: number;
  type: RtassCriterionType;
  grading?: {
    minScore?: number;
    maxScore?: number;
  };
  enumOptions?: string[];
  timing?: {
    startEvent: string;
    endEvent: string;
    targetSeconds?: number;
    maxSeconds?: number;
  };
  evidenceRules?: {
    minEvidence: number;
    requireVerbatimQuote?: boolean;
  };
  notes?: string;
}

export interface RtassRubricSection {
  id: string;
  title: string;
  description: string;
  weight: number;
  criteria: RtassCriterion[];
}

export interface RtassScoringConfig {
  method: 'weighted_average';
  thresholds: {
    pass: number;
    needsImprovement: number;
  };
  requiredNotObservedBehavior: 'treat_as_missed' | 'exclude_with_warning';
}

export interface RtassLlmConfig {
  concurrency: number;
  maxRetries: number;
  evidenceQuoteMaxChars: number;
}

export interface RtassRubricTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  jurisdiction?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt?: Date;
  sections: RtassRubricSection[];
  scoring: RtassScoringConfig;
  llm: RtassLlmConfig;
}

export interface RtassScorecardCriterion {
  criterionId: string;
  title: string;
  verdict: RtassVerdict;
  score?: number;
  confidence: number;
  rationale: string;
  evidence: RtassEvidence[];
  observedEvents?: RtassObservedEvent[];
}

export interface RtassScorecardSection {
  sectionId: string;
  title: string;
  weight: number;
  score: number;
  status: 'pass' | 'needs_improvement' | 'fail';
  criteria: RtassScorecardCriterion[];
}

export interface RtassScorecard {
  id: string;
  incidentId: string;
  transcriptId: string;
  rubricTemplateId: string;
  createdAt: Date;
  modelInfo: {
    provider: 'azure-openai' | 'openai';
    model: string;
    deployment?: string;
  };
  overall: {
    score: number;
    status: 'pass' | 'needs_improvement' | 'fail';
    notes?: string;
  };
  sections: RtassScorecardSection[];
  warnings?: string[];
  humanReview?: {
    reviewed: boolean;
    reviewer?: string;
    reviewedAt?: Date;
    notes?: string;
  };
}

