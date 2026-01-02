/**
 * Analysis JSON Export
 *
 * Generates well-structured JSON with schema information for data interchange.
 * Includes metadata and supports selective inclusion of content sections.
 */

import type { Analysis, Transcript, Template } from "@/types";
import type { ExportOptions } from "./analysis-exporter";

/**
 * JSON export schema version for compatibility tracking
 */
const SCHEMA_VERSION = "1.0.0";

/**
 * Export envelope structure
 */
interface AnalysisExportEnvelope {
  /** Schema version for compatibility */
  schemaVersion: string;

  /** Export metadata */
  exportMetadata: {
    exportedAt: string;
    generator: string;
    generatorVersion: string;
  };

  /** Document information */
  document: {
    filename: string;
    analyzedAt: string;
    templateName: string;
    templateCategory: string;
  };

  /** Analysis content */
  analysis: {
    summary?: string;
    sections?: Array<{
      name: string;
      content: string;
      evidence?: Array<{
        text: string;
        startTime: number;
        endTime: number;
        startTimeFormatted: string;
        endTimeFormatted: string;
        relevanceScore: number;
      }>;
    }>;
    actionItems?: Array<{
      id: string;
      task: string;
      owner?: string;
      deadline?: string;
      timestamp?: number;
      timestampFormatted?: string;
    }>;
    decisions?: Array<{
      id: string;
      decision: string;
      timestamp: number;
      timestampFormatted: string;
      context?: string;
    }>;
    quotes?: Array<{
      text: string;
      speaker?: string;
      timestamp: number;
      timestampFormatted: string;
    }>;
  };

  /** Statistics about the analysis */
  statistics: {
    sectionCount: number;
    totalEvidenceCount: number;
    actionItemCount: number;
    decisionCount: number;
    quoteCount: number;
    wordCount: number;
  };
}

/**
 * Format timestamp seconds to HH:MM:SS or MM:SS
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Calculate word count from analysis results
 */
function calculateWordCount(analysis: Analysis): number {
  let count = 0;

  if (analysis.results.summary) {
    count += analysis.results.summary.split(/\s+/).length;
  }

  for (const section of analysis.results.sections) {
    count += section.content.split(/\s+/).length;
  }

  return count;
}

/**
 * Filter evidence to only include items with valid data
 * Prevents NaN values when evidence was disabled during analysis
 */
function filterValidEvidence(evidence: Analysis["results"]["sections"][0]["evidence"]) {
  return evidence?.filter(
    (e) =>
      e.text &&
      typeof e.start === "number" &&
      !isNaN(e.start) &&
      typeof e.end === "number" &&
      !isNaN(e.end) &&
      typeof e.relevance === "number" &&
      !isNaN(e.relevance)
  );
}

/**
 * Calculate total evidence count
 */
function calculateEvidenceCount(analysis: Analysis): number {
  return analysis.results.sections.reduce(
    (sum, section) => sum + (filterValidEvidence(section.evidence)?.length || 0),
    0
  );
}

/**
 * Generate the JSON export
 */
export function generateAnalysisJson(
  analysis: Analysis,
  transcript: Transcript,
  template: Template,
  options: Required<ExportOptions>
): string {
  const envelope: AnalysisExportEnvelope = {
    schemaVersion: SCHEMA_VERSION,

    exportMetadata: {
      exportedAt: new Date().toISOString(),
      generator: "Meeting Transcriber",
      generatorVersion: "1.0.0",
    },

    document: {
      filename: transcript.filename,
      analyzedAt: analysis.createdAt.toISOString(),
      templateName: template.name,
      templateCategory: template.category,
    },

    analysis: {},

    statistics: {
      sectionCount: analysis.results.sections.length,
      totalEvidenceCount: calculateEvidenceCount(analysis),
      actionItemCount: analysis.results.actionItems?.length || 0,
      decisionCount: analysis.results.decisions?.length || 0,
      quoteCount: analysis.results.quotes?.length || 0,
      wordCount: calculateWordCount(analysis),
    },
  };

  // Include summary if requested
  if (options.includeSummary && analysis.results.summary) {
    envelope.analysis.summary = analysis.results.summary;
  }

  // Include sections if requested
  if (options.includeSections) {
    envelope.analysis.sections = analysis.results.sections.map((section) => {
      // Filter evidence to only include valid items
      const validEvidence = filterValidEvidence(section.evidence);
      return {
        name: section.name,
        content: section.content,
        ...(options.includeEvidence && validEvidence && validEvidence.length > 0
          ? {
              evidence: validEvidence.map((e) => ({
                text: e.text,
                startTime: e.start,
                endTime: e.end,
                startTimeFormatted: formatTimestamp(e.start),
                endTimeFormatted: formatTimestamp(e.end),
                relevanceScore: e.relevance,
              })),
            }
          : {}),
      };
    });
  }

  // Include action items if requested
  if (
    options.includeActionItems &&
    analysis.results.actionItems &&
    analysis.results.actionItems.length > 0
  ) {
    envelope.analysis.actionItems = analysis.results.actionItems.map((item) => ({
      id: item.id,
      task: item.task,
      ...(item.owner ? { owner: item.owner } : {}),
      ...(item.deadline ? { deadline: item.deadline } : {}),
      ...(item.timestamp !== undefined
        ? {
            timestamp: item.timestamp,
            timestampFormatted: formatTimestamp(item.timestamp),
          }
        : {}),
    }));
  }

  // Include decisions if requested
  if (
    options.includeDecisions &&
    analysis.results.decisions &&
    analysis.results.decisions.length > 0
  ) {
    envelope.analysis.decisions = analysis.results.decisions.map((decision) => ({
      id: decision.id,
      decision: decision.decision,
      timestamp: decision.timestamp,
      timestampFormatted: formatTimestamp(decision.timestamp),
      ...(decision.context ? { context: decision.context } : {}),
    }));
  }

  // Include quotes if requested
  if (
    options.includeQuotes &&
    analysis.results.quotes &&
    analysis.results.quotes.length > 0
  ) {
    envelope.analysis.quotes = analysis.results.quotes.map((quote) => ({
      text: quote.text,
      ...(quote.speaker ? { speaker: quote.speaker } : {}),
      timestamp: quote.timestamp,
      timestampFormatted: formatTimestamp(quote.timestamp),
    }));
  }

  // Pretty-print with 2-space indentation
  return JSON.stringify(envelope, null, 2);
}

