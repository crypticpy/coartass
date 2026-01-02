/**
 * Hybrid Analysis Strategy - Batched Analysis with Context
 *
 * Balanced approach that groups related sections into 3 batches,
 * where each batch receives results from previous batches for context.
 *
 * Processing Time: 4-6 minutes (GPT-5.2)
 * API Calls: 3 calls (one per batch)
 * Quality: Excellent - comprehensive cross-referencing with contextual linking
 *
 * Features:
 * - Foundation Batch: Establishes attendees, agenda items, summary
 * - Discussion Batch: Analyzes discussions and decisions with Foundation context
 * - Action Batch: Extracts action items and next steps with full meeting context
 * - Each batch builds on previous results for coherent relationship mapping
 */

import type {
  Template,
  TemplateSection,
  AnalysisResults,
  AnalysisSection,
  AgendaItem,
  ActionItem,
  Decision,
  Quote,
  EvaluationResults,
} from '@/types';
import type OpenAI from 'openai';
import {
  formatOutputType,
  postProcessResults,
  pruneResultsForTemplate,
  normalizeAnalysisJsonKeys,
  validateTokenLimits,
  ANALYSIS_CONSTANTS,
  logger,
  retryWithBackoff,
  TIMESTAMP_INSTRUCTION,
} from './shared';
import { executeEvaluationPass } from './evaluator';

/**
 * Defines the three batches used in hybrid analysis
 */
export type BatchName = 'foundation' | 'discussion' | 'action';

/**
 * Result from a single batch analysis (raw JSON response)
 */
export interface HybridBatchResponse {
  sections: {
    name: string;
    content: string;
  }[];
  agendaItems?: Array<{
    id: string;
    topic: string;
    timestamp?: number;
    context?: string;
  }>;
  benchmarks?: Array<{
    id: string;
    benchmark: string;
    status: 'met' | 'missed' | 'not_observed' | 'not_applicable';
    timestamp?: number;
    unitOrRole?: string;
    evidenceQuote?: string;
    notes?: string;
  }>;
  radioReports?: Array<{
    id: string;
    type:
      | 'initial_radio_report'
      | 'follow_up_360'
      | 'entry_report'
      | 'command_transfer_company_officer'
      | 'command_transfer_chief'
      | 'can_report'
      | 'other';
    timestamp: number;
    from?: string;
    fields?: Record<string, unknown>;
    missingRequired?: string[];
    evidenceQuote?: string;
  }>;
  safetyEvents?: Array<{
    id: string;
    type:
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
    severity: 'info' | 'warning' | 'critical';
    timestamp: number;
    unitOrRole?: string;
    details: string;
    evidenceQuote?: string;
  }>;
  actionItems?: Array<{
    id: string;
    task: string;
    owner?: string;
    deadline?: string;
    timestamp: number; // Required - extracted from transcript timestamp markers
    agendaItemIds?: string[];
    decisionIds?: string[];
  }>;
  decisions?: Array<{
    id: string;
    decision: string;
    timestamp: number;
    context?: string;
    agendaItemIds?: string[];
  }>;
  quotes?: Array<{
    text: string;
    speaker?: string;
    timestamp: number;
  }>;
  summary?: string;
}

/**
 * Batch configuration with sections and dependencies
 */
interface BatchConfig {
  name: BatchName;
  sections: TemplateSection[];
  description: string;
}

/**
 * Configuration options for hybrid analysis execution
 */
export interface HybridAnalysisConfig {
  /** Whether to run self-evaluation pass after analysis */
  runEvaluation?: boolean;
  /**
   * Supplemental source material text.
   * Extracted from uploaded Word docs, PDFs, PowerPoints, or pasted text.
   * Included in the prompt as additional context but kept separate from
   * the transcript to preserve timestamp citation logic.
   */
  supplementalMaterial?: string;
}

/**
 * Extended result type that includes evaluation metadata
 */
export interface HybridAnalysisResult {
  /** Final analysis results (post-evaluation if runEvaluation=true) */
  results: AnalysisResults;
  /** Draft results before evaluation (only if runEvaluation=true) */
  draftResults?: AnalysisResults;
  /** Evaluation metadata (only if runEvaluation=true) */
  evaluation?: EvaluationResults;
  /** The prompts used for all batches */
  promptsUsed: string[];
}


/**
 * Keywords organized by batch for section name matching.
 * Each array contains synonyms and variations that indicate a section belongs to that batch.
 * Exported for testing and documentation purposes.
 */
export const BATCH_KEYWORDS: Record<BatchName, string[]> = {
  foundation: [
    // Participants
    'attendee', 'attendees', 'participant', 'participants', 'roster', 'present',
    'member', 'members', 'team', 'invitee', 'invitees', 'attendance',
    // Agenda/Topics
    'agenda', 'overview', 'introduction', 'context', 'background', 'purpose',
    'objective', 'objectives', 'goal', 'goals', 'scope',
    // Summary/Overview
    'summary', 'synopsis', 'recap', 'abstract', 'tldr', 'tl;dr', 'executive summary',
    'meeting overview', 'brief', 'briefing', 'highlights', 'key takeaways',
  ],
  discussion: [
    // Discussion content
    'discussion', 'discussions', 'debate', 'deliberation', 'conversation',
    'dialogue', 'exchange', 'talk', 'talking point', 'talking points',
    // Key points
    'key point', 'key points', 'main point', 'main points', 'topic', 'topics',
    'issue', 'issues', 'concern', 'concerns', 'matter', 'matters',
    // Decisions
    'decision', 'decisions', 'resolution', 'resolutions', 'conclusion', 'conclusions',
    'outcome', 'outcomes', 'result', 'results', 'determination', 'ruling',
    'agreement', 'consensus', 'vote', 'approval',
    // Analysis
    'analysis', 'insight', 'insights', 'observation', 'observations',
    'finding', 'findings', 'note', 'notes', 'remark', 'remarks',
    // Quotes
    'quote', 'quotes', 'notable', 'highlight', 'memorable', 'key statement',
  ],
  action: [
    // Action items
    'action', 'action item', 'action items', 'task', 'tasks', 'todo', 'to-do',
    'to do', 'assignment', 'assignments', 'deliverable', 'deliverables',
    'responsibility', 'responsibilities', 'owner', 'ownership',
    // Next steps
    'next step', 'next steps', 'follow-up', 'follow up', 'followup',
    'future', 'upcoming', 'pending', 'timeline', 'schedule', 'deadline',
    'due date', 'milestone', 'milestones', 'plan', 'planning',
    // Commitments
    'commitment', 'commitments', 'pledge', 'promise', 'accountability',
  ],
};

