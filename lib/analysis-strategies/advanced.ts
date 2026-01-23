/**
 * Advanced Analysis Strategy - Serial Contextual Cascading
 *
 * Highest quality analysis that processes sections one at a time in dependency order,
 * where each section receives ALL relevant previous results in its prompt.
 *
 * Processing Time: 6-8 minutes (GPT-5.2)
 * API Calls: 9-10 calls (one per section, processed serially)
 * Quality: Maximum - full contextual dependencies, explicit relationship mapping
 *
 * Features:
 * - Respects `dependencies` field in TemplateSection
 * - Topological sorting ensures dependencies are processed first
 * - Each prompt includes full results from all dependency sections
 * - Explicit relationship mapping instructions with IDs
 * - Detects orphaned items (decisions without agenda, etc.)
 * - Maintains cumulative context throughout analysis
 * - Handles circular dependency detection
 */

import type {
  Template,
  TemplateSection,
  AnalysisResults,
  EvaluationResults,
} from "@/types";
import type { TranscriptAnnotation } from "@/types/annotation";
import type OpenAI from "openai";
import {
  formatOutputType,
  postProcessResults,
  pruneResultsForTemplate,
  normalizeAnalysisJsonKeys,
  validateTokenLimits,
  ANALYSIS_CONSTANTS,
  buildAnalysisChatCompletionParams,
  logger,
  retryWithBackoff,
  TIMESTAMP_INSTRUCTION,
  buildAnnotationsPromptSection,
} from "./shared";
import { executeEvaluationPass } from "./evaluator";

/**
 * Configuration options for advanced analysis execution
 */
export interface AdvancedAnalysisConfig {
  /** Whether to run self-evaluation pass after analysis */
  runEvaluation?: boolean;
  /**
   * Supplemental source material text.
   * Extracted from uploaded Word docs, PDFs, PowerPoints, or pasted text.
   * Included in the prompt as additional context but kept separate from
   * the transcript to preserve timestamp citation logic.
   */
  supplementalMaterial?: string;
  /**
   * Trainer annotations - timestamped notes from training officers.
   * These are observations of face-to-face interactions or events not captured
   * in the audio. Included in prompts to provide additional context.
   */
  annotations?: TranscriptAnnotation[];
}

/**
 * Extended result type that includes evaluation metadata
 */
export interface AdvancedAnalysisResult {
  /** Final analysis results (post-evaluation if runEvaluation=true) */
  results: AnalysisResults;
  /** Draft results before evaluation (only if runEvaluation=true) */
  draftResults?: AnalysisResults;
  /** Evaluation metadata (only if runEvaluation=true) */
  evaluation?: EvaluationResults;
  /** Array of all prompts used for each section */
  promptsUsed: string[];
}

/**
 * Represents a node in the dependency graph
 */
export interface SectionDependencyNode {
  /** The template section */
  section: TemplateSection;

  /** Section IDs this section depends on */
  dependencies: string[];

  /** Section IDs that depend on this section */
  dependents: string[];
}

/**
 * Result from analyzing a single section (raw JSON response)
 */
interface SectionAnalysisResponse {
  /** The extracted content for this section */
  content: string;

  /** Agenda items if this section extracts them */
  agendaItems?: Array<{
    id: string;
    topic: string;
    timestamp?: number;
    context?: string;
  }>;

  /** Benchmark/milestone observations if this section extracts them */
  benchmarks?: Array<{
    id: string;
    benchmark: string;
    status: "met" | "missed" | "not_observed" | "not_applicable";
    timestamp?: number;
    unitOrRole?: string;
    evidenceQuote?: string;
    notes?: string;
  }>;

  /** Structured radio reports/CAN logs if this section extracts them */
  radioReports?: Array<{
    id: string;
    type:
      | "initial_radio_report"
      | "follow_up_360"
      | "entry_report"
      | "command_transfer_company_officer"
      | "command_transfer_chief"
      | "can_report"
      | "other";
    timestamp: number;
    from?: string;
    fields?: Record<string, unknown>;
    missingRequired?: string[];
    evidenceQuote?: string;
  }>;

  /** Safety/accountability events if this section extracts them */
  safetyEvents?: Array<{
    id: string;
    type:
      | "par"
      | "mayday"
      | "urgent_traffic"
      | "evacuation_order"
      | "strategy_change"
      | "ric_established"
      | "safety_officer_assigned"
      | "rehab"
      | "utilities_hazard"
      | "collapse_hazard"
      | "other";
    severity: "info" | "warning" | "critical";
    timestamp: number;
    unitOrRole?: string;
    details: string;
    evidenceQuote?: string;
  }>;

  /** Action items if this section extracts them */
  actionItems?: Array<{
    id: string;
    task: string;
    owner?: string;
    deadline?: string;
    timestamp: number; // Required - extracted from transcript timestamp markers
    agendaItemIds?: string[];
    decisionIds?: string[];
  }>;

  /** Decisions if this section extracts them */
  decisions?: Array<{
    id: string;
    decision: string;
    timestamp: number;
    context?: string;
    agendaItemIds?: string[];
  }>;

  /** Quotes if this section extracts them */
  quotes?: Array<{
    text: string;
    speaker?: string;
    timestamp: number;
  }>;

  /** Summary if this is a summary section */
  summary?: string;
}

/**
 * Statistics about dependency graph structure
 */
export interface DependencyGraphStats {
  /** Total number of sections in template */
  totalSections: number;
  /** Sections with explicitly defined dependencies */
  sectionsWithDependencies: number;
  /** Sections with no dependencies (root nodes) */
  sectionsWithoutDependencies: number;
  /** Sections where dependencies field is undefined vs empty array */
  sectionsWithUndefinedDependencies: number;
  /** Sections with explicit empty dependencies array */
  sectionsWithEmptyDependencies: number;
  /** Invalid dependency references found (logged as warnings) */
  invalidDependencyRefs: Array<{
    sectionId: string;
    sectionName: string;
    invalidRef: string;
  }>;
  /** Sections that are never depended upon by others */
  leafSections: string[];
  /** Sections that nothing depends on and have no dependencies (isolated) */
  isolatedSections: string[];
}

/**
 * Build dependency graph from template sections
 *
 * Creates a graph representation of section dependencies for topological sorting.
 * Validates that all referenced dependencies exist in the template.
 * Logs warnings for potential template configuration issues.
 *
 * @param sections - Array of template sections
 * @returns Map of section ID to dependency node
 * @throws Error if a section references a non-existent dependency (when strict mode)
 */
