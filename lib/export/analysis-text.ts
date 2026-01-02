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
 * Create a boxed section of text
 */
function createBox(lines: string[], width: number = LINE_WIDTH - 2): string {
  const innerWidth = width - 2;
  const result: string[] = [];

  // Top border
  result.push(
    CHARS.BOX_TOP_LEFT +
      CHARS.BOX_HORIZONTAL.repeat(innerWidth) +
      CHARS.BOX_TOP_RIGHT
  );

  // Content lines
  for (const line of lines) {
    const paddedLine = line.padEnd(innerWidth);
    result.push(
      CHARS.BOX_VERTICAL + paddedLine.substring(0, innerWidth) + CHARS.BOX_VERTICAL
    );
  }

  // Bottom border
  result.push(
    CHARS.BOX_BOTTOM_LEFT +
      CHARS.BOX_HORIZONTAL.repeat(innerWidth) +
      CHARS.BOX_BOTTOM_RIGHT
  );

  return result.join("\n");
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

  // Action Items
  if (
    options.includeActionItems &&
    analysis.results.actionItems &&
    analysis.results.actionItems.length > 0
  ) {
    sections.push(sectionHeader("Action Items"));
    sections.push("");

    const actionLines: string[] = [];
    for (const item of analysis.results.actionItems) {
      actionLines.push(` ${CHARS.CHECKBOX} ${truncateText(item.task, 60)}`);
      const details: string[] = [];
      if (item.owner) details.push(`Owner: ${item.owner}`);
      if (item.deadline) details.push(`Due: ${item.deadline}`);
      if (item.timestamp !== undefined) {
        details.push(`Mentioned at ${formatTimestamp(item.timestamp)}`);
      }
      if (details.length > 0) {
        actionLines.push(`   ${details.join(" | ")}`);
      }
      actionLines.push("");
    }

    sections.push(createBox(actionLines));
    sections.push("");
  }

  // Decisions
  if (
    options.includeDecisions &&
    analysis.results.decisions &&
    analysis.results.decisions.length > 0
  ) {
    sections.push(sectionHeader("Decisions"));
    sections.push("");

    for (const decision of analysis.results.decisions) {
      sections.push(
        `${CHARS.ARROW} [${formatTimestamp(decision.timestamp)}] ${decision.decision}`
      );
      if (decision.context) {
        sections.push(`  Context: ${wrapText(decision.context, LINE_WIDTH - 10, "  ")}`);
      }
      sections.push("");
    }
  }

  // Notable Quotes
  if (
    options.includeQuotes &&
    analysis.results.quotes &&
    analysis.results.quotes.length > 0
  ) {
    sections.push(sectionHeader("Notable Quotes"));
    sections.push("");

    for (const quote of analysis.results.quotes) {
      sections.push(`  "${wrapText(quote.text, LINE_WIDTH - 4, "   ").trim()}"`);
      const attribution: string[] = [];
      if (quote.speaker) attribution.push(`\u2014 ${quote.speaker}`);
      attribution.push(`[${formatTimestamp(quote.timestamp)}]`);
      sections.push(`    ${attribution.join(" ")}`);
      sections.push("");
    }
  }

  // Footer
  sections.push("");
  sections.push(horizontalLine());
  sections.push(centerText("Generated with Meeting Transcriber"));
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