/**
 * Output format signals that suggest batch assignment.
 * Maps output format types to their most likely batch.
 */
const OUTPUT_FORMAT_SIGNALS: Record<string, BatchName> = {
  action_items: 'action',
  decisions: 'discussion',
  quotes: 'discussion',
  // Other formats don't strongly indicate a batch
};

/**
 * Result of batch determination with metadata for logging.
 * Exported for testing and type safety.
 */
export interface BatchDeterminationResult {
  batch: BatchName;
  matchedKeyword: string | null;
  matchSource: 'keyword' | 'output_format' | 'prompt_content' | 'position' | 'default';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Determine which batch a section belongs to based on its name, output format, and prompt content.
 * Uses multiple signals to make intelligent batch assignments.
 *
 * @param section - Template section
 * @param sectionIndex - Position of section in template (0-based)
 * @param totalSections - Total number of sections in template
 * @returns Batch determination result with metadata
 */
function determineBatchWithMetadata(
  section: TemplateSection,
  sectionIndex: number,
  totalSections: number
): BatchDeterminationResult {
  // Handle edge cases
  if (!section.name || section.name.trim() === '') {
    logger.warn('Hybrid Analysis', 'Empty section name detected, using position-based assignment', {
      sectionIndex,
      outputFormat: section.outputFormat,
    });
    return {
      batch: getPositionBasedBatch(sectionIndex, totalSections),
      matchedKeyword: null,
      matchSource: 'position',
      confidence: 'low',
    };
  }

  const nameLower = section.name.toLowerCase().trim();
  const promptLower = section.prompt?.toLowerCase() || '';

  // Priority 1: Check section name against keyword lists
  for (const [batchName, keywords] of Object.entries(BATCH_KEYWORDS) as [BatchName, string[]][]) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) {
        return {
          batch: batchName,
          matchedKeyword: keyword,
          matchSource: 'keyword',
          confidence: 'high',
        };
      }
    }
  }

  // Priority 2: Check output format for strong signals
  const outputFormat = section.outputFormat;
  if (outputFormat && OUTPUT_FORMAT_SIGNALS[outputFormat]) {
    logger.debug('Hybrid Analysis', `Section "${section.name}" matched via output format`, {
      outputFormat,
      assignedBatch: OUTPUT_FORMAT_SIGNALS[outputFormat],
    });
    return {
      batch: OUTPUT_FORMAT_SIGNALS[outputFormat],
      matchedKeyword: null,
      matchSource: 'output_format',
      confidence: 'medium',
    };
  }

  // Priority 3: Analyze prompt content for batch signals
  const promptBatch = analyzePromptContent(promptLower);
  if (promptBatch) {
    logger.debug('Hybrid Analysis', `Section "${section.name}" matched via prompt content analysis`, {
      assignedBatch: promptBatch,
    });
    return {
      batch: promptBatch,
      matchedKeyword: null,
      matchSource: 'prompt_content',
      confidence: 'medium',
    };
  }

  // Priority 4: Position-based fallback with intelligent distribution
  const positionBatch = getPositionBasedBatch(sectionIndex, totalSections);
  logger.info('Hybrid Analysis', `Section "${section.name}" did not match any keywords - using position-based assignment`, {
    sectionIndex,
    totalSections,
    assignedBatch: positionBatch,
    sectionName: section.name,
    promptPreview: section.prompt?.substring(0, 100),
  });

  return {
    batch: positionBatch,
    matchedKeyword: null,
    matchSource: 'position',
    confidence: 'low',
  };
}

/**
 * Analyze prompt content for batch-indicating phrases
 */
function analyzePromptContent(promptLower: string): BatchName | null {
  // Action batch signals in prompt
  const actionPhrases = [
    'list all tasks', 'extract action', 'identify assignments', 'who is responsible',
    'what needs to be done', 'follow-up required', 'next steps', 'deliverables',
    'deadlines', 'due dates', 'assign', 'owner',
  ];
  for (const phrase of actionPhrases) {
    if (promptLower.includes(phrase)) {
      return 'action';
    }
  }

  // Discussion batch signals in prompt
  const discussionPhrases = [
    'what was decided', 'key decisions', 'main points', 'important discussion',
    'notable quotes', 'significant statements', 'conclusions reached',
    'issues raised', 'concerns discussed', 'outcomes of',
  ];
  for (const phrase of discussionPhrases) {
    if (promptLower.includes(phrase)) {
      return 'discussion';
    }
  }

  // Foundation batch signals in prompt
  const foundationPhrases = [
    'who attended', 'list participants', 'meeting purpose', 'agenda items',
    'topics covered', 'provide an overview', 'summarize the meeting',
    'main objectives', 'meeting goals',
  ];
  for (const phrase of foundationPhrases) {
    if (promptLower.includes(phrase)) {
      return 'foundation';
    }
  }

  return null;
}

/**
 * Get batch based on section position using thirds distribution
 */