export function buildDependencyGraph(
  sections: TemplateSection[],
  options?: { strict?: boolean },
): Map<string, SectionDependencyNode> {
  const strict = options?.strict ?? true;
  const graph = new Map<string, SectionDependencyNode>();
  const stats: DependencyGraphStats = {
    totalSections: sections.length,
    sectionsWithDependencies: 0,
    sectionsWithoutDependencies: 0,
    sectionsWithUndefinedDependencies: 0,
    sectionsWithEmptyDependencies: 0,
    invalidDependencyRefs: [],
    leafSections: [],
    isolatedSections: [],
  };

  // Initialize all nodes and collect dependency statistics
  for (const section of sections) {
    const hasDependencies =
      section.dependencies && section.dependencies.length > 0;
    const dependenciesUndefined = section.dependencies === undefined;
    const dependenciesEmpty =
      Array.isArray(section.dependencies) && section.dependencies.length === 0;

    if (hasDependencies) {
      stats.sectionsWithDependencies++;
    } else {
      stats.sectionsWithoutDependencies++;
      if (dependenciesUndefined) {
        stats.sectionsWithUndefinedDependencies++;
      } else if (dependenciesEmpty) {
        stats.sectionsWithEmptyDependencies++;
      }
    }

    graph.set(section.id, {
      section,
      dependencies: section.dependencies || [],
      dependents: [],
    });
  }

  // Validate dependencies and build dependent lists
  for (const section of sections) {
    const deps = section.dependencies || [];

    for (const depId of deps) {
      // Check for self-referential dependency
      if (depId === section.id) {
        const errorMsg = `Section "${section.name}" (${section.id}) has a self-referential dependency`;
        logger.error("Advanced Analysis", errorMsg);
        throw new Error(errorMsg);
      }

      // Validate dependency exists
      if (!graph.has(depId)) {
        const invalidRef = {
          sectionId: section.id,
          sectionName: section.name,
          invalidRef: depId,
        };
        stats.invalidDependencyRefs.push(invalidRef);

        if (strict) {
          throw new Error(
            `Section "${section.name}" (${section.id}) depends on non-existent section "${depId}"`,
          );
        } else {
          logger.warn(
            "Advanced Analysis",
            `Section "${section.name}" references non-existent dependency "${depId}" - skipping`,
            invalidRef,
          );
          // Remove invalid dependency from node
          const node = graph.get(section.id)!;
          node.dependencies = node.dependencies.filter((d) => d !== depId);
          continue;
        }
      }

      // Add this section as a dependent of the dependency
      const depNode = graph.get(depId)!;
      depNode.dependents.push(section.id);
    }
  }

  // Identify leaf sections (no one depends on them) and isolated sections
  for (const [id, node] of Array.from(graph.entries())) {
    if (node.dependents.length === 0) {
      stats.leafSections.push(id);
      if (node.dependencies.length === 0) {
        stats.isolatedSections.push(id);
      }
    }
  }

  // Log comprehensive statistics
  logger.info("Advanced Analysis", "Dependency graph built", {
    totalSections: stats.totalSections,
    sectionsWithDependencies: stats.sectionsWithDependencies,
    sectionsWithoutDependencies: stats.sectionsWithoutDependencies,
  });

  // Warn if many sections lack dependencies (may indicate template issue)
  if (
    stats.sectionsWithoutDependencies > stats.totalSections / 2 &&
    stats.totalSections > 2
  ) {
    logger.warn(
      "Advanced Analysis",
      `${stats.sectionsWithoutDependencies}/${stats.totalSections} sections have no dependencies. ` +
        "Advanced mode works best with well-defined dependency chains. " +
        "Consider adding dependencies to improve contextual analysis quality.",
      {
        sectionsWithUndefinedDependencies:
          stats.sectionsWithUndefinedDependencies,
        sectionsWithEmptyDependencies: stats.sectionsWithEmptyDependencies,
        isolatedSections: stats.isolatedSections,
      },
    );
  }

  // Warn about isolated sections
  if (stats.isolatedSections.length > 0) {
    logger.info(
      "Advanced Analysis",
      `Found ${stats.isolatedSections.length} isolated section(s) (no dependencies and nothing depends on them)`,
      { isolatedSections: stats.isolatedSections },
    );
  }

  // Log invalid refs if any were found (non-strict mode)
  if (stats.invalidDependencyRefs.length > 0) {
    logger.warn(
      "Advanced Analysis",
      `Found ${stats.invalidDependencyRefs.length} invalid dependency reference(s)`,
      { invalidRefs: stats.invalidDependencyRefs },
    );
  }

  return graph;
}

/**
 * Find a specific cycle in the dependency graph using DFS
 *
 * @param graph - Dependency graph
 * @param startId - Starting node ID
 * @param unprocessed - Set of unprocessed node IDs
 * @returns Array representing the cycle path, or empty if no cycle found from this node
 */
function findCycle(
  graph: Map<string, SectionDependencyNode>,
  startId: string,
  unprocessed: Set<string>,
): string[] {
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): string[] | null {
    if (!unprocessed.has(nodeId)) return null;
    if (visited.has(nodeId)) {
      // Found cycle - extract the cycle portion
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart !== -1) {
        return [...path.slice(cycleStart), nodeId];
      }
      return null;
    }

    visited.add(nodeId);
    path.push(nodeId);

    const node = graph.get(nodeId);
    if (node) {
      for (const depId of node.dependencies) {
        if (unprocessed.has(depId)) {
          const cycle = dfs(depId);
          if (cycle) return cycle;
        }
      }
    }

    path.pop();
    return null;
  }

  return dfs(startId) || [];
}

/**
 * Topologically sort sections based on dependencies
 *
 * Uses Kahn's algorithm to sort sections so that dependencies are processed before
 * sections that depend on them. Detects circular dependencies with detailed cycle reporting.
 *
 * @param graph - Dependency graph from buildDependencyGraph
 * @returns Sorted array of template sections
 * @throws Error if circular dependencies are detected
 */
