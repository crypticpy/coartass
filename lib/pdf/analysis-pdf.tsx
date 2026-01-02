/**
 * Analysis PDF Document Component
 *
 * React-PDF component for generating professional analysis result PDFs.
 * Features:
 * - Clickable Table of Contents with page numbers
 * - Proper page break handling for all content types
 * - Section anchors for internal navigation
 * - Continuation headers for split content
 * - Professional business report styling
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Link,
} from "@react-pdf/renderer";
import { Analysis, Transcript } from "@/types";
import type { Template } from "@/types";
import { stripTimestamps } from "@/lib/analysis-utils";

/**
 * Register fonts for better typography
 */
Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: "bold" },
    { src: "Helvetica-Oblique", fontStyle: "italic" },
  ],
});

/**
 * Color palette for consistent styling
 */
const colors = {
  primary: "#0066cc",
  primaryLight: "#f0f7ff",
  text: "#1a1a1a",
  textMuted: "#666666",
  textLight: "#999999",
  border: "#e5e5e5",
  borderLight: "#f5f5f5",
  background: "#FFFFFF",
  backgroundAlt: "#f9f9f9",
  success: "#22c55e",
  warning: "#f59e0b",
  tableHeader: "#333333",
};

/**
 * PDF Stylesheet with professional business report styling
 */
const styles = StyleSheet.create({
  // Page layout
  page: {
    flexDirection: "column",
    backgroundColor: colors.background,
    paddingTop: 50,
    paddingBottom: 70, // Space for footer
    paddingHorizontal: 50,
    fontSize: 10,
    fontFamily: "Helvetica",
  },

  // Header section (first page only)
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
    borderBottomStyle: "solid",
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 6,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 3,
  },

  // Table of Contents
  tocPage: {
    flexDirection: "column",
    backgroundColor: colors.background,
    paddingTop: 50,
    paddingBottom: 70,
    paddingHorizontal: 50,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  tocTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    color: colors.text,
    textAlign: "center",
  },
  tocSection: {
    marginBottom: 15,
  },
  tocSectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tocItem: {
    flexDirection: "row",
    marginBottom: 6,
    paddingVertical: 4,
  },
  tocItemLink: {
    flex: 1,
    fontSize: 11,
    color: colors.primary,
    textDecoration: "none",
  },
  tocItemDots: {
    flex: 1,
    fontSize: 10,
    color: colors.textLight,
    marginHorizontal: 8,
  },
  tocItemPage: {
    fontSize: 11,
    color: colors.textMuted,
    width: 30,
    textAlign: "right",
  },

  // Metadata section
  metadata: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 4,
  },
  metadataRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  metadataLabel: {
    width: 110,
    fontWeight: "bold",
    color: colors.text,
    fontSize: 9,
  },
  metadataValue: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 9,
  },

  // Section styles
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.text,
  },
  sectionAnchor: {
    // Invisible anchor for navigation
    position: "absolute",
    top: -20,
  },
  sectionContent: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.6,
    marginBottom: 10,
    textAlign: "justify",
  },
  sectionContinuation: {
    fontSize: 8,
    color: colors.textLight,
    fontStyle: "italic",
    marginBottom: 8,
  },

  // Evidence styles
  evidenceContainer: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.primaryLight,
    borderLeftStyle: "solid",
  },
  evidenceTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  evidenceItem: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
    borderBottomStyle: "solid",
  },
  evidenceItemLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  evidenceText: {
    fontSize: 9,
    color: colors.textMuted,
    fontStyle: "italic",
    marginBottom: 3,
    lineHeight: 1.5,
  },
  evidenceTimestamp: {
    fontSize: 8,
    color: colors.textLight,
    backgroundColor: colors.backgroundAlt,
    padding: "2 6",
    borderRadius: 2,
    alignSelf: "flex-start",
  },

  // Summary section
  summarySection: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: colors.primaryLight,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderLeftStyle: "solid",
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
    color: colors.primary,
  },
  summaryText: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.7,
  },

  // Action Items table
  actionItemsSection: {
    marginBottom: 25,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.tableHeader,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    color: colors.background,
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
    minHeight: 30,
  },
  tableRowAlt: {
    backgroundColor: colors.backgroundAlt,
  },
  tableCell: {
    fontSize: 9,
    color: colors.text,
    lineHeight: 1.4,
  },
  taskCell: {
    width: "45%",
    paddingRight: 8,
  },
  ownerCell: {
    width: "22%",
    paddingRight: 8,
  },
  deadlineCell: {
    width: "20%",
    paddingRight: 8,
  },
  timestampCell: {
    width: "13%",
    fontSize: 8,
    color: colors.textMuted,
  },
  priorityBadge: {
    fontSize: 7,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 2,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  priorityHigh: {
    backgroundColor: "#fee2e2",
    color: "#dc2626",
  },
  priorityMedium: {
    backgroundColor: "#fef3c7",
    color: "#d97706",
  },
  priorityLow: {
    backgroundColor: "#dcfce7",
    color: "#16a34a",
  },

  // Decisions timeline
  decisionsSection: {
    marginBottom: 25,
  },
  decisionItem: {
    marginBottom: 12,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderLeftStyle: "solid",
  },
  decisionText: {
    fontSize: 10,
    color: colors.text,
    marginBottom: 4,
    fontWeight: "bold",
    lineHeight: 1.5,
  },
  decisionContext: {
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 4,
    fontStyle: "italic",
    lineHeight: 1.4,
  },
  decisionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  decisionTimestamp: {
    fontSize: 8,
    color: colors.textLight,
    backgroundColor: colors.backgroundAlt,
    padding: "2 6",
    borderRadius: 2,
  },

  // Quotes section
  quotesSection: {
    marginBottom: 25,
  },
  quoteItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: colors.backgroundAlt,
    borderLeftWidth: 3,
    borderLeftColor: colors.textLight,
    borderLeftStyle: "solid",
    borderRadius: 2,
  },
  quoteText: {
    fontSize: 10,
    color: colors.text,
    fontStyle: "italic",
    marginBottom: 8,
    lineHeight: 1.6,
  },
  quoteFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quoteSpeaker: {
    fontSize: 9,
    color: colors.primary,
    fontWeight: "bold",
  },
  quoteTimestamp: {
    fontSize: 8,
    color: colors.textLight,
  },
  quoteCategoryBadge: {
    fontSize: 7,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.borderLight,
    color: colors.textMuted,
    marginLeft: 8,
  },

  // Footer section
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopStyle: "solid",
    paddingTop: 8,
    fontSize: 8,
    color: colors.textLight,
  },
  footerLeft: {
    flex: 1,
  },
  footerCenter: {
    flex: 1,
    textAlign: "center",
  },
  footerRight: {
    flex: 1,
    textAlign: "right",
  },
  branding: {
    fontSize: 7,
    color: colors.textLight,
    marginTop: 2,
  },

  // Page break helpers
  pageBreakBefore: {
    // Use break prop instead
  },
  keepTogether: {
    // Marker style for elements that should stay together
  },
});