function getPositionBasedBatch(index: number, total: number): BatchName {
  if (total <= 1) {
    return 'foundation'; // Single section goes to foundation
  }

  const position = index / (total - 1); // 0.0 to 1.0

  if (position < 0.33) {
    return 'foundation';
  } else if (position < 0.67) {
    return 'discussion';
  } else {
    return 'action';
  }
}

/**
 * Legacy wrapper for backward compatibility - exported for testing.
 * Use determineBatchWithMetadata for new code that needs logging.
 *
 * @param section - Template section
 * @returns Batch name
 */
export function determineBatch(section: TemplateSection): BatchName {
  // For legacy calls without position info, use metadata version with reasonable defaults
  const result = determineBatchWithMetadata(section, 0, 1);
  return result.batch;
}

/**
 * Batch assignment statistics for logging and debugging
 */
interface BatchAssignmentStats {
  totalSections: number;
  byBatch: Record<BatchName, number>;
  byMatchSource: Record<string, number>;
  byConfidence: Record<string, number>;
  lowConfidenceSections: string[];
  allInOneBatch: boolean;
}

/**
 * Group template sections into batches with comprehensive logging
 *
 * @param template - Analysis template
 * @returns Array of batch configurations
 */
function groupSectionsIntoBatches(template: Template): BatchConfig[] {
  const foundationSections: TemplateSection[] = [];
  const discussionSections: TemplateSection[] = [];
  const actionSections: TemplateSection[] = [];

  const totalSections = template.sections.length;

  // Track assignment statistics
  const stats: BatchAssignmentStats = {
    totalSections,
    byBatch: { foundation: 0, discussion: 0, action: 0 },
    byMatchSource: {},
    byConfidence: { high: 0, medium: 0, low: 0 },
    lowConfidenceSections: [],
    allInOneBatch: false,
  };

  // Group sections by batch with full metadata
  for (let i = 0; i < template.sections.length; i++) {
    const section = template.sections[i];
    const result = determineBatchWithMetadata(section, i, totalSections);

    // Update statistics
    stats.byBatch[result.batch]++;
    stats.byMatchSource[result.matchSource] = (stats.byMatchSource[result.matchSource] || 0) + 1;
    stats.byConfidence[result.confidence]++;

    if (result.confidence === 'low') {
      stats.lowConfidenceSections.push(section.name);
    }

    // Log individual section assignments for debugging
    logger.debug('Hybrid Analysis', `Section "${section.name}" assigned to ${result.batch}`, {
      matchSource: result.matchSource,
      matchedKeyword: result.matchedKeyword,
      confidence: result.confidence,
    });

    switch (result.batch) {
      case 'foundation':
        foundationSections.push(section);
        break;
      case 'discussion':
        discussionSections.push(section);
        break;
      case 'action':
        actionSections.push(section);
        break;
    }
  }

  // Check for template compatibility issues
  const nonEmptyBatches = [
    foundationSections.length > 0,
    discussionSections.length > 0,
    actionSections.length > 0,
  ].filter(Boolean).length;

  stats.allInOneBatch = nonEmptyBatches === 1 && totalSections > 1;

  // Log batch assignment summary
  logger.info('Hybrid Analysis', 'Batch assignment complete', {
    templateName: template.name,
    totalSections,
    distribution: stats.byBatch,
    matchSources: stats.byMatchSource,
    confidenceLevels: stats.byConfidence,
  });

  // Warn if all sections ended up in one batch (indicates poor template compatibility)
  if (stats.allInOneBatch) {
    const dominantBatch = Object.entries(stats.byBatch)
      .find(([, count]) => count === totalSections)?.[0] || 'unknown';

    logger.warn('Hybrid Analysis',
      `All ${totalSections} sections assigned to "${dominantBatch}" batch - ` +
      `template may not be optimized for hybrid strategy`, {
        templateName: template.name,
        recommendation: 'Consider using Basic strategy for this template, ' +
          'or rename sections to include batch-indicating keywords',
        sectionNames: template.sections.map(s => s.name),
      }
    );
  }

  // Warn if many sections had low-confidence assignments
  const lowConfidenceRatio = stats.byConfidence.low / totalSections;
  if (lowConfidenceRatio > 0.5 && totalSections > 2) {
    logger.warn('Hybrid Analysis',
      `${stats.byConfidence.low} of ${totalSections} sections (${Math.round(lowConfidenceRatio * 100)}%) ` +
      `had low-confidence batch assignments`, {
        templateName: template.name,
        lowConfidenceSections: stats.lowConfidenceSections,
        recommendation: 'Consider renaming sections or updating section prompts ' +
          'to include clearer batch-indicating keywords',
      }
    );
  }

  // Build batch configurations
  const batches: BatchConfig[] = [];

  if (foundationSections.length > 0) {
    batches.push({
      name: 'foundation',
      sections: foundationSections,
      description: 'Establishes meeting foundation: who attended and what topics were discussed',
    });
  }

  if (discussionSections.length > 0) {
    batches.push({
      name: 'discussion',
      sections: discussionSections,
      description: 'Analyzes key discussions and decisions made during the meeting',
    });
  }

  if (actionSections.length > 0) {
    batches.push({
      name: 'action',
      sections: actionSections,
      description: 'Extracts action items and next steps with full meeting context',
    });
  }

  // Final validation: ensure we have at least one batch
  if (batches.length === 0) {
    logger.error('Hybrid Analysis', 'No batches created - template has no sections', {
      templateName: template.name,
    });
    throw new Error(`Template "${template.name}" has no valid sections for hybrid analysis`);
  }

  return batches;
}

/**
 * Generate prompt for a specific batch with context from previous batches
 *
 * @param batch - Batch configuration
 * @param transcript - Full transcript text
 * @param template - Analysis template
 * @param previousResults - Results from previous batches (for context)
 * @returns Prompt string for this batch
 */