export function topologicalSort(
  graph: Map<string, SectionDependencyNode>,
): TemplateSection[] {
  const sorted: TemplateSection[] = [];
  const inDegree = new Map<string, number>();
  const queue: string[] = [];

  // Handle empty graph
  if (graph.size === 0) {
    logger.info("Advanced Analysis", "Topological sort: empty graph");
    return [];
  }

  // Calculate in-degree (number of dependencies) for each node
  for (const [id, node] of Array.from(graph.entries())) {
    inDegree.set(id, node.dependencies.length);

    // Nodes with no dependencies can be processed first
    if (node.dependencies.length === 0) {
      queue.push(id);
    }
  }

  // Edge case: all nodes have dependencies (guaranteed cycle or external refs)
  if (queue.length === 0 && graph.size > 0) {
    logger.error(
      "Advanced Analysis",
      "All sections have dependencies - guaranteed circular dependency",
      { sectionIds: Array.from(graph.keys()) },
    );
  }

  logger.info("Advanced Analysis", "Topological sort starting", {
    totalNodes: graph.size,
    nodesWithNoDependencies: queue.length,
    rootNodes: queue.slice(), // Copy for logging
  });

  // Process nodes in topological order
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = graph.get(currentId)!;
    sorted.push(currentNode.section);

    // Reduce in-degree for all dependents
    for (const dependentId of currentNode.dependents) {
      const currentInDegree = inDegree.get(dependentId)!;
      const newInDegree = currentInDegree - 1;
      inDegree.set(dependentId, newInDegree);

      // If all dependencies have been processed, add to queue
      if (newInDegree === 0) {
        queue.push(dependentId);
      }
    }
  }

  // Check for circular dependencies
  if (sorted.length !== graph.size) {
    const sortedIds = new Set(sorted.map((s) => s.id));
    const unprocessedIds = new Set(
      Array.from(graph.keys()).filter((id) => !sortedIds.has(id)),
    );
    const unprocessed = Array.from(unprocessedIds);

    // Find actual cycles using DFS for better error reporting
    const cycles: string[][] = [];
    const foundInCycles = new Set<string>();

    for (const id of unprocessed) {
      if (!foundInCycles.has(id)) {
        const cycle = findCycle(graph, id, unprocessedIds);
        if (cycle.length > 0) {
          cycles.push(cycle);
          cycle.forEach((nodeId) => foundInCycles.add(nodeId));
        }
      }
    }

    // Format cycles for human readability
    const cycleDescriptions = cycles.map((cycle) => {
      const names = cycle.map((id) => {
        const node = graph.get(id);
        return node ? `"${node.section.name}" (${id})` : id;
      });
      return names.join(" -> ");
    });

    logger.error("Advanced Analysis", "Circular dependency detected", {
      totalSections: graph.size,
      processedSections: sorted.length,
      unprocessedSections: unprocessed,
      cyclesFound: cycles.length,
      cycleDetails: cycleDescriptions,
    });

    const errorMessage = [
      `Circular dependency detected in ${cycles.length} cycle(s).`,
      `Unable to process ${unprocessed.length} section(s): ${unprocessed.join(", ")}.`,
      "",
      "Cycle details:",
      ...cycleDescriptions.map((desc, i) => `  ${i + 1}. ${desc}`),
      "",
      "Fix: Remove or restructure dependencies to eliminate cycles.",
    ].join("\n");

    throw new Error(errorMessage);
  }

  logger.info("Advanced Analysis", "Topological sort complete", {
    sortedOrder: sorted.map((s) => s.name),
  });

  return sorted;
}

/**
 * Group sections by dependency level for parallel processing.
 *
 * Level 0: Sections with no dependencies (can run in parallel)
 * Level 1: Sections whose dependencies are all in level 0 (can run in parallel after level 0)
 * Level N: Sections whose dependencies are all in levels < N
 *
 * @param graph - Dependency graph from buildDependencyGraph
 * @returns Array of levels, where each level is an array of sections that can run in parallel
 */
export function groupSectionsByLevel(
  graph: Map<string, SectionDependencyNode>,
): TemplateSection[][] {
  const levels: TemplateSection[][] = [];
  const sectionLevel = new Map<string, number>();
  const inDegree = new Map<string, number>();

  // Handle empty graph
  if (graph.size === 0) {
    return [];
  }

  // Initialize in-degree for each node
  for (const [id, node] of Array.from(graph.entries())) {
    inDegree.set(id, node.dependencies.length);
  }

  // Process level by level
  let remaining = graph.size;
  let currentLevel = 0;

  while (remaining > 0) {
    const levelSections: TemplateSection[] = [];

    // Find all sections that can be processed at this level
    // (all dependencies are in previous levels)
    for (const [id, node] of Array.from(graph.entries())) {
      if (sectionLevel.has(id)) continue; // Already assigned to a level

      const degree = inDegree.get(id)!;
      if (degree === 0) {
        levelSections.push(node.section);
        sectionLevel.set(id, currentLevel);
      }
    }

    if (levelSections.length === 0 && remaining > 0) {
      // This shouldn't happen if there are no cycles
      logger.error("Advanced Analysis", "Failed to assign sections to levels", {
        remaining,
        assigned: sectionLevel.size,
      });
      break;
    }

    // Add this level
    levels.push(levelSections);
    remaining -= levelSections.length;

    // Update in-degrees for next level
    for (const section of levelSections) {
      const node = graph.get(section.id)!;
      for (const dependentId of node.dependents) {
        const currentInDegree = inDegree.get(dependentId)!;
        inDegree.set(dependentId, currentInDegree - 1);
      }
    }

    currentLevel++;
  }

  logger.info("Advanced Analysis", "Sections grouped by dependency level", {
    totalLevels: levels.length,
    sectionsPerLevel: levels.map((l, i) => ({
      level: i,
      count: l.length,
      sections: l.map((s) => s.name),
    })),
  });

  return levels;
}

/**
 * Result of generating a cascading prompt
 */
export interface CascadingPromptResult {
  /** The generated prompt text */
  prompt: string;
  /** Whether any context was actually available from dependencies */
  hasContext: boolean;
  /** Statistics about what context was included */
  contextStats: {
    dependencyCount: number;
    sectionsIncluded: number;
    agendaItemsIncluded: number;
    decisionsIncluded: number;
    /** True if dependencies were declared but no matching content found */
    dependenciesWithoutContent: boolean;
  };
}

/**
 * Generate cascading prompt with context from dependency sections
 *
 * Creates a rich prompt that includes:
 * - Current section requirements
 * - Full results from all dependency sections
 * - Explicit relationship mapping instructions
 * - Context about what has already been extracted
 *
 * Handles edge cases:
 * - Empty previousResults gracefully
 * - Sections with declared dependencies but no actual content yet
 * - Safe array access to avoid runtime errors
 *
 * @param section - Current section to analyze
 * @param transcript - Full transcript text
 * @param previousResults - Partial results from processed sections
 * @param dependencySectionNames - Names of sections this depends on (for user-friendly display)
 * @returns Comprehensive prompt string with full context
 */
