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
const SCHEMA_VERSION = "1.1.0";

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
    benchmarks?: Array<{
      id: string;
      benchmark: string;
      status: string;
      timestamp?: number;
      timestampFormatted?: string;
      unitOrRole?: string;
      evidenceQuote?: string;
      notes?: string;
    }>;
    radioReports?: Array<{
      id: string;
      type: string;
      timestamp: number;
      timestampFormatted: string;
      from?: string;
      fields?: Record<string, unknown>;
      missingRequired?: string[];
      evidenceQuote?: string;
    }>;
    safetyEvents?: Array<{
      id: string;
      type: string;
      severity: string;
      timestamp: number;
      timestampFormatted: string;
      unitOrRole?: string;
      details: string;
      evidenceQuote?: string;
    }>;
  };

  /** Statistics about the analysis */
  statistics: {
    sectionCount: number;
    totalEvidenceCount: number;
    benchmarkCount: number;
    radioReportCount: number;
    safetyEventCount: number;
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
      generator: "Austin RTASS",
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
      benchmarkCount: analysis.results.benchmarks?.length || 0,
      radioReportCount: analysis.results.radioReports?.length || 0,
      safetyEventCount: analysis.results.safetyEvents?.length || 0,
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

  // Structured logs
  if (
    options.includeBenchmarks &&
    analysis.results.benchmarks &&
    analysis.results.benchmarks.length > 0
  ) {
    envelope.analysis.benchmarks = analysis.results.benchmarks.map((item) => ({
      id: item.id,
      benchmark: item.benchmark,
      status: item.status,
      ...(item.timestamp !== undefined
        ? { timestamp: item.timestamp, timestampFormatted: formatTimestamp(item.timestamp) }
        : {}),
      ...(item.unitOrRole ? { unitOrRole: item.unitOrRole } : {}),
      ...(item.evidenceQuote ? { evidenceQuote: item.evidenceQuote } : {}),
      ...(item.notes ? { notes: item.notes } : {}),
    }));
  }

  if (
    options.includeRadioReports &&
    analysis.results.radioReports &&
    analysis.results.radioReports.length > 0
  ) {
    envelope.analysis.radioReports = analysis.results.radioReports.map((item) => ({
      id: item.id,
      type: item.type,
      timestamp: item.timestamp,
      timestampFormatted: formatTimestamp(item.timestamp),
      ...(item.from ? { from: item.from } : {}),
      ...(item.fields ? { fields: item.fields } : {}),
      ...(item.missingRequired ? { missingRequired: item.missingRequired } : {}),
      ...(item.evidenceQuote ? { evidenceQuote: item.evidenceQuote } : {}),
    }));
  }

  if (
    options.includeSafetyEvents &&
    analysis.results.safetyEvents &&
    analysis.results.safetyEvents.length > 0
  ) {
    envelope.analysis.safetyEvents = analysis.results.safetyEvents.map((item) => ({
      id: item.id,
      type: item.type,
      severity: item.severity,
      timestamp: item.timestamp,
      timestampFormatted: formatTimestamp(item.timestamp),
      ...(item.unitOrRole ? { unitOrRole: item.unitOrRole } : {}),
      details: item.details,
      ...(item.evidenceQuote ? { evidenceQuote: item.evidenceQuote } : {}),
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
    description: "Austin RTASS analysis export format",
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
          benchmarks: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "benchmark", "status"],
              properties: {
                id: { type: "string" },
                benchmark: { type: "string" },
                status: { type: "string" },
                timestamp: { type: "number" },
                timestampFormatted: { type: "string" },
                unitOrRole: { type: "string" },
                evidenceQuote: { type: "string" },
                notes: { type: "string" },
              },
            },
          },
          radioReports: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "type", "timestamp", "timestampFormatted"],
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                timestamp: { type: "number" },
                timestampFormatted: { type: "string" },
                from: { type: "string" },
                fields: { type: "object", additionalProperties: true },
                missingRequired: { type: "array", items: { type: "string" } },
                evidenceQuote: { type: "string" },
              },
            },
          },
          safetyEvents: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "type", "severity", "timestamp", "timestampFormatted", "details"],
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                severity: { type: "string" },
                timestamp: { type: "number" },
                timestampFormatted: { type: "string" },
                unitOrRole: { type: "string" },
                details: { type: "string" },
                evidenceQuote: { type: "string" },
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
          "benchmarkCount",
          "radioReportCount",
          "safetyEventCount",
          "wordCount",
        ],
        properties: {
          sectionCount: { type: "integer", minimum: 0 },
          totalEvidenceCount: { type: "integer", minimum: 0 },
          benchmarkCount: { type: "integer", minimum: 0 },
          radioReportCount: { type: "integer", minimum: 0 },
          safetyEventCount: { type: "integer", minimum: 0 },
          wordCount: { type: "integer", minimum: 0 },
        },
      },
    },
  };
}