export function generateBatchPrompt(
  batch: BatchConfig,
  transcript: string,
  template: Template,
  previousResults?: Partial<AnalysisResults>,
  supplementalMaterial?: string
): string {
  const sectionInstructions = batch.sections
    .map((section, idx) => {
      return `
### Section ${idx + 1}: ${section.name}

**Task**: ${section.prompt}

**Output Format**: ${formatOutputType(section.outputFormat)}

**Requirements**:
- Provide clear, concise content
- For bullet_points: MUST use "-" character ONLY (NOT numbered lists 1,2,3), max ${ANALYSIS_CONSTANTS.MAX_BULLET_POINTS} items, capitalize first letter
- For paragraphs: Continuous prose, ${ANALYSIS_CONSTANTS.MAX_PARAGRAPH_WORDS} words max
- Start with action verbs or key concepts
- Be specific and actionable
`;
    })
    .join('\n');

  // Build context section from previous batch results
  let contextSection = '';
  if (previousResults) {
    contextSection = '\n## Context from Previous Analysis\n\n';

    if (previousResults.summary) {
      contextSection += `**Meeting Summary**: ${previousResults.summary}\n\n`;
    }

    if (previousResults.agendaItems && previousResults.agendaItems.length > 0) {
      contextSection += '**Agenda Items**:\n';
      previousResults.agendaItems.forEach((item) => {
        contextSection += `- [${item.id}] ${item.topic}`;
        if (item.context) {
          contextSection += ` - ${item.context}`;
        }
        contextSection += '\n';
      });
      contextSection += '\n';
    }

    if (previousResults.sections && previousResults.sections.length > 0) {
      contextSection += '**Previously Analyzed Sections**:\n';
      previousResults.sections.forEach((section) => {
        contextSection += `\n**${section.name}**:\n${section.content}\n`;
      });
      contextSection += '\n';
    }

    if (previousResults.decisions && previousResults.decisions.length > 0) {
      contextSection += '**Decisions Made**:\n';
      previousResults.decisions.forEach((dec) => {
        contextSection += `- [${dec.id}] ${dec.decision}`;
        if (dec.agendaItemIds && dec.agendaItemIds.length > 0) {
          contextSection += ` (relates to: ${dec.agendaItemIds.join(', ')})`;
        }
        contextSection += '\n';
      });
      contextSection += '\n';
    }
  }

  // Build relationship instructions based on batch and available context
  let relationshipInstructions = '';

  const hasAgenda = template.sections.some((s) => s.name.toLowerCase().includes('agenda'));
  const hasBenchmarks = template.outputs.includes('benchmarks');
  const hasRadioReports = template.outputs.includes('radio_reports');
  const hasSafetyEvents = template.outputs.includes('safety_events');
  const hasDecisions = template.outputs.includes('decisions');
  const hasActionItems = template.outputs.includes('action_items');

  if (batch.name === 'foundation' && hasAgenda) {
    relationshipInstructions = `
## CRITICAL: Foundation Mapping

You are establishing the foundation for this meeting analysis:

1. **Agenda Items**: Extract and assign unique IDs (e.g., "agenda-1", "agenda-2")
   - Include topic name, timestamp (if available), and brief context
   - These IDs will be used by subsequent analysis batches

2. **Summary**: If requested, provide a concise 3-5 sentence overview capturing:
   - Main topics discussed
   - Key participants
   - Overall meeting purpose

This foundation analysis is ESSENTIAL for subsequent batches to properly link decisions and actions.
`;
  } else if (batch.name === 'discussion') {
    if (hasDecisions && previousResults?.agendaItems) {
      relationshipInstructions = `
## CRITICAL: Discussion and Decision Mapping

Using the foundation context above, analyze discussions and decisions:

1. **Key Discussions**: Extract discussion content as specified in section requirements

2. **Decisions**: Extract ALL decisions made during the meeting:
   - Assign unique IDs (e.g., "decision-1", "decision-2")
   - Include: decision text, timestamp, context/rationale
   - **LINK TO AGENDA ITEMS**: Use agendaItemIds array to link each decision to relevant agenda items
   - Reference the agenda item IDs provided in the context above

**Example**:
If a decision relates to "agenda-2" (Budget Planning), include: "agendaItemIds": ["agenda-2"]

This relationship mapping is ESSENTIAL for coherent meeting minutes.
`;
    } else {
      relationshipInstructions = `
## Discussion Analysis

Analyze the key discussions based on the foundation context provided above.
Extract discussion content as specified in section requirements.
`;
    }
  } else if (batch.name === 'action') {
    if (hasActionItems && (previousResults?.agendaItems || previousResults?.decisions)) {
      relationshipInstructions = `
## CRITICAL: Action Item and Next Steps Mapping

Using the complete meeting context above (agenda items and decisions), extract action items:

1. **Action Items**: Extract ALL tasks, assignments, and follow-up items:
   - Assign unique IDs (e.g., "action-1", "action-2")
   - Include: task description, owner (if mentioned), deadline (if mentioned)
   - TIMESTAMP IS REQUIRED: Use the [MM:SS] markers in the transcript to determine when the action was mentioned (convert to seconds)
   - **LINK TO AGENDA ITEMS**: Use agendaItemIds array to link each action to relevant agenda topics
   - **LINK TO DECISIONS**: Use decisionIds array to link each action to the decisions that spawned it

2. **Next Steps**: Extract next steps content as specified in section requirements

**Example**:
If an action item "John to update budget spreadsheet" relates to "agenda-2" and was created by "decision-3":
Include: "agendaItemIds": ["agenda-2"], "decisionIds": ["decision-3"]

**Orphaned Items**: Note any items that don't map cleanly:
- Action items not tied to any decision
- Actions that arose outside the main agenda

This relationship mapping is ESSENTIAL for tracking accountability and follow-through.
`;
    } else {
      relationshipInstructions = `
## Action Item Analysis

Using the meeting context above, extract action items and next steps as specified in section requirements.
`;
    }
  }

  // Determine what structured outputs this batch should generate
  const structuredOutputs: string[] = [];

  if (batch.name === 'foundation') {
    if (template.outputs.includes('summary')) {
      structuredOutputs.push('summary');
    }
    if (hasAgenda) {
      structuredOutputs.push('agendaItems');
    }
  } else if (batch.name === 'discussion') {
    if (hasDecisions) {
      structuredOutputs.push('decisions');
    }
    if (template.outputs.includes('quotes')) {
      structuredOutputs.push('quotes');
    }
  } else if (batch.name === 'action') {
    if (hasActionItems) {
      structuredOutputs.push('actionItems');
    }

    // Fireground outputs: request once in the final batch to avoid duplicates
    if (hasBenchmarks) structuredOutputs.push('benchmarks');
    if (hasRadioReports) structuredOutputs.push('radioReports');
    if (hasSafetyEvents) structuredOutputs.push('safetyEvents');
  }

  // Build structured outputs section
  let structuredOutputSection = '';
  if (structuredOutputs.length > 0) {
    structuredOutputSection = '\n## Structured Outputs\n\n';

    if (structuredOutputs.includes('summary')) {
      structuredOutputSection += `
**Summary**: Provide a concise 3-5 sentence overview of the entire meeting. Capture:
- Main topics discussed
- Key outcomes
- Overall tone/sentiment
- Next steps (if any)
`;
    }

    if (structuredOutputs.includes('agendaItems')) {
      structuredOutputSection += `
**Agenda Items**: Extract ALL agenda topics as structured objects:
- Assign unique IDs (e.g., "agenda-1", "agenda-2")
- Include: topic description, timestamp (if mentioned), context
`;
    }

    if (structuredOutputs.includes('decisions')) {
      structuredOutputSection += `
**Decisions**: Extract ALL decisions, resolutions, and conclusions as structured objects:
- Assign unique IDs (e.g., "decision-1", "decision-2")
- Include: decision text, context/rationale, timestamp
- Link to agenda items using agendaItemIds array${hasAgenda ? ' (REQUIRED - use IDs from context above)' : ' (if applicable)'}
`;
    }

    if (structuredOutputs.includes('actionItems')) {
      structuredOutputSection += `
**Action Items**: Extract ALL tasks, assignments, and follow-up items as structured objects:
- Assign unique IDs (e.g., "action-1", "action-2")
- Include: task description, owner (if mentioned), deadline (if mentioned)
- TIMESTAMP IS REQUIRED: Use the [MM:SS] markers in the transcript to determine when the action was mentioned (convert to seconds)
- Link to agenda items using agendaItemIds array${hasAgenda ? ' (REQUIRED - use IDs from context above)' : ' (if applicable)'}
- Link to decisions using decisionIds array${hasDecisions ? ' (REQUIRED - use IDs from context above)' : ' (if applicable)'}
`;
    }

    if (structuredOutputs.includes('quotes')) {
      structuredOutputSection += `
**Quotes**: Extract 3-5 notable or impactful quotes:
- Include: exact quote text, speaker (if identifiable), timestamp
- Focus on memorable, insightful, or decision-driving statements
`;
    }

    if (structuredOutputs.includes('benchmarks')) {
      structuredOutputSection += `
**Benchmarks**: Extract benchmark/milestone observations as structured objects:
- Assign unique IDs (e.g., "benchmark-1", "benchmark-2")
- Include: benchmark label, status ("met"|"missed"|"not_observed"|"not_applicable"), timestamp (if observed), unitOrRole (if stated)
- Keep evidenceQuote short when provided
`;
    }

    if (structuredOutputs.includes('radioReports')) {
      structuredOutputSection += `
**Radio Reports**: Extract structured radio report events (initial/360/entry/command transfer/CAN) as objects:
- Assign unique IDs (e.g., "report-1", "report-2")
- TIMESTAMP IS REQUIRED
- Include: type, from (unit/role), fields (concise key/values), missingRequired (if incomplete), evidenceQuote (optional)
`;
    }

    if (structuredOutputs.includes('safetyEvents')) {
      structuredOutputSection += `
**Safety Events**: Extract safety/accountability events (PAR, MAYDAY, evacuation, strategy change, RIC, safety officer, hazards) as objects:
- Assign unique IDs (e.g., "safety-1", "safety-2")
- TIMESTAMP IS REQUIRED
- Include: type, severity (info|warning|critical), unitOrRole (if stated), details (1 sentence), evidenceQuote (optional)
`;
    }
  }

  // Build JSON output format example
  const jsonExample = buildJsonExample(structuredOutputs);

  return `You are an expert fireground radio traffic evaluator for Austin Fire Department (AFD) Training Division. Your task is to analyze this transcript and extract the requested information for the ${batch.name.toUpperCase()} BATCH in a structured JSON response.

## Analysis Guidelines

- **Audience**: AFD training staff and company officers
- **Style**: Clear, concise, scannable for training documentation
- **Focus**: Extract only what was explicitly stated on the radio; do NOT speculate
- **Evidence**: Base analysis strictly on transcript content; if not stated, mark as not stated
- **Completeness**: Address ALL sections and outputs requested for this batch

${TIMESTAMP_INSTRUCTION}

## Timestamp Extraction Example

Given: "[2:45] Engine 25: Engine 25 assuming command, offensive mode"
Extract: { "type": "initial_radio_report", "timestamp": 165, "from": "Engine 25", "fields": { "command": "assumed", "strategy": "offensive" } }
Calculation: [2:45] = (2 × 60) + 45 = 165 seconds

Given: "[11:02] Interior: CAN - conditions heavy heat, actions advancing, needs ventilation"
Extract: { "type": "can_report", "timestamp": 662, "fields": { "conditions": "heavy heat", "actions": "advancing", "needs": "ventilation" } }
Calculation: [11:02] = (11 × 60) + 2 = 662 seconds

${contextSection}
${sectionInstructions}
${relationshipInstructions}
${structuredOutputSection}

## Output Format

You MUST respond with valid JSON in this EXACT structure:

\`\`\`json
${jsonExample}
\`\`\`

${supplementalMaterial ? `## Supplemental Source Material

The following supplemental documents and notes have been provided as additional context.
Use this information to inform your analysis, but note that:
- Timestamps and citations should ONLY reference the transcript (not supplemental material)
- Supplemental material provides background context and should be used to understand terminology, prior discussions, or meeting preparation notes
- Do NOT fabricate timestamps for information found only in supplemental material

${supplementalMaterial}

---

` : ''}## Transcript

${transcript}

## Response

Provide your complete analysis for the ${batch.name.toUpperCase()} BATCH as valid JSON following the structure above. ${previousResults ? 'Ensure all relationship IDs reference the items provided in the context section.' : 'Ensure all IDs are correctly assigned.'}`;
}