export function generateCascadingPrompt(
  section: TemplateSection,
  transcript: string,
  previousResults: Partial<AnalysisResults>,
  dependencySectionNames: string[],
  supplementalMaterial?: string,
  annotations?: TranscriptAnnotation[],
): string {
  // Safely extract arrays with defaults
  const agendaItems = previousResults.agendaItems ?? [];
  const decisions = previousResults.decisions ?? [];
  const sections = previousResults.sections ?? [];

  const hasAgenda = agendaItems.length > 0;
  const hasDecisions = decisions.length > 0;
  const hasPreviousSections = sections.length > 0;
  const hasDependencies =
    section.dependencies && section.dependencies.length > 0;

  // Track context statistics for logging
  const contextStats = {
    dependencyCount: section.dependencies?.length ?? 0,
    sectionsIncluded: 0,
    agendaItemsIncluded: 0,
    decisionsIncluded: 0,
    dependenciesWithoutContent: false,
  };

  // Build context from previous sections
  let contextSection = "";
  if (hasDependencies) {
    // Check if we actually have content for the declared dependencies
    const hasAnyContent = hasPreviousSections || hasAgenda || hasDecisions;

    if (!hasAnyContent) {
      // Dependencies declared but no content available yet
      // This can happen if this is one of the first sections or dependencies haven't produced output
      contextStats.dependenciesWithoutContent = true;

      logger.info(
        "Advanced Analysis",
        `Section "${section.name}" has ${section.dependencies!.length} declared dependencies but no prior content available`,
        {
          sectionId: section.id,
          dependencies: section.dependencies,
          dependencyNames: dependencySectionNames,
        },
      );

      // Still mention dependencies exist for context, but note no content yet
      contextSection = `
## CONTEXT FROM PREVIOUS ANALYSIS

This section depends on: ${dependencySectionNames.join(", ")}

Note: No structured data (agenda items, decisions, etc.) has been extracted from prior sections yet.
You are analyzing this section independently based on the transcript.
`;
    } else {
      // We have content to include
      contextSection = `
## CONTEXT FROM PREVIOUS ANALYSIS

You have access to results from these previously analyzed sections:
${dependencySectionNames.map((name) => `- ${name}`).join("\n")}

This context should inform your analysis of the current section.
`;

      // Include previous section content
      if (hasPreviousSections) {
        contextSection += "\n### Previously Extracted Sections:\n\n";
        for (const prevSection of sections) {
          contextSection += `**${prevSection.name}**:\n${prevSection.content}\n\n`;
          contextStats.sectionsIncluded++;
        }
      }

      // Include agenda items with IDs
      if (hasAgenda) {
        contextSection += "\n### Agenda Items Already Identified:\n\n";
        for (const item of agendaItems) {
          contextSection += `- [${item.id}] ${item.topic}`;
          if (item.timestamp) {
            contextSection += ` (timestamp: ${item.timestamp}s)`;
          }
          if (item.context) {
            contextSection += `\n  Context: ${item.context}`;
          }
          contextSection += "\n";
          contextStats.agendaItemsIncluded++;
        }
        contextSection += "\n";
      }

      // Include decisions with IDs
      if (hasDecisions) {
        contextSection += "\n### Decisions Already Identified:\n\n";
        for (const decision of decisions) {
          contextSection += `- [${decision.id}] ${decision.decision}`;
          if (decision.timestamp) {
            contextSection += ` (timestamp: ${decision.timestamp}s)`;
          }
          if (decision.agendaItemIds && decision.agendaItemIds.length > 0) {
            contextSection += `\n  Related to agenda: ${decision.agendaItemIds.join(", ")}`;
          }
          if (decision.context) {
            contextSection += `\n  Context: ${decision.context}`;
          }
          contextSection += "\n";
          contextStats.decisionsIncluded++;
        }
        contextSection += "\n";
      }
    }
  }

  // Determine what structured outputs this section should produce
  const sectionNameLower = section.name.toLowerCase();
  const shouldExtractAgenda = sectionNameLower.includes("agenda");
  const promptLower = section.prompt.toLowerCase();

  const shouldExtractBenchmarks =
    sectionNameLower.includes("benchmark") ||
    sectionNameLower.includes("milestone") ||
    sectionNameLower.includes("report card") ||
    promptLower.includes("benchmark");
  const shouldExtractRadioReports =
    sectionNameLower.includes("radio") ||
    sectionNameLower.includes("can") ||
    sectionNameLower.includes("size-up") ||
    sectionNameLower.includes("entry") ||
    sectionNameLower.includes("command transfer") ||
    promptLower.includes("radio") ||
    promptLower.includes("can report") ||
    promptLower.includes("command transfer") ||
    promptLower.includes("size-up") ||
    promptLower.includes("initial radio report");
  const shouldExtractSafetyEvents =
    sectionNameLower.includes("safety") ||
    sectionNameLower.includes("accountability") ||
    sectionNameLower.includes("mayday") ||
    sectionNameLower.includes("par") ||
    sectionNameLower.includes("evac") ||
    promptLower.includes("mayday") ||
    promptLower.includes("par") ||
    promptLower.includes("evac") ||
    promptLower.includes("safety officer") ||
    promptLower.includes("ric") ||
    promptLower.includes("urgent");
  const shouldExtractDecisions =
    sectionNameLower.includes("decision") ||
    sectionNameLower.includes("conclusion");
  const shouldExtractActions =
    sectionNameLower.includes("action") || sectionNameLower.includes("task");
  const shouldExtractQuotes = sectionNameLower.includes("quote");
  const shouldExtractSummary = sectionNameLower.includes("summary");

  // Build relationship mapping instructions
  // Use safe access patterns - agendaItems and decisions are already safely extracted above
  let relationshipInstructions = "";

  // Helper to get example ID safely
  const getExampleAgendaId = (): string => {
    return agendaItems.length > 0 ? agendaItems[0].id : "agenda-1";
  };
  const getExampleDecisionId = (): string => {
    return decisions.length > 0 ? decisions[0].id : "decision-1";
  };

  if (shouldExtractDecisions && hasAgenda) {
    relationshipInstructions = `
## CRITICAL: Relationship Mapping

Since agenda items have already been identified, you MUST link your extracted content to them:

**For Decisions**:
- Assign unique IDs to each decision (e.g., "decision-1", "decision-2", etc.)
- Include an \`agendaItemIds\` array linking each decision to relevant agenda items
- Use the agenda item IDs from the context above (e.g., ["${getExampleAgendaId()}"])
- Note any decisions made outside the main agenda topics (orphaned decisions)
- Provide context/rationale for each decision

**Requirements**:
- Every decision should ideally link to at least one agenda item
- If a decision doesn't map to any agenda item, still extract it but leave agendaItemIds empty
- Be precise about which agenda topics each decision addresses
`;
  } else if (shouldExtractActions && (hasAgenda || hasDecisions)) {
    const agendaInstruction = hasAgenda
      ? `- Include an \`agendaItemIds\` array linking to relevant agenda items (e.g., ["${getExampleAgendaId()}"])`
      : "";
    const decisionInstruction = hasDecisions
      ? `- Include a \`decisionIds\` array linking to decisions that spawned this action (e.g., ["${getExampleDecisionId()}"])`
      : "";

    relationshipInstructions = `
## CRITICAL: Relationship Mapping

Previous analysis has identified ${hasAgenda ? "agenda items" : ""}${hasAgenda && hasDecisions ? " and " : ""}${hasDecisions ? "decisions" : ""}.
You MUST link action items to this existing context:

**For Action Items**:
- Assign unique IDs to each action item (e.g., "action-1", "action-2", etc.)
- TIMESTAMP IS REQUIRED: Use the [MM:SS] markers in the transcript to determine when the action was mentioned (convert to seconds)
${agendaInstruction}
${decisionInstruction}
- Include owner (if mentioned) and deadline (if mentioned)
- Note any action items that don't map to agenda or decisions (orphaned actions)

**Requirements**:
- Every action should ideally link to decisions and/or agenda items
- If an action doesn't map to any existing context, still extract it but leave relationship arrays empty
- Be precise about which decisions or agenda topics each action addresses
`;
  } else if (shouldExtractAgenda) {
    relationshipInstructions = `
## CRITICAL: ID Assignment

You are extracting agenda items. These will be used by subsequent analysis passes to link decisions and actions.

**For Agenda Items**:
- Assign unique IDs to each agenda item (e.g., "agenda-1", "agenda-2", "agenda-3", etc.)
- Use clear, sequential numbering
- Include timestamp if the agenda item is discussed at a specific time
- Provide optional context about each agenda item

These IDs are ESSENTIAL for relationship mapping in later analysis stages.
`;
  } else if (!hasDependencies) {
    // Section has no dependencies - add a note about standalone analysis
    relationshipInstructions = `
## Note: Standalone Section

This section is analyzed independently without dependencies on other sections.
Focus on extracting the required content directly from the transcript.
`;
  }

  // Build output format instructions
  let outputFormatInstructions = "";
  if (shouldExtractAgenda) {
    outputFormatInstructions += `
**Agenda Items**: Extract as structured objects with:
- \`id\`: Unique identifier (e.g., "agenda-1", "agenda-2")
- \`topic\`: Agenda item description
- \`timestamp\`: Optional timestamp in seconds
- \`context\`: Optional additional context
`;
  }

  if (shouldExtractDecisions) {
    outputFormatInstructions += `
**Decisions**: Extract as structured objects with:
- \`id\`: Unique identifier (e.g., "decision-1", "decision-2")
- \`decision\`: Decision text
- \`timestamp\`: Timestamp in seconds when decision was made
- \`context\`: Optional rationale or context
- \`agendaItemIds\`: Array of agenda item IDs this decision relates to (REQUIRED if agenda exists)
`;
  }

  if (shouldExtractActions) {
    outputFormatInstructions += `
**Action Items**: Extract as structured objects with:
- \`id\`: Unique identifier (e.g., "action-1", "action-2")
- \`task\`: Task description
- \`owner\`: Optional person responsible
- \`deadline\`: Optional due date
- \`timestamp\`: REQUIRED timestamp in seconds - use the [MM:SS] markers in the transcript to determine when the action was mentioned (convert to seconds)
- \`agendaItemIds\`: Array of agenda item IDs this relates to (if applicable)
- \`decisionIds\`: Array of decision IDs that spawned this action (if applicable)
`;
  }

  if (shouldExtractBenchmarks) {
    outputFormatInstructions += `
**Benchmarks**: Extract benchmark/milestone observations as structured objects with:
- \`id\`: Unique identifier (e.g., "benchmark-1")
- \`benchmark\`: Benchmark label (e.g., "Command established")
- \`status\`: One of "met" | "missed" | "not_observed" | "not_applicable"
- \`timestamp\`: Timestamp in seconds (omit if not observed)
- \`unitOrRole\`: Unit/role associated (if stated)
- \`evidenceQuote\`: Short verbatim quote (optional)
- \`notes\`: Brief context (optional)
`;
  }

  if (shouldExtractRadioReports) {
    outputFormatInstructions += `
**Radio Reports**: Extract structured radio reports/CAN logs as objects with:
- \`id\`: Unique identifier (e.g., "report-1")
- \`type\`: One of "initial_radio_report" | "follow_up_360" | "entry_report" | "command_transfer_company_officer" | "command_transfer_chief" | "can_report" | "other"
- \`timestamp\`: Timestamp in seconds (REQUIRED)
- \`from\`: Speaking unit/role (if identifiable)
- \`fields\`: Key/value extracted fields relevant to the report type (keep values concise)
- \`missingRequired\`: Array of missing/unclear required fields (if any)
- \`evidenceQuote\`: Short verbatim quote (optional)
`;
  }

  if (shouldExtractSafetyEvents) {
    outputFormatInstructions += `
**Safety Events**: Extract safety/accountability events as objects with:
- \`id\`: Unique identifier (e.g., "safety-1")
- \`type\`: One of "par" | "mayday" | "urgent_traffic" | "evacuation_order" | "strategy_change" | "ric_established" | "safety_officer_assigned" | "rehab" | "utilities_hazard" | "collapse_hazard" | "other"
- \`severity\`: "info" | "warning" | "critical"
- \`timestamp\`: Timestamp in seconds (REQUIRED)
- \`unitOrRole\`: Unit/role associated (if identifiable)
- \`details\`: 1 sentence description (REQUIRED)
- \`evidenceQuote\`: Short verbatim quote (optional)
`;
  }

  if (shouldExtractQuotes) {
    outputFormatInstructions += `
**Quotes**: Extract 3-5 notable quotes with:
- \`text\`: Exact quote text
- \`speaker\`: Optional speaker name
- \`timestamp\`: Timestamp in seconds
`;
  }

  if (shouldExtractSummary) {
    outputFormatInstructions += `
**Summary**: Provide a concise 3-5 sentence overview capturing:
- Main topics discussed
- Key outcomes
- Overall tone/sentiment
- Next steps
`;
  }

  // Format output type description
  const formatDescription = formatOutputType(section.outputFormat);

  return `You are an expert fireground radio traffic evaluator for Austin Fire Department (AFD) Training Division. You are analyzing a specific section of a transcript.

${TIMESTAMP_INSTRUCTION}

## Timestamp Extraction Example

Given: "[2:45] Engine 25: Engine 25 assuming command, offensive mode"
Extract: { "type": "initial_radio_report", "timestamp": 165, "from": "Engine 25", "fields": { "command": "assumed", "strategy": "offensive" } }
Calculation: [2:45] = (2 × 60) + 45 = 165 seconds

Given: "[11:02] Interior: CAN - conditions heavy heat, actions advancing, needs ventilation"
Extract: { "type": "can_report", "timestamp": 662, "fields": { "conditions": "heavy heat", "actions": "advancing", "needs": "ventilation" } }
Calculation: [11:02] = (11 × 60) + 2 = 662 seconds

${contextSection}

## Your Task: Extract "${section.name}"

**Instructions**: ${section.prompt}

**Output Format**: ${formatDescription}

**Requirements**:
- Provide clear, concise content
- For bullet_points: MUST use "-" character ONLY (NOT numbered lists 1,2,3), max ${ANALYSIS_CONSTANTS.MAX_BULLET_POINTS} items, capitalize first letter
- For paragraphs: Continuous prose, ${ANALYSIS_CONSTANTS.MAX_PARAGRAPH_WORDS} words max
- Start with action verbs or key concepts
- Be specific and actionable
- Base analysis strictly on the transcript content below
- Use the context from previous sections to inform your analysis
${section.dependencies && section.dependencies.length > 0 ? "- Maintain consistency with previously extracted information" : ""}

${relationshipInstructions}

${outputFormatInstructions}

## Output Format

You MUST respond with valid JSON in this EXACT structure:

\`\`\`json
{
  "content": "Extracted content formatted per requirements above",
  ${shouldExtractAgenda ? '"agendaItems": [ /* array of agenda objects */ ],' : ""}
  ${shouldExtractBenchmarks ? '"benchmarks": [ /* array of benchmark objects */ ],' : ""}
  ${shouldExtractRadioReports ? '"radioReports": [ /* array of radio report objects */ ],' : ""}
  ${shouldExtractSafetyEvents ? '"safetyEvents": [ /* array of safety event objects */ ],' : ""}
  ${shouldExtractDecisions ? '"decisions": [ /* array of decision objects */ ],' : ""}
  ${shouldExtractActions ? '"actionItems": [ /* array of action objects */ ],' : ""}
  ${shouldExtractQuotes ? '"quotes": [ /* array of quote objects */ ],' : ""}
  ${shouldExtractSummary ? '"summary": "Overall summary text"' : ""}
}
\`\`\`

${buildAnnotationsPromptSection(annotations)}${
    supplementalMaterial
      ? `## Supplemental Source Material

The following supplemental documents and notes have been provided as additional context.
Use this information to inform your analysis, but note that:
- Timestamps and citations should ONLY reference the transcript (not supplemental material)
- Supplemental material provides background context and should be used to understand terminology, prior discussions, or meeting preparation notes
- Do NOT fabricate timestamps for information found only in supplemental material

${supplementalMaterial}

---

`
      : ""
  }## Transcript

${transcript}

## Response

Provide your analysis as valid JSON following the structure above. ${hasAgenda || hasDecisions ? "Ensure all relationship IDs are correctly assigned and linked to the context provided." : ""}`;
}