/**
 * Helper function to format timestamp
 */
function formatTimestamp(seconds: number): string {
  if (typeof seconds !== "number" || isNaN(seconds)) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Helper function to format date
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Generate a safe anchor ID from text
 */
function generateAnchorId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Props for AnalysisPDFDocument
 */
export interface AnalysisPDFDocumentProps {
  /** The analysis results to render */
  analysis: Analysis;
  /** The source transcript for context */
  transcript: Transcript;
  /** Optional template information */
  template?: Template;
  /** Whether to include table of contents */
  includeTableOfContents?: boolean;
}

/**
 * Footer Component - renders on every page
 */
const PDFFooter: React.FC<{ transcript: Transcript }> = ({ transcript }) => (
  <View style={styles.footer} fixed>
    <View style={styles.footerLeft}>
      <Text>{transcript.filename}</Text>
      <Text style={styles.branding}>Generated with Meeting Transcriber</Text>
    </View>
    <View style={styles.footerCenter}>
      <Text>Analysis Report</Text>
    </View>
    <View style={styles.footerRight}>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  </View>
);

/**
 * Header Component - renders on first page
 */
const PDFHeader: React.FC<{
  transcript: Transcript;
  template?: Template;
}> = ({ transcript, template }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>Analysis Report</Text>
    <Text style={styles.headerSubtitle}>{transcript.filename}</Text>
    {template && (
      <Text style={styles.headerSubtitle}>Template: {template.name}</Text>
    )}
    <Text style={styles.headerSubtitle}>
      Generated on {formatDate(new Date())}
    </Text>
  </View>
);

/**
 * Metadata Component
 */
const PDFMetadata: React.FC<{
  analysis: Analysis;
  transcript: Transcript;
  template?: Template;
}> = ({ analysis, transcript, template }) => (
  <View style={styles.metadata} wrap={false}>
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>Source File:</Text>
      <Text style={styles.metadataValue}>{transcript.filename}</Text>
    </View>
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>Analyzed:</Text>
      <Text style={styles.metadataValue}>{formatDate(analysis.createdAt)}</Text>
    </View>
    {template && (
      <>
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Template:</Text>
          <Text style={styles.metadataValue}>{template.name}</Text>
        </View>
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Category:</Text>
          <Text style={styles.metadataValue}>
            {template.category.charAt(0).toUpperCase() + template.category.slice(1)}
          </Text>
        </View>
      </>
    )}
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>Sections:</Text>
      <Text style={styles.metadataValue}>
        {analysis.results.sections.length}
      </Text>
    </View>
    {analysis.results.actionItems && analysis.results.actionItems.length > 0 && (
      <View style={styles.metadataRow}>
        <Text style={styles.metadataLabel}>Action Items:</Text>
        <Text style={styles.metadataValue}>
          {analysis.results.actionItems.length}
        </Text>
      </View>
    )}
    {analysis.results.decisions && analysis.results.decisions.length > 0 && (
      <View style={styles.metadataRow}>
        <Text style={styles.metadataLabel}>Decisions:</Text>
        <Text style={styles.metadataValue}>
          {analysis.results.decisions.length}
        </Text>
      </View>
    )}
    {analysis.results.quotes && analysis.results.quotes.length > 0 && (
      <View style={styles.metadataRow}>
        <Text style={styles.metadataLabel}>Notable Quotes:</Text>
        <Text style={styles.metadataValue}>
          {analysis.results.quotes.length}
        </Text>
      </View>
    )}
    {analysis.analysisStrategy && (
      <View style={styles.metadataRow}>
        <Text style={styles.metadataLabel}>Strategy:</Text>
        <Text style={styles.metadataValue}>
          {analysis.analysisStrategy.charAt(0).toUpperCase() + analysis.analysisStrategy.slice(1)}
        </Text>
      </View>
    )}
  </View>
);

/**
 * Table of Contents Component with clickable links
 */
const TableOfContents: React.FC<{ analysis: Analysis }> = ({ analysis }) => {
  const hasSummary = !!analysis.results.summary;
  const hasActionItems = analysis.results.actionItems && analysis.results.actionItems.length > 0;
  const hasDecisions = analysis.results.decisions && analysis.results.decisions.length > 0;
  const hasQuotes = analysis.results.quotes && analysis.results.quotes.length > 0;

  return (
    <View>
      <Text style={styles.tocTitle}>Table of Contents</Text>

      {/* Main Sections */}
      <View style={styles.tocSection}>
        {hasSummary && (
          <View style={styles.tocItem} wrap={false}>
            <Link src="#executive-summary" style={styles.tocItemLink}>
              Executive Summary
            </Link>
          </View>
        )}

        {analysis.results.sections.map((section, index) => (
          <View key={index} style={styles.tocItem} wrap={false}>
            <Link
              src={`#section-${generateAnchorId(section.name)}`}
              style={styles.tocItemLink}
            >
              {section.name}
            </Link>
          </View>
        ))}
      </View>

      {/* Additional Sections */}
      {(hasActionItems || hasDecisions || hasQuotes) && (
        <View style={styles.tocSection}>
          <Text style={styles.tocSectionTitle}>Additional Content</Text>

          {hasActionItems && (
            <View style={styles.tocItem} wrap={false}>
              <Link src="#action-items" style={styles.tocItemLink}>
                Action Items ({analysis.results.actionItems!.length})
              </Link>
            </View>
          )}

          {hasDecisions && (
            <View style={styles.tocItem} wrap={false}>
              <Link src="#decisions" style={styles.tocItemLink}>
                Decisions Timeline ({analysis.results.decisions!.length})
              </Link>
            </View>
          )}

          {hasQuotes && (
            <View style={styles.tocItem} wrap={false}>
              <Link src="#notable-quotes" style={styles.tocItemLink}>
                Notable Quotes ({analysis.results.quotes!.length})
              </Link>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

/**
 * Summary Component with proper wrapping
 */
const SummarySection: React.FC<{ summary: string }> = ({ summary }) => (
  <View style={styles.summarySection} id="executive-summary">
    <Text style={styles.summaryTitle}>Executive Summary</Text>
    {/* Strip timestamps from executive summary for clean copy/paste output */}
    <Text style={styles.summaryText}>{stripTimestamps(summary)}</Text>
  </View>
);

/**
 * Analysis Section Component with evidence
 */
const AnalysisSection: React.FC<{
  section: Analysis["results"]["sections"][0];
  isLast?: boolean;
}> = ({ section, isLast: _isLast }) => {
  // Filter evidence to only include items with valid data
  const validEvidence = section.evidence?.filter(
    (e) =>
      e.text &&
      typeof e.start === "number" &&
      !isNaN(e.start) &&
      typeof e.end === "number" &&
      !isNaN(e.end) &&
      typeof e.relevance === "number" &&
      !isNaN(e.relevance)
  );

  const anchorId = `section-${generateAnchorId(section.name)}`;

  return (
    <View style={styles.section} id={anchorId} wrap>
      {/* Section Header - keep together */}
      <View style={styles.sectionHeader} wrap={false}>
        <Text style={styles.sectionTitle}>{section.name}</Text>
      </View>

      {/* Section Content - allow wrapping */}
      <Text style={styles.sectionContent}>{section.content}</Text>

      {/* Evidence - keep each item together */}
      {validEvidence && validEvidence.length > 0 && (
        <View style={styles.evidenceContainer}>
          <Text style={styles.evidenceTitle}>Supporting Evidence:</Text>
          {validEvidence.map((evidence, index) => (
            <View
              key={index}
              style={
                index === validEvidence.length - 1
                  ? [styles.evidenceItem, styles.evidenceItemLast]
                  : styles.evidenceItem
              }
              wrap={false}
            >
              <Text style={styles.evidenceText}>&quot;{evidence.text}&quot;</Text>
              <Text style={styles.evidenceTimestamp}>
                {formatTimestamp(evidence.start)} - {formatTimestamp(evidence.end)} | Relevance: {(evidence.relevance * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

/**
 * Action Items Table Component with proper row handling
 */
const ActionItemsTable: React.FC<{
  actionItems: NonNullable<Analysis["results"]["actionItems"]>;
}> = ({ actionItems }) => (
  <View style={styles.actionItemsSection} id="action-items">
    <View style={styles.sectionHeader} wrap={false}>
      <Text style={styles.sectionTitle}>Action Items</Text>
    </View>

    <View style={styles.table}>
      {/* Table Header - keep with first row */}
      <View style={styles.tableHeader} wrap={false}>
        <Text style={[styles.tableHeaderCell, styles.taskCell]}>Task</Text>
        <Text style={[styles.tableHeaderCell, styles.ownerCell]}>Owner</Text>
        <Text style={[styles.tableHeaderCell, styles.deadlineCell]}>Deadline</Text>
        <Text style={[styles.tableHeaderCell, styles.timestampCell]}>Time</Text>
      </View>

      {/* Table Rows - keep each row together */}
      {actionItems.map((item, index) => (
        <View
          key={index}
          style={
            index % 2 === 1
              ? [styles.tableRow, styles.tableRowAlt]
              : styles.tableRow
          }
          wrap={false}
          minPresenceAhead={20}
        >
          <View style={styles.taskCell}>
            <Text style={styles.tableCell}>{item.task}</Text>
            {item.priority && (
              <Text
                style={[
                  styles.priorityBadge,
                  item.priority === "high"
                    ? styles.priorityHigh
                    : item.priority === "medium"
                      ? styles.priorityMedium
                      : styles.priorityLow,
                ]}
              >
                {item.priority.toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={[styles.tableCell, styles.ownerCell]}>
            {item.owner || "—"}
          </Text>
          <Text style={[styles.tableCell, styles.deadlineCell]}>
            {item.deadline || "—"}
          </Text>
          <Text style={[styles.tableCell, styles.timestampCell]}>
            {item.timestamp !== undefined ? formatTimestamp(item.timestamp) : "—"}
          </Text>
        </View>
      ))}
    </View>
  </View>
);

/**
 * Decisions Timeline Component
 */
const DecisionsTimeline: React.FC<{
  decisions: NonNullable<Analysis["results"]["decisions"]>;
}> = ({ decisions }) => (
  <View style={styles.decisionsSection} id="decisions">
    <View style={styles.sectionHeader} wrap={false}>
      <Text style={styles.sectionTitle}>Decisions Timeline</Text>
    </View>

    {decisions.map((decision, index) => (
      <View key={index} style={styles.decisionItem} wrap={false} minPresenceAhead={30}>
        <Text style={styles.decisionText}>{decision.decision}</Text>
        {decision.context && (
          <Text style={styles.decisionContext}>{decision.context}</Text>
        )}
        <View style={styles.decisionMeta}>
          <Text style={styles.decisionTimestamp}>
            {formatTimestamp(decision.timestamp)}
          </Text>
        </View>
      </View>
    ))}
  </View>
);

/**
 * Quotes Section Component
 */
const QuotesSection: React.FC<{
  quotes: NonNullable<Analysis["results"]["quotes"]>;
}> = ({ quotes }) => (
  <View style={styles.quotesSection} id="notable-quotes">
    <View style={styles.sectionHeader} wrap={false}>
      <Text style={styles.sectionTitle}>Notable Quotes</Text>
    </View>

    {quotes.map((quote, index) => (
      <View key={index} style={styles.quoteItem} wrap={false} minPresenceAhead={40}>
        <Text style={styles.quoteText}>&quot;{quote.text}&quot;</Text>
        <View style={styles.quoteFooter}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {quote.speaker && (
              <Text style={styles.quoteSpeaker}>— {quote.speaker}</Text>
            )}
            {quote.category && (
              <Text style={styles.quoteCategoryBadge}>{quote.category}</Text>
            )}
          </View>
          <Text style={styles.quoteTimestamp}>
            {formatTimestamp(quote.timestamp)}
          </Text>
        </View>
      </View>
    ))}
  </View>
);

/**
 * AnalysisPDFDocument Component
 *
 * Main PDF document component that renders complete analysis results
 * with professional formatting suitable for business reports.
 *
 * Features:
 * - Clickable Table of Contents with internal links
 * - Proper page break handling for all content types
 * - Section anchors for navigation
 * - Professional styling and typography
 *
 * @example
 * ```tsx
 * import { pdf } from '@react-pdf/renderer';
 * import { AnalysisPDFDocument } from './analysis-pdf';
 *
 * const blob = await pdf(
 *   <AnalysisPDFDocument analysis={analysis} transcript={transcript} />
 * ).toBlob();
 * ```
 */
export const AnalysisPDFDocument: React.FC<AnalysisPDFDocumentProps> = ({
  analysis,
  transcript,
  template,
  includeTableOfContents = true,
}) => {
  const hasActionItems =
    analysis.results.actionItems && analysis.results.actionItems.length > 0;
  const hasDecisions =
    analysis.results.decisions && analysis.results.decisions.length > 0;
  const hasQuotes =
    analysis.results.quotes && analysis.results.quotes.length > 0;

  return (
    <Document
      title={`Analysis - ${transcript.filename}`}
      author="Meeting Transcriber"
      subject="Transcript Analysis Report"
      keywords="analysis, transcript, meeting, report"
      creator="Meeting Transcriber"
    >
      {/* Cover/Title Page with TOC */}
      {includeTableOfContents && (
        <Page size="A4" style={styles.tocPage}>
          <PDFHeader transcript={transcript} template={template} />
          <PDFMetadata
            analysis={analysis}
            transcript={transcript}
            template={template}
          />
          <TableOfContents analysis={analysis} />
          <PDFFooter transcript={transcript} />
        </Page>
      )}

      {/* Main Content Page(s) */}
      <Page size="A4" style={styles.page} wrap>
        {/* If no TOC, show header on first content page */}
        {!includeTableOfContents && (
          <>
            <PDFHeader transcript={transcript} template={template} />
            <PDFMetadata
              analysis={analysis}
              transcript={transcript}
              template={template}
            />
          </>
        )}

        {/* Executive Summary */}
        {analysis.results.summary && (
          <SummarySection summary={analysis.results.summary} />
        )}

        {/* Analysis Sections */}
        {analysis.results.sections.map((section, index) => (
          <AnalysisSection
            key={index}
            section={section}
            isLast={index === analysis.results.sections.length - 1}
          />
        ))}

        {/* Action Items Table */}
        {hasActionItems && (
          <ActionItemsTable actionItems={analysis.results.actionItems!} />
        )}

        {/* Decisions Timeline */}
        {hasDecisions && (
          <DecisionsTimeline decisions={analysis.results.decisions!} />
        )}

        {/* Notable Quotes */}
        {hasQuotes && <QuotesSection quotes={analysis.results.quotes!} />}

        <PDFFooter transcript={transcript} />
      </Page>
    </Document>
  );
};

/**
 * Export default for convenience
 */
export default AnalysisPDFDocument;