/**
 * Build JSON output example for prompt
 */
function buildJsonExample(structuredOutputs: string[]): string {
  const parts: string[] = [];

  // Always include sections array
  parts.push(`  "sections": [
    {
      "name": "Section Name",
      "content": "Extracted content formatted per requirements"
    }
  ]`);

  // Add structured outputs
  if (structuredOutputs.includes('agendaItems')) {
    parts.push(`  "agendaItems": [
    {
      "id": "agenda-1",
      "topic": "Agenda topic",
      "timestamp": 120,
      "context": "Optional context"
    }
  ]`);
  }

  if (structuredOutputs.includes('actionItems')) {
    parts.push(`  "actionItems": [
    {
      "id": "action-1",
      "task": "Task description",
      "owner": "Person name",
      "deadline": "Due date",
      "timestamp": 300,
      "agendaItemIds": ["agenda-1"],
      "decisionIds": ["decision-2"]
    }
  ]`);
  }

  if (structuredOutputs.includes('decisions')) {
    parts.push(`  "decisions": [
    {
      "id": "decision-1",
      "decision": "Decision text",
      "timestamp": 240,
      "context": "Rationale",
      "agendaItemIds": ["agenda-1"]
    }
  ]`);
  }

  if (structuredOutputs.includes('quotes')) {
    parts.push(`  "quotes": [
    {
      "text": "Exact quote",
      "speaker": "Speaker name",
      "timestamp": 180
    }
  ]`);
  }

  if (structuredOutputs.includes('benchmarks')) {
    parts.push(`  "benchmarks": [
    {
      "id": "benchmark-1",
      "benchmark": "Command established",
      "status": "met",
      "timestamp": 120,
      "unitOrRole": "Engine 25",
      "evidenceQuote": "Engine 25 assuming command"
    }
  ]`);
  }

  if (structuredOutputs.includes('radioReports')) {
    parts.push(`  "radioReports": [
    {
      "id": "report-1",
      "type": "initial_radio_report",
      "timestamp": 120,
      "from": "Engine 25",
      "fields": { "strategy": "offensive" },
      "missingRequired": [],
      "evidenceQuote": "Engine 25 assuming command, offensive mode"
    }
  ]`);
  }

  if (structuredOutputs.includes('safetyEvents')) {
    parts.push(`  "safetyEvents": [
    {
      "id": "safety-1",
      "type": "par",
      "severity": "info",
      "timestamp": 900,
      "unitOrRole": "Command",
      "details": "PAR requested following strategy change.",
      "evidenceQuote": "All units stand by for PAR"
    }
  ]`);
  }

  if (structuredOutputs.includes('summary')) {
    parts.push(`  "summary": "Overall meeting summary"`);
  }

  return '{\n' + parts.join(',\n') + '\n}';
}