/**
 * Validate section analysis response structure
 */
function isValidSectionAnalysisResponse(
  data: unknown,
): data is SectionAnalysisResponse {
  if (!data || typeof data !== "object") return false;

  const obj = data as Record<string, unknown>;

  // Must have content
  if (typeof obj.content !== "string") return false;

  // Optional arrays must be valid if present
  if (obj.agendaItems !== undefined && !Array.isArray(obj.agendaItems))
    return false;
  if (obj.benchmarks !== undefined && !Array.isArray(obj.benchmarks))
    return false;
  if (obj.radioReports !== undefined && !Array.isArray(obj.radioReports))
    return false;
  if (obj.safetyEvents !== undefined && !Array.isArray(obj.safetyEvents))
    return false;
  if (obj.actionItems !== undefined && !Array.isArray(obj.actionItems))
    return false;
  if (obj.decisions !== undefined && !Array.isArray(obj.decisions))
    return false;
  if (obj.quotes !== undefined && !Array.isArray(obj.quotes)) return false;

  // Summary must be string if present
  if (obj.summary !== undefined && typeof obj.summary !== "string")
    return false;

  return true;
}

/**
 * Merge multiple section responses into complete analysis results
 *
 * @param sectionResponses - Array of section responses with their names
 * @returns Complete analysis results
 */
