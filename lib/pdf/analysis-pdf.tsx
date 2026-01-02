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
  danger: "#ef4444",
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

  // Benchmark/Radio/Safety cards
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "solid",
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
    backgroundColor: colors.backgroundAlt,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  badge: {
    fontSize: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    color: "#fff",
  },
  badgeNeutral: { backgroundColor: colors.textLight },
  badgeSuccess: { backgroundColor: colors.success },
  badgeWarning: { backgroundColor: colors.warning },
  badgeDanger: { backgroundColor: colors.danger },
  benchmarkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  benchmarkLabel: {
    width: 110,
    fontSize: 9,
    color: colors.textMuted,
  },
  benchmarkValue: {
    flex: 1,
    fontSize: 9,
    color: colors.text,
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
  /** Whether to include metadata block */
  includeMetadata?: boolean;
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
      <Text style={styles.branding}>Generated with Austin RTASS</Text>
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
    {analysis.results.benchmarks && analysis.results.benchmarks.length > 0 && (
      <View style={styles.metadataRow}>
        <Text style={styles.metadataLabel}>Benchmarks:</Text>
        <Text style={styles.metadataValue}>
          {analysis.results.benchmarks.length}
        </Text>
      </View>
    )}
    {analysis.results.radioReports && analysis.results.radioReports.length > 0 && (
      <View style={styles.metadataRow}>
        <Text style={styles.metadataLabel}>Radio Reports:</Text>
        <Text style={styles.metadataValue}>
          {analysis.results.radioReports.length}
        </Text>
      </View>
    )}
    {analysis.results.safetyEvents && analysis.results.safetyEvents.length > 0 && (
      <View style={styles.metadataRow}>
        <Text style={styles.metadataLabel}>Safety Events:</Text>
        <Text style={styles.metadataValue}>
          {analysis.results.safetyEvents.length}
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
  const hasBenchmarks = analysis.results.benchmarks && analysis.results.benchmarks.length > 0;
  const hasRadioReports = analysis.results.radioReports && analysis.results.radioReports.length > 0;
  const hasSafetyEvents = analysis.results.safetyEvents && analysis.results.safetyEvents.length > 0;

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
      {(hasBenchmarks || hasRadioReports || hasSafetyEvents) && (
        <View style={styles.tocSection}>
          <Text style={styles.tocSectionTitle}>Additional Content</Text>

          {hasBenchmarks && (
            <View style={styles.tocItem} wrap={false}>
              <Link src="#benchmarks" style={styles.tocItemLink}>
                Benchmarks &amp; Milestones ({analysis.results.benchmarks!.length})
              </Link>
            </View>
          )}

          {hasRadioReports && (
            <View style={styles.tocItem} wrap={false}>
              <Link src="#radio-reports" style={styles.tocItemLink}>
                Radio Reports ({analysis.results.radioReports!.length})
              </Link>
            </View>
          )}

          {hasSafetyEvents && (
            <View style={styles.tocItem} wrap={false}>
              <Link src="#safety-events" style={styles.tocItemLink}>
                Safety Events ({analysis.results.safetyEvents!.length})
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
              minPresenceAhead={40}
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

const BenchmarksSection: React.FC<{
  benchmarks: NonNullable<Analysis["results"]["benchmarks"]>;
}> = ({ benchmarks }) => (
  <View style={styles.section} id="benchmarks" wrap>
    <View style={styles.sectionHeader} wrap={false}>
      <Text style={styles.sectionTitle}>Benchmarks &amp; Milestones</Text>
    </View>
    {benchmarks.map((b, idx) => {
      const statusStyle =
        b.status === "met"
          ? styles.badgeSuccess
          : b.status === "missed"
            ? styles.badgeDanger
            : b.status === "not_observed"
              ? styles.badgeWarning
            : styles.badgeNeutral;
      return (
        <View key={idx} style={styles.card} minPresenceAhead={80}>
          <View style={styles.cardHeader}>
            <Text style={{ fontSize: 11, fontWeight: "bold", color: colors.text }}>
              {b.benchmark}
            </Text>
            <Text style={[styles.badge, statusStyle]}>{b.status.replace("_", " ")}</Text>
          </View>
          <View style={styles.benchmarkRow}>
            <Text style={styles.benchmarkLabel}>Time</Text>
            <Text style={styles.benchmarkValue}>
              {b.timestamp !== undefined ? formatTimestamp(b.timestamp) : "-"}
            </Text>
          </View>
          <View style={styles.benchmarkRow}>
            <Text style={styles.benchmarkLabel}>Unit/Role</Text>
            <Text style={styles.benchmarkValue}>{b.unitOrRole || "-"}</Text>
          </View>
          <View style={styles.benchmarkRow}>
            <Text style={styles.benchmarkLabel}>Evidence</Text>
            <Text style={styles.benchmarkValue}>{b.evidenceQuote || "-"}</Text>
          </View>
          {b.notes && (
            <View style={styles.benchmarkRow}>
              <Text style={styles.benchmarkLabel}>Notes</Text>
              <Text style={styles.benchmarkValue}>{b.notes}</Text>
            </View>
          )}
        </View>
      );
    })}
  </View>
);

const RadioReportsSection: React.FC<{
  reports: NonNullable<Analysis["results"]["radioReports"]>;
}> = ({ reports }) => (
  <View style={styles.section} id="radio-reports" wrap>
    <View style={styles.sectionHeader} wrap={false}>
      <Text style={styles.sectionTitle}>Radio Reports &amp; CAN</Text>
    </View>
    {reports.map((r, idx) => (
      <View key={idx} style={styles.card} minPresenceAhead={90}>
        <View style={styles.cardHeader}>
          <Text style={{ fontSize: 11, fontWeight: "bold", color: colors.text }}>
            {r.type.replace(/_/g, " ").toUpperCase()}
          </Text>
          <Text style={[styles.badge, styles.badgeNeutral]}>{formatTimestamp(r.timestamp)}</Text>
        </View>
        <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>
          {r.from || "Unknown unit"}
        </Text>
        {r.fields && Object.keys(r.fields).length > 0 && (
          <View style={{ marginBottom: 4 }}>
            {Object.entries(r.fields).map(([key, value]) => (
              <Text key={key} style={{ fontSize: 9, color: colors.text }}>
                {key}: {String(value)}
              </Text>
            ))}
          </View>
        )}
        {r.evidenceQuote && (
          <Text style={{ fontSize: 9, color: colors.textMuted, fontStyle: "italic" }}>
            “{r.evidenceQuote}”
          </Text>
        )}
        {r.missingRequired && r.missingRequired.length > 0 && (
          <Text style={{ fontSize: 9, color: colors.warning, marginTop: 4 }}>
            Missing: {r.missingRequired.join(", ")}
          </Text>
        )}
      </View>
    ))}
  </View>
);

const SafetyEventsSection: React.FC<{
  events: NonNullable<Analysis["results"]["safetyEvents"]>;
}> = ({ events }) => (
  <View style={styles.section} id="safety-events" wrap>
    <View style={styles.sectionHeader} wrap={false}>
      <Text style={styles.sectionTitle}>Safety &amp; Accountability</Text>
    </View>
    {events.map((e, idx) => {
      const color =
        e.severity === "critical"
          ? styles.badgeDanger
          : e.severity === "warning"
            ? styles.badgeWarning
            : styles.badgeNeutral;
      return (
        <View key={idx} style={styles.card} minPresenceAhead={80}>
          <View style={styles.cardHeader}>
            <Text style={{ fontSize: 11, fontWeight: "bold", color: colors.text }}>
              {e.type.replace(/_/g, " ").toUpperCase()}
            </Text>
            <Text style={[styles.badge, color]}>{e.severity.toUpperCase()}</Text>
          </View>
          <Text style={{ fontSize: 10, color: colors.textMuted }}>
            {e.unitOrRole || "Unknown unit"} • {formatTimestamp(e.timestamp)}
          </Text>
          <Text style={{ fontSize: 10, color: colors.text, marginTop: 4 }}>{e.details}</Text>
          {e.evidenceQuote && (
            <Text style={{ fontSize: 9, color: colors.textMuted, fontStyle: "italic", marginTop: 4 }}>
              “{e.evidenceQuote}”
            </Text>
          )}
        </View>
      );
    })}
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
  includeMetadata = true,
  includeTableOfContents = true,
}) => {
  const hasBenchmarks =
    analysis.results.benchmarks && analysis.results.benchmarks.length > 0;
  const hasRadioReports =
    analysis.results.radioReports && analysis.results.radioReports.length > 0;
  const hasSafetyEvents =
    analysis.results.safetyEvents && analysis.results.safetyEvents.length > 0;
  const hasStructuredOutputs = hasBenchmarks || hasRadioReports || hasSafetyEvents;

  return (
    <Document
      title={`Analysis - ${transcript.filename}`}
      author="Austin RTASS"
      subject="Transcript Analysis Report"
      keywords="analysis, transcript, radio, fire, ems"
      creator="Austin RTASS"
    >
      {/* Cover/Title Page with TOC */}
      {includeTableOfContents && (
        <Page size="A4" style={styles.tocPage}>
          <PDFHeader transcript={transcript} template={template} />
          {includeMetadata && (
            <PDFMetadata
              analysis={analysis}
              transcript={transcript}
              template={template}
            />
          )}
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
            {includeMetadata && (
              <PDFMetadata
                analysis={analysis}
                transcript={transcript}
                template={template}
              />
            )}
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

        {hasStructuredOutputs && <View break />}

        {hasBenchmarks && <BenchmarksSection benchmarks={analysis.results.benchmarks!} />}
        {hasRadioReports && <RadioReportsSection reports={analysis.results.radioReports!} />}
        {hasSafetyEvents && <SafetyEventsSection events={analysis.results.safetyEvents!} />}

        <PDFFooter transcript={transcript} />
      </Page>
    </Document>
  );
};

/**
 * Export default for convenience
 */
export default AnalysisPDFDocument;