/**
 * Validate batch response structure
 *
 * @param data - Parsed JSON data
 * @returns true if valid structure
 */
function isValidBatchResponse(data: unknown): data is HybridBatchResponse {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  // Must have sections array
  if (!Array.isArray(obj.sections)) return false;

  // Validate each section
  for (const section of obj.sections) {
    if (
      !section ||
      typeof section !== 'object' ||
      typeof section.name !== 'string' ||
      typeof section.content !== 'string'
    ) {
      return false;
    }
  }

  // Optional arrays must be valid if present
  if (obj.agendaItems !== undefined && !Array.isArray(obj.agendaItems)) return false;
  if (obj.benchmarks !== undefined && !Array.isArray(obj.benchmarks)) return false;
  if (obj.radioReports !== undefined && !Array.isArray(obj.radioReports)) return false;
  if (obj.safetyEvents !== undefined && !Array.isArray(obj.safetyEvents)) return false;
  if (obj.actionItems !== undefined && !Array.isArray(obj.actionItems)) return false;
  if (obj.decisions !== undefined && !Array.isArray(obj.decisions)) return false;
  if (obj.quotes !== undefined && !Array.isArray(obj.quotes)) return false;

  // Summary must be string if present
  if (obj.summary !== undefined && typeof obj.summary !== 'string') return false;

  return true;
}

/**
 * Merge multiple batch responses into complete AnalysisResults
 *
 * @param batchResponses - Array of batch responses
 * @returns Complete AnalysisResults object
 */