function mergeSectionResults(
  sectionResponses: Array<{ name: string; response: SectionAnalysisResponse }>,
): AnalysisResults {
  const accumulated: Partial<AnalysisResults> = {
    sections: [],
    agendaItems: [],
    benchmarks: [],
    radioReports: [],
    safetyEvents: [],
    actionItems: [],
    decisions: [],
    quotes: [],
  };

  for (const { name, response } of sectionResponses) {
    mergeSectionIntoResults(accumulated, name, response);
  }

  return {
    summary: accumulated.summary,
    sections: accumulated.sections || [],
    agendaItems: accumulated.agendaItems,
    benchmarks: accumulated.benchmarks,
    radioReports: accumulated.radioReports,
    safetyEvents: accumulated.safetyEvents,
    actionItems: accumulated.actionItems,
    decisions: accumulated.decisions,
    quotes: accumulated.quotes,
  };
}

/**
 * Merge a single section result into accumulating analysis results
 *
 * @param accumulated - Partial results accumulated so far
 * @param sectionName - Name of the section just analyzed
 * @param response - Response from analyzing this section
 * @returns Updated partial results
 */
function mergeSectionIntoResults(
  accumulated: Partial<AnalysisResults>,
  sectionName: string,
  response: SectionAnalysisResponse,
): Partial<AnalysisResults> {
  // Initialize sections array if needed
  if (!accumulated.sections) {
    accumulated.sections = [];
  }

  // Add this section's content
  accumulated.sections.push({
    name: sectionName,
    content: response.content,
    evidence: [], // Advanced mode doesn't extract evidence to maintain focus on relationships
  });

  // Merge agenda items
  if (response.agendaItems && response.agendaItems.length > 0) {
    if (!accumulated.agendaItems) {
      accumulated.agendaItems = [];
    }
    accumulated.agendaItems.push(...response.agendaItems);
  }

  // Merge benchmark observations
  if (response.benchmarks && response.benchmarks.length > 0) {
    if (!accumulated.benchmarks) {
      accumulated.benchmarks = [];
    }
    accumulated.benchmarks.push(...response.benchmarks);
  }

  // Merge radio reports
  if (response.radioReports && response.radioReports.length > 0) {
    if (!accumulated.radioReports) {
      accumulated.radioReports = [];
    }
    accumulated.radioReports.push(...response.radioReports);
  }

  // Merge safety events
  if (response.safetyEvents && response.safetyEvents.length > 0) {
    if (!accumulated.safetyEvents) {
      accumulated.safetyEvents = [];
    }
    accumulated.safetyEvents.push(...response.safetyEvents);
  }

  // Merge action items
  if (response.actionItems && response.actionItems.length > 0) {
    if (!accumulated.actionItems) {
      accumulated.actionItems = [];
    }
    accumulated.actionItems.push(...response.actionItems);
  }

  // Merge decisions
  if (response.decisions && response.decisions.length > 0) {
    if (!accumulated.decisions) {
      accumulated.decisions = [];
    }
    accumulated.decisions.push(...response.decisions);
  }

  // Merge quotes
  if (response.quotes && response.quotes.length > 0) {
    if (!accumulated.quotes) {
      accumulated.quotes = [];
    }
    accumulated.quotes.push(...response.quotes);
  }

  // Set summary (only one should exist)
  if (response.summary) {
    accumulated.summary = response.summary;
  }

  return accumulated;
}

/**
 * Execute advanced analysis strategy
 *
 * Main entry point for advanced analysis mode. Processes sections one at a time
 * in dependency order, with each section receiving full context from previous results.
 *
 * @param template - Analysis template
 * @param transcript - Full transcript text
 * @param openaiClient - Azure OpenAI client instance
 * @param deployment - GPT deployment name
 * @param progressCallback - Optional callback for progress updates
 * @param config - Optional configuration (evaluation, etc.)
 * @returns Promise<AdvancedAnalysisResult>
 */
