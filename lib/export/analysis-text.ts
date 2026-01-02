/**
 * Analysis Plain Text Export
 *
 * Generates beautifully formatted plain text with ASCII art-style formatting.
 * Designed for maximum readability in any text editor or email client.
 */

import type { Analysis, Transcript, Template } from "@/types";
import type { ExportOptions } from "./analysis-exporter";
import { formatTimestamp, formatDate } from "./analysis-exporter";
import { stripTimestamps } from "@/lib/analysis-utils";

/**
 * Character constants for box drawing
 */
const CHARS = {
  // Heavy lines
  DOUBLE_LINE: "=",
  SINGLE_LINE: "-",

  // Box corners and edges
  BOX_TOP_LEFT: "\u250C",
  BOX_TOP_RIGHT: "\u2510",
  BOX_BOTTOM_LEFT: "\u2514",
  BOX_BOTTOM_RIGHT: "\u2518",
  BOX_VERTICAL: "\u2502",
  BOX_HORIZONTAL: "\u2500",
  BOX_T_DOWN: "\u252C",
  BOX_T_UP: "\u2534",
  BOX_T_RIGHT: "\u251C",
  BOX_T_LEFT: "\u2524",
  BOX_CROSS: "\u253C",

  // Bullets and markers
  BULLET: "\u2022",
  ARROW: "\u25B8",
  CHECKBOX: "\u2610",
  TREE_BRANCH: "\u2514\u2500",
};

const LINE_WIDTH = 72;

/**
 * Create a centered text line
 */
function centerText(text: string, width: number = LINE_WIDTH): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(padding) + text;
}

/**
 * Create a horizontal line
 */
function horizontalLine(char: string = CHARS.SINGLE_LINE): string {
  return char.repeat(LINE_WIDTH);
}

/**
 * Create a double horizontal line
 */
function doubleLine(): string {
  return CHARS.DOUBLE_LINE.repeat(LINE_WIDTH);
}

/**
 * Wrap text to specified width with optional indent
 */
function wrapText(
  text: string,
  width: number = LINE_WIDTH,
  indent: string = ""
): string {
  const effectiveWidth = width - indent.length;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= effectiveWidth) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) {
        lines.push(indent + currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(indent + currentLine);
  }

  return lines.join("\n");
}

/**
 * Format section header
 */
function sectionHeader(title: string): string {
  return [
    "",
    horizontalLine(),
    centerText(title.toUpperCase()),
    horizontalLine(),
    "",
  ].join("\n");
}

/**
 * Generate the plain text export
 */
export function generateAnalysisText(
  analysis: Analysis,
  transcript: Transcript,
  template: Template,
  options: Required<ExportOptions>
): string {
  const sections: string[] = [];

  // Title block
  sections.push(doubleLine());
  sections.push(centerText("ANALYSIS REPORT"));
  sections.push(doubleLine());
  sections.push("");

  // Metadata section
  if (options.includeMetadata) {
    sections.push(`File:      ${transcript.filename}`);
    sections.push(`Template:  ${template.name}`);
    sections.push(`Generated: ${formatDate(new Date())}`);
    sections.push(`Analyzed:  ${formatDate(analysis.createdAt)}`);
    sections.push("");
  }

  // Executive Summary (timestamps stripped for clean copy/paste output)
  if (options.includeSummary && analysis.results.summary) {
    sections.push(sectionHeader("Executive Summary"));
    sections.push(wrapText(stripTimestamps(analysis.results.summary)));
    sections.push("");
  }

  // Analysis Sections
  if (options.includeSections && analysis.results.sections.length > 0) {
    for (const section of analysis.results.sections) {
      sections.push(sectionHeader(section.name));
      sections.push(wrapText(section.content));

      // Evidence citations - filter to only valid items
      const validEvidence = filterValidEvidence(section.evidence);
      if (options.includeEvidence && validEvidence && validEvidence.length > 0) {
        sections.push("");
        sections.push("  Evidence:");
        for (const evidence of validEvidence) {
          sections.push("");
          sections.push(`  ${CHARS.BULLET} "${truncateText(evidence.text, 60)}"`);
          sections.push(
            `    ${CHARS.TREE_BRANCH} [${formatTimestamp(evidence.start)}] ` +
              `Relevance: ${Math.round(evidence.relevance * 100)}%`
          );
        }
      }
      sections.push("");
    }
  }

  if (
    options.includeBenchmarks &&
    analysis.results.benchmarks &&
    analysis.results.benchmarks.length > 0
  ) {
    sections.push(sectionHeader("Benchmarks & Milestones"));
    sections.push("");
    for (const b of analysis.results.benchmarks) {
      sections.push(
        `${CHARS.BULLET} ${b.benchmark} | Status: ${b.status} | Time: ${
          b.timestamp !== undefined ? formatTimestamp(b.timestamp) : "-"
        }${b.unitOrRole ? ` | Unit: ${b.unitOrRole}` : ""}`
      );
      if (b.evidenceQuote) sections.push(`    Evidence: "${b.evidenceQuote}"`);
      if (b.notes) sections.push(`    Notes: ${b.notes}`);
      sections.push("");
    }
  }

  if (
    options.includeRadioReports &&
    analysis.results.radioReports &&
    analysis.results.radioReports.length > 0
  ) {
    sections.push(sectionHeader("Radio Reports & CAN"));
    sections.push("");
    for (const r of analysis.results.radioReports) {
      sections.push(
        `${CHARS.ARROW} [${formatTimestamp(r.timestamp)}] ${r.type.replace(/_/g, " ").toUpperCase()}${r.from ? ` | ${r.from}` : ""}`
      );
      if (r.fields && Object.keys(r.fields).length > 0) {
        Object.entries(r.fields).forEach(([k, v]) => {
          sections.push(`    ${k}: ${String(v)}`);
        });
      }
      if (r.evidenceQuote) sections.push(`    "${r.evidenceQuote}"`);
      if (r.missingRequired && r.missingRequired.length > 0) {
        sections.push(`    Missing: ${r.missingRequired.join(", ")}`);
      }
      sections.push("");
    }
  }

  if (
    options.includeSafetyEvents &&
    analysis.results.safetyEvents &&
    analysis.results.safetyEvents.length > 0
  ) {
    sections.push(sectionHeader("Safety & Accountability Events"));
    sections.push("");
    for (const e of analysis.results.safetyEvents) {
      sections.push(
        `${CHARS.BULLET} [${formatTimestamp(e.timestamp)}] ${e.type.replace(/_/g, " ").toUpperCase()} (${e.severity})${e.unitOrRole ? ` | ${e.unitOrRole}` : ""}`
      );
      sections.push(`    ${e.details}`);
      if (e.evidenceQuote) sections.push(`    "${e.evidenceQuote}"`);
      sections.push("");
    }
  }

  // Footer
  sections.push("");
  sections.push(horizontalLine());
  sections.push(centerText("Generated with Austin RTASS"));
  sections.push(doubleLine());

  return sections.join("\n");
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Filter evidence to only include items with valid data
 * Prevents NaN values when evidence was disabled during analysis
 */
function filterValidEvidence(evidence: Array<{ text: string; start: number; end: number; relevance: number }> | undefined) {
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