function mergeBatchResults(batchResponses: HybridBatchResponse[]): AnalysisResults {
  const allSections: AnalysisSection[] = [];
  let summary: string | undefined;
  const allAgendaItems: AgendaItem[] = [];
  const allBenchmarks: NonNullable<AnalysisResults['benchmarks']> = [];
  const allRadioReports: NonNullable<AnalysisResults['radioReports']> = [];
  const allSafetyEvents: NonNullable<AnalysisResults['safetyEvents']> = [];
  const allActionItems: ActionItem[] = [];
  const allDecisions: Decision[] = [];
  const allQuotes: Quote[] = [];

  // Merge all batch responses
  for (const response of batchResponses) {
    // Merge sections (no evidence in hybrid mode for speed)
    for (const section of response.sections) {
      allSections.push({
        name: section.name,
        content: section.content,
        evidence: [], // Hybrid mode doesn't extract evidence for speed
      });
    }

    // Take first summary found (should be from foundation batch)
    if (response.summary && !summary) {
      summary = response.summary;
    }

    // Merge agenda items
    if (response.agendaItems) {
      for (const item of response.agendaItems) {
        allAgendaItems.push({
          id: item.id,
          topic: item.topic,
          timestamp: item.timestamp,
          context: item.context,
        });
      }
    }

    if (response.benchmarks) {
      allBenchmarks.push(...response.benchmarks);
    }

    if (response.radioReports) {
      allRadioReports.push(...response.radioReports);
    }

    if (response.safetyEvents) {
      allSafetyEvents.push(...response.safetyEvents);
    }

    // Merge action items
    if (response.actionItems) {
      for (const item of response.actionItems) {
        allActionItems.push({
          id: item.id,
          task: item.task,
          owner: item.owner,
          deadline: item.deadline,
          timestamp: item.timestamp,
          agendaItemIds: item.agendaItemIds,
          decisionIds: item.decisionIds,
        });
      }
    }

    // Merge decisions
    if (response.decisions) {
      for (const item of response.decisions) {
        allDecisions.push({
          id: item.id,
          decision: item.decision,
          timestamp: item.timestamp,
          context: item.context,
          agendaItemIds: item.agendaItemIds,
        });
      }
    }

    // Merge quotes
    if (response.quotes) {
      allQuotes.push(...response.quotes);
    }
  }

  return {
    summary,
    sections: allSections,
    agendaItems: allAgendaItems.length > 0 ? allAgendaItems : undefined,
    benchmarks: allBenchmarks.length > 0 ? allBenchmarks : undefined,
    radioReports: allRadioReports.length > 0 ? allRadioReports : undefined,
    safetyEvents: allSafetyEvents.length > 0 ? allSafetyEvents : undefined,
    actionItems: allActionItems.length > 0 ? allActionItems : undefined,
    decisions: allDecisions.length > 0 ? allDecisions : undefined,
    quotes: allQuotes.length > 0 ? allQuotes : undefined,
  };
}

/**
 * Execute hybrid analysis strategy
 *
 * Main entry point for hybrid analysis mode. Groups sections into 3 batches,
 * executes them sequentially with contextual linking, and returns merged results.
 *
 * @param template - Analysis template
 * @param transcript - Full transcript text
 * @param openaiClient - Azure OpenAI client instance
 * @param deployment - GPT deployment name
 * @param progressCallback - Optional callback for progress updates
 * @param config - Optional configuration (evaluation, etc.)
 * @returns Promise<HybridAnalysisResult>
 */