/**
 * Get the JSON schema for validation
 */
export function getAnalysisJsonSchema(): object {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Analysis Export",
    description: "Meeting Transcriber analysis export format",
    type: "object",
    required: ["schemaVersion", "exportMetadata", "document", "analysis", "statistics"],
    properties: {
      schemaVersion: {
        type: "string",
        description: "Schema version for compatibility tracking",
      },
      exportMetadata: {
        type: "object",
        required: ["exportedAt", "generator", "generatorVersion"],
        properties: {
          exportedAt: { type: "string", format: "date-time" },
          generator: { type: "string" },
          generatorVersion: { type: "string" },
        },
      },
      document: {
        type: "object",
        required: ["filename", "analyzedAt", "templateName", "templateCategory"],
        properties: {
          filename: { type: "string" },
          analyzedAt: { type: "string", format: "date-time" },
          templateName: { type: "string" },
          templateCategory: { type: "string" },
        },
      },
      analysis: {
        type: "object",
        properties: {
          summary: { type: "string" },
          sections: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "content"],
              properties: {
                name: { type: "string" },
                content: { type: "string" },
                evidence: {
                  type: "array",
                  items: {
                    type: "object",
                    required: [
                      "text",
                      "startTime",
                      "endTime",
                      "startTimeFormatted",
                      "endTimeFormatted",
                      "relevanceScore",
                    ],
                    properties: {
                      text: { type: "string" },
                      startTime: { type: "number" },
                      endTime: { type: "number" },
                      startTimeFormatted: { type: "string" },
                      endTimeFormatted: { type: "string" },
                      relevanceScore: { type: "number", minimum: 0, maximum: 1 },
                    },
                  },
                },
              },
            },
          },
          actionItems: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "task"],
              properties: {
                id: { type: "string" },
                task: { type: "string" },
                owner: { type: "string" },
                deadline: { type: "string" },
                timestamp: { type: "number" },
                timestampFormatted: { type: "string" },
              },
            },
          },
          decisions: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "decision", "timestamp", "timestampFormatted"],
              properties: {
                id: { type: "string" },
                decision: { type: "string" },
                timestamp: { type: "number" },
                timestampFormatted: { type: "string" },
                context: { type: "string" },
              },
            },
          },
          quotes: {
            type: "array",
            items: {
              type: "object",
              required: ["text", "timestamp", "timestampFormatted"],
              properties: {
                text: { type: "string" },
                speaker: { type: "string" },
                timestamp: { type: "number" },
                timestampFormatted: { type: "string" },
              },
            },
          },
        },
      },
      statistics: {
        type: "object",
        required: [
          "sectionCount",
          "totalEvidenceCount",
          "actionItemCount",
          "decisionCount",
          "quoteCount",
          "wordCount",
        ],
        properties: {
          sectionCount: { type: "integer", minimum: 0 },
          totalEvidenceCount: { type: "integer", minimum: 0 },
          actionItemCount: { type: "integer", minimum: 0 },
          decisionCount: { type: "integer", minimum: 0 },
          quoteCount: { type: "integer", minimum: 0 },
          wordCount: { type: "integer", minimum: 0 },
        },
      },
    },
  };
}