export async function executeAdvancedAnalysis(
  template: Template,
  transcript: string,
  openaiClient: OpenAI,
  deployment: string,
  progressCallback?: (
    current: number,
    total: number,
    sectionName: string,
  ) => void,
  config?: AdvancedAnalysisConfig,
): Promise<AdvancedAnalysisResult> {
  // Track overall start time to prevent 504 gateway timeouts
  const analysisStartTime = Date.now();

  logger.info("Advanced Analysis", "Starting contextual cascading analysis", {
    deployment,
    templateName: template.name,
    sectionCount: template.sections.length,
    outputs: template.outputs,
    overallTimeoutMs: ANALYSIS_CONSTANTS.ANALYSIS_OVERALL_TIMEOUT_MS,
    perSectionTimeoutMs: ANALYSIS_CONSTANTS.ADVANCED_SECTION_TIMEOUT_MS,
    hasSupplementalMaterial: !!config?.supplementalMaterial,
    supplementalLength: config?.supplementalMaterial?.length || 0,
    annotationCount: config?.annotations?.length || 0,
  });

  // Step 1: Build dependency graph
  logger.info("Advanced Analysis", "Building dependency graph");
  const graph = buildDependencyGraph(template.sections);

  // Step 2: Sort sections by dependency order for sequential cascade processing
  logger.info("Advanced Analysis", "Sorting sections by dependency order");
  const sortedSections = topologicalSort(graph);

  const totalSections = template.sections.length;

  logger.info(
    "Advanced Analysis",
    "Processing order established (sequential cascade)",
    {
      totalSections,
      order: sortedSections.map((s, idx) => ({
        position: idx + 1,
        name: s.name,
        dependencies: s.dependencies || [],
      })),
    },
  );

  // Step 3: Process each level - sections within a level can run in parallel
  const accumulated: Partial<AnalysisResults> = {};
  const sectionResponses: Array<{
    name: string;
    response: SectionAnalysisResponse;
  }> = [];
  const promptsUsed: string[] = [];
  let sectionsCompleted = 0;

  // Helper function to process a single section
  const processSection = async (
    section: TemplateSection,
  ): Promise<{
    name: string;
    response: SectionAnalysisResponse;
    prompt: string;
  }> => {
    // Get names of dependency sections for prompt
    const dependencySectionNames =
      section.dependencies?.map((depId) => {
        const depSection = template.sections.find((s) => s.id === depId);
        return depSection?.name || depId;
      }) || [];

    // Generate cascading prompt with full context from accumulated results
    // Include supplemental material and annotations from config (if provided) for additional context
    const prompt = generateCascadingPrompt(
      section,
      transcript,
      accumulated,
      dependencySectionNames,
      config?.supplementalMaterial,
      config?.annotations,
    );

    logger.info("Advanced Analysis", `Generated prompt for "${section.name}"`, {
      promptLength: prompt.length,
      hasContext: (section.dependencies?.length || 0) > 0,
      previousSectionCount: accumulated.sections?.length || 0,
      previousAgendaCount: accumulated.agendaItems?.length || 0,
      previousBenchmarkCount: accumulated.benchmarks?.length || 0,
      previousRadioReportCount: accumulated.radioReports?.length || 0,
      previousSafetyEventCount: accumulated.safetyEvents?.length || 0,
      previousDecisionCount: accumulated.decisions?.length || 0,
    });

    // Validate token limits before API call
    const validation = validateTokenLimits(
      transcript,
      prompt,
      `Advanced Analysis - ${section.name}`,
    );
    if (validation.warnings.length > 0) {
      validation.warnings.forEach((w) => logger.warn("Advanced Analysis", w));
    }

    // Make API call for this section with retry logic
    const response = await retryWithBackoff(
      async () => {
        const res = await openaiClient.chat.completions.create({
          model: deployment,
          messages: [
            {
              role: "system",
              content:
                "You are an expert fireground radio traffic evaluator for Austin Fire Department (AFD) Training Division. " +
                "You provide structured, accurate analysis of specific transcript sections. " +
                "Do not speculate. If information is not in the transcript, state that it is not stated. " +
                "Always respond with valid JSON only and maintain consistency with previously extracted information.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          ...buildAnalysisChatCompletionParams(
            deployment,
            ANALYSIS_CONSTANTS.ADVANCED_TEMPERATURE,
          ),
          response_format: { type: "json_object" },
        });

        // Validate response before returning
        const finishReason = res.choices[0].finish_reason;
        const content = res.choices[0].message.content;

        logger.info(
          "Advanced Analysis",
          `Received response for "${section.name}"`,
          {
            tokensUsed: res.usage?.total_tokens,
            finishReason: finishReason,
            contentLength: content?.length ?? 0,
          },
        );

        // Handle content filter - retry as it's likely a false positive
        if (finishReason === "content_filter") {
          logger.warn(
            "Advanced Analysis",
            `Content filter triggered for "${section.name}" - retrying`,
          );
          throw new Error("RETRY");
        }

        // Handle token limit exceeded - fail fast with actionable error
        if (finishReason === "length") {
          throw new Error(
            `Response truncated due to token limit for section "${section.name}". ` +
              `Consider using Basic or Hybrid strategy for this transcript length.`,
          );
        }

        // Handle empty response
        if (!content || content.trim() === "") {
          logger.error(
            "Advanced Analysis",
            `Empty response for "${section.name}"`,
            {
              finishReason,
              hasContent: !!content,
              contentLength: content?.length ?? 0,
            },
          );
          throw new Error("RETRY");
        }

        return res;
      },
      {
        maxRetries: 3,
        baseDelay: 2000,
        timeoutMs: ANALYSIS_CONSTANTS.ADVANCED_SECTION_TIMEOUT_MS,
        strategyName: "Advanced Analysis",
        sectionName: section.name,
      },
    );

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error(
        `Empty response from OpenAI for section "${section.name}" ` +
          `(finish_reason: ${response.choices[0].finish_reason})`,
      );
    }

    // Parse JSON response
    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(content);
      parsedResponse = normalizeAnalysisJsonKeys(parsedResponse);
    } catch (error) {
      logger.error(
        "Advanced Analysis",
        `Failed to parse JSON for "${section.name}"`,
        {
          error,
          contentPreview: content.substring(0, 500),
        },
      );
      throw new Error(`Invalid JSON response for section "${section.name}"`);
    }

    // Validate structure
    if (!isValidSectionAnalysisResponse(parsedResponse)) {
      logger.error(
        "Advanced Analysis",
        `Invalid response structure for "${section.name}"`,
      );
      throw new Error(
        `Response does not match expected structure for section "${section.name}"`,
      );
    }

    return { name: section.name, response: parsedResponse, prompt };
  };

  // Process sections sequentially in dependency order (cascade mode)
  for (
    let sectionIndex = 0;
    sectionIndex < sortedSections.length;
    sectionIndex++
  ) {
    const section = sortedSections[sectionIndex];
    const sectionStart = Date.now();

    // Check overall timeout before starting each section
    const elapsedMs = Date.now() - analysisStartTime;
    const remainingMs =
      ANALYSIS_CONSTANTS.ANALYSIS_OVERALL_TIMEOUT_MS - elapsedMs;

    if (remainingMs < ANALYSIS_CONSTANTS.ADVANCED_SECTION_TIMEOUT_MS) {
      const errorMessage =
        `Advanced analysis timeout: completed ${sectionsCompleted}/${totalSections} sections in ${Math.round(elapsedMs / 1000)}s. ` +
        `Try using Hybrid or Basic strategy for this template, or reduce the transcript length.`;

      logger.error("Advanced Analysis", "Overall timeout approaching", {
        elapsedMs,
        remainingMs,
        sectionsCompleted,
        totalSections,
        currentSection: section.name,
      });

      throw new Error(errorMessage);
    }

    logger.info(
      "Advanced Analysis",
      `Processing section ${sectionIndex + 1}/${totalSections}: ${section.name}`,
      {
        elapsedMs,
        remainingMs,
        dependencies: section.dependencies || [],
        accumulatedContext: {
          sections: accumulated.sections?.length || 0,
          agendaItems: accumulated.agendaItems?.length || 0,
          decisions: accumulated.decisions?.length || 0,
        },
      },
    );

    // Notify progress
    if (progressCallback) {
      progressCallback(sectionIndex + 1, totalSections, section.name);
    }

    // Process this section sequentially
    try {
      const result = await processSection(section);

      // Immediately merge result into accumulated for next section's context
      sectionResponses.push({ name: result.name, response: result.response });
      promptsUsed.push(result.prompt);
      mergeSectionIntoResults(accumulated, result.name, result.response);
      sectionsCompleted++;

      const sectionDuration = Date.now() - sectionStart;
      logger.info("Advanced Analysis", `Section "${section.name}" complete`, {
        durationMs: sectionDuration,
        totalCompleted: sectionsCompleted,
        accumulatedContext: {
          sections: accumulated.sections?.length || 0,
          agendaItems: accumulated.agendaItems?.length || 0,
          decisions: accumulated.decisions?.length || 0,
          actionItems: accumulated.actionItems?.length || 0,
        },
      });
    } catch (error) {
      logger.error(
        "Advanced Analysis",
        `Error processing section "${section.name}"`,
        error,
      );
      throw new Error(`Failed to analyze section "${section.name}": ${error}`);
    }
  }

  // Verify all sections processed
  if (sectionsCompleted !== totalSections) {
    logger.warn(
      "Advanced Analysis",
      `Section count mismatch: processed ${sectionsCompleted}, expected ${totalSections}`,
    );
  }

  // Step 4: Merge all section results
  const rawResults = mergeSectionResults(sectionResponses);

  // Post-process: ensure unique IDs and validate relationships
  const draftResults = pruneResultsForTemplate(
    postProcessResults(rawResults, "Advanced Analysis"),
    template,
  );

  // Step 5: Generate comprehensive summary statistics
  const sectionsWithDeps = sortedSections.filter(
    (s) => s.dependencies && s.dependencies.length > 0,
  );
  const sectionsWithoutDeps = sortedSections.filter(
    (s) => !s.dependencies || s.dependencies.length === 0,
  );

  logger.info("Advanced Analysis", "Advanced analysis complete", {
    sectionsProcessed: sortedSections.length,
    sectionCount: draftResults.sections.length,
    agendaItemCount: draftResults.agendaItems?.length || 0,
    actionItemCount: draftResults.actionItems?.length || 0,
    decisionCount: draftResults.decisions?.length || 0,
  });

  // Log dependency chain effectiveness
  logger.info("Advanced Analysis", "Dependency chain statistics", {
    totalSections: sortedSections.length,
    sectionsWithContext: sectionsWithDeps.length,
    orphanSections: sectionsWithoutDeps.length,
    orphanSectionNames: sectionsWithoutDeps.map((s) => s.name),
    contextEffectiveness:
      sortedSections.length > 0
        ? `${Math.round((sectionsWithDeps.length / sortedSections.length) * 100)}%`
        : "N/A",
  });

  // Warn if template has poor dependency coverage
  if (
    sectionsWithoutDeps.length > sectionsWithDeps.length &&
    sortedSections.length > 2
  ) {
    logger.warn(
      "Advanced Analysis",
      `Template dependency coverage is low: ${sectionsWithoutDeps.length}/${sortedSections.length} sections have no dependencies. ` +
        "Advanced mode benefits most when sections build on each other. " +
        "Consider defining dependencies in template to improve contextual analysis.",
      {
        orphanSections: sectionsWithoutDeps.map((s) => ({
          id: s.id,
          name: s.name,
        })),
        recommendation:
          "Add dependencies field to template sections for better relationship mapping",
      },
    );
  }

  // Log relationship mapping statistics
  const totalDecisions = draftResults.decisions?.length || 0;
  const totalActions = draftResults.actionItems?.length || 0;
  const totalAgenda = draftResults.agendaItems?.length || 0;

  if (totalAgenda > 0 || totalDecisions > 0 || totalActions > 0) {
    const decisionsWithAgenda =
      draftResults.decisions?.filter(
        (d) => d.agendaItemIds && d.agendaItemIds.length > 0,
      ).length || 0;
    const actionsWithAnyLink =
      draftResults.actionItems?.filter(
        (a) =>
          (a.agendaItemIds && a.agendaItemIds.length > 0) ||
          (a.decisionIds && a.decisionIds.length > 0),
      ).length || 0;

    const orphanedDecisions = totalDecisions - decisionsWithAgenda;
    const orphanedActions = totalActions - actionsWithAnyLink;

    logger.info("Advanced Analysis", "Relationship mapping statistics", {
      totalAgendaItems: totalAgenda,
      totalDecisions,
      totalActionItems: totalActions,
      decisionsLinkedToAgenda: decisionsWithAgenda,
      actionsLinkedToAny: actionsWithAnyLink,
      decisionsOrphaned: orphanedDecisions,
      actionsOrphaned: orphanedActions,
      relationshipCoverage: {
        decisions:
          totalDecisions > 0
            ? `${Math.round((decisionsWithAgenda / totalDecisions) * 100)}%`
            : "N/A",
        actions:
          totalActions > 0
            ? `${Math.round((actionsWithAnyLink / totalActions) * 100)}%`
            : "N/A",
      },
    });

    // Warn about orphaned items if significant
    if (orphanedDecisions > 0 || orphanedActions > 0) {
      const orphanedDecisionsList =
        draftResults.decisions
          ?.filter((d) => !d.agendaItemIds || d.agendaItemIds.length === 0)
          .map((d) => d.decision.substring(0, 50)) || [];
      const orphanedActionsList =
        draftResults.actionItems
          ?.filter(
            (a) =>
              (!a.agendaItemIds || a.agendaItemIds.length === 0) &&
              (!a.decisionIds || a.decisionIds.length === 0),
          )
          .map((a) => a.task.substring(0, 50)) || [];

      logger.info("Advanced Analysis", "Orphaned items detected", {
        orphanedDecisions,
        orphanedActions,
        sampleOrphanedDecisions: orphanedDecisionsList.slice(0, 3),
        sampleOrphanedActions: orphanedActionsList.slice(0, 3),
        note: "Orphaned items may indicate discussion topics not in the formal agenda",
      });
    }
  } else {
    logger.info("Advanced Analysis", "No structured items extracted", {
      note: "Template may not be configured to extract agenda, decisions, or actions",
      templateOutputs: template.outputs,
    });
  }

  // Check if self-evaluation should run
  if (config?.runEvaluation) {
    logger.info("Advanced Analysis", "Running self-evaluation pass");
    const { evaluation, finalResults } = await executeEvaluationPass(
      template,
      transcript,
      draftResults,
      "advanced",
      openaiClient,
      deployment,
      promptsUsed,
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