export async function executeHybridAnalysis(
  template: Template,
  transcript: string,
  openaiClient: OpenAI,
  deployment: string,
  progressCallback?: (current: number, total: number, batchName: string) => void,
  config?: HybridAnalysisConfig
): Promise<HybridAnalysisResult> {
  const supplementalMaterial = config?.supplementalMaterial;
  logger.info('Hybrid Analysis', 'Starting batched analysis', {
    hasSupplementalMaterial: !!supplementalMaterial,
    supplementalLength: supplementalMaterial?.length || 0,
  });

  // Group sections into batches
  const batches = groupSectionsIntoBatches(template);
  logger.info('Hybrid Analysis', 'Created batches', {
    batchCount: batches.length,
    batches: batches.map((b) => ({
      name: b.name,
      sectionCount: b.sections.length,
      sections: b.sections.map((s) => s.name),
    })),
  });

  // Store batch responses
  const batchResponses: HybridBatchResponse[] = [];

  // Store accumulated results for context passing
  let accumulatedResults: Partial<AnalysisResults> = {};

  // Track all prompts used
  const promptsUsed: string[] = [];

  // Execute each batch sequentially
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    // Notify progress
    if (progressCallback) {
      progressCallback(i + 1, batches.length, batch.name);
    }

    logger.info('Hybrid Analysis', `Executing batch ${i + 1}/${batches.length}: ${batch.name}`, {
      sectionCount: batch.sections.length,
      hasContext: i > 0,
    });

    // Generate prompt with context from previous batches
    const prompt = generateBatchPrompt(
      batch,
      transcript,
      template,
      i > 0 ? accumulatedResults : undefined,
      supplementalMaterial
    );

    // Track this prompt
    promptsUsed.push(prompt);

    // Validate token limits before API call
    const validation = validateTokenLimits(transcript, prompt, `Hybrid Analysis - ${batch.name}`);
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(w => logger.warn('Hybrid Analysis', w));
    }

    // Make API call with retry logic
    logger.info('Hybrid Analysis', `Making API call for ${batch.name} batch`, {
      deployment,
      contextProvided: i > 0,
    });

    const response = await retryWithBackoff(
      async () => {
        const res = await openaiClient.chat.completions.create({
          model: deployment,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert fireground radio traffic evaluator for Austin Fire Department (AFD) Training Division. ' +
                'You provide structured, accurate analysis of radio traffic transcripts. ' +
                'Do not speculate. If information is not in the transcript, state that it is not stated. ' +
                'Always respond with valid JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_completion_tokens: ANALYSIS_CONSTANTS.MAX_COMPLETION_TOKENS, // GPT-5 requires max_completion_tokens
          response_format: { type: 'json_object' }, // Enforce JSON response
        });

        // Validate response before returning
        const finishReason = res.choices[0].finish_reason;
        const content = res.choices[0].message.content;

        logger.info('Hybrid Analysis', `Received response for ${batch.name} batch`, {
          tokensUsed: res.usage?.total_tokens,
          finishReason: finishReason,
          contentLength: content?.length ?? 0,
        });

        // Handle content filter - retry as it's likely a false positive
        if (finishReason === 'content_filter') {
          logger.warn('Hybrid Analysis', `Content filter triggered for ${batch.name} batch - retrying`);
          throw new Error('RETRY'); // Will be caught by retry logic
        }

        // Handle token limit exceeded - fail fast with actionable error
        if (finishReason === 'length') {
          throw new Error(
            `Response truncated due to token limit for ${batch.name} batch. ` +
            `Consider using Basic strategy for this transcript length.`
          );
        }

        // Handle empty response
        if (!content || content.trim() === '') {
          logger.error('Hybrid Analysis', `Empty response for ${batch.name} batch`, {
            finishReason,
            hasContent: !!content,
            contentLength: content?.length ?? 0,
          });
          throw new Error('RETRY'); // Retry for empty responses
        }

        return res;
      },
      3, // Max 3 retry attempts
      2000 // 2 second initial delay
    );

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error(
        `Empty response from OpenAI for ${batch.name} batch ` +
        `(finish_reason: ${response.choices[0].finish_reason})`
      );
    }

    // Parse JSON response
    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(content);
      parsedResponse = normalizeAnalysisJsonKeys(parsedResponse);
    } catch (error) {
      logger.error('Hybrid Analysis', `Failed to parse JSON for ${batch.name} batch:`, error);
      logger.error('Hybrid Analysis', `Response content:`, content.substring(0, 500));
      throw new Error(`Invalid JSON response from OpenAI for ${batch.name} batch`);
    }

    // Validate structure
    if (!isValidBatchResponse(parsedResponse)) {
      logger.error('Hybrid Analysis', `Invalid response structure for ${batch.name} batch`);
      throw new Error(`Response for ${batch.name} batch does not match expected structure`);
    }

    // Store batch response
    batchResponses.push(parsedResponse);

    // Update accumulated results for next batch context
    const batchSections: AnalysisSection[] = parsedResponse.sections.map((s) => ({
      name: s.name,
      content: s.content,
      evidence: [],
    }));

    accumulatedResults = {
      summary: parsedResponse.summary || accumulatedResults.summary,
      sections: [...(accumulatedResults.sections || []), ...batchSections],
      agendaItems: parsedResponse.agendaItems
        ? parsedResponse.agendaItems.map((item) => ({
            id: item.id,
            topic: item.topic,
            timestamp: item.timestamp,
            context: item.context,
          }))
        : accumulatedResults.agendaItems,
      benchmarks: parsedResponse.benchmarks || accumulatedResults.benchmarks,
      radioReports: parsedResponse.radioReports || accumulatedResults.radioReports,
      safetyEvents: parsedResponse.safetyEvents || accumulatedResults.safetyEvents,
      decisions: parsedResponse.decisions
        ? parsedResponse.decisions.map((item) => ({
            id: item.id,
            decision: item.decision,
            timestamp: item.timestamp,
            context: item.context,
            agendaItemIds: item.agendaItemIds,
          }))
        : accumulatedResults.decisions,
      actionItems: parsedResponse.actionItems
        ? parsedResponse.actionItems.map((item) => ({
            id: item.id,
            task: item.task,
            owner: item.owner,
            deadline: item.deadline,
            timestamp: item.timestamp,
            agendaItemIds: item.agendaItemIds,
            decisionIds: item.decisionIds,
          }))
        : accumulatedResults.actionItems,
      quotes: parsedResponse.quotes || accumulatedResults.quotes,
    };

    logger.info('Hybrid Analysis', `Batch ${batch.name} complete`, {
      sectionCount: parsedResponse.sections.length,
      agendaItemCount: parsedResponse.agendaItems?.length || 0,
      benchmarkCount: parsedResponse.benchmarks?.length || 0,
      radioReportCount: parsedResponse.radioReports?.length || 0,
      safetyEventCount: parsedResponse.safetyEvents?.length || 0,
      decisionCount: parsedResponse.decisions?.length || 0,
      actionItemCount: parsedResponse.actionItems?.length || 0,
      quoteCount: parsedResponse.quotes?.length || 0,
    });
  }

  // Merge all batch results
  logger.info('Hybrid Analysis', 'Merging all batch results');
  const rawResults = mergeBatchResults(batchResponses);

  // Post-process: ensure unique IDs and validate relationships
  const draftResults = pruneResultsForTemplate(
    postProcessResults(rawResults, 'Hybrid Analysis'),
    template
  );

  logger.info('Hybrid Analysis', 'Hybrid analysis complete', {
    batches: batches.length,
    sectionCount: draftResults.sections.length,
    agendaItemCount: draftResults.agendaItems?.length || 0,
    actionItemCount: draftResults.actionItems?.length || 0,
    decisionCount: draftResults.decisions?.length || 0,
  });

  // Check if self-evaluation should run
  if (config?.runEvaluation) {
    logger.info('Hybrid Analysis', 'Running self-evaluation pass');
    const { evaluation, finalResults } = await executeEvaluationPass(
      template,
      transcript,
      draftResults,
      'hybrid',
      openaiClient,
      deployment,
      promptsUsed
    );

    return {
      results: pruneResultsForTemplate(finalResults, template),
      draftResults,
      evaluation,
      promptsUsed,
    };
  }

  // Return draft results without evaluation
  return {
    results: draftResults,
    promptsUsed,
  };
}
