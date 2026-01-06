/**
 * RTASS Scorecard PDF Document Component
 *
 * React-PDF component for generating professional RTASS scorecard PDFs.
 * Features:
 * - AFD Brand Colors (Red #C8102E, Navy #1C2541)
 * - Cover page with circular score badge
 * - Section breakdown with status indicators
 * - Detailed criteria tables with evidence
 * - Professional footer with branding
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  RtassScorecard,
  RtassScorecardSection,
  RtassScorecardCriterion,
  RtassRubricTemplate,
} from "@/types/rtass";

// Note: Helvetica is a built-in font in @react-pdf/renderer and doesn't need registration.
// The styles use fontFamily: "Helvetica" which works out of the box.

/**
 * AFD Brand Color palette
 */
const colors = {
  afdRed: "#C8102E",
  navy: "#1C2541",
  white: "#FFFFFF",
  black: "#000000",
  // Status colors
  pass: "#22c55e",
  passLight: "#dcfce7",
  needsImprovement: "#f59e0b",
  needsImprovementLight: "#fef3c7",
  fail: "#ef4444",
  failLight: "#fee2e2",
  // Verdict colors
  met: "#22c55e",
  missed: "#ef4444",
  partial: "#f59e0b",
  notObserved: "#6b7280",
  notApplicable: "#9ca3af",
  // UI colors
  text: "#1a1a1a",
  textMuted: "#666666",
  textLight: "#999999",
  border: "#e5e5e5",
  borderLight: "#f5f5f5",
  background: "#FFFFFF",
  backgroundAlt: "#f9f9f9",
};

/**
 * PDF Stylesheet with AFD branding
 */
const styles = StyleSheet.create({
  // Page layout
  page: {
    flexDirection: "column",
    backgroundColor: colors.background,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },

  // Cover page styles
  coverPage: {
    flexDirection: "column",
    backgroundColor: colors.background,
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  coverHeader: {
    alignItems: "center",
    marginBottom: 30,
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.navy,
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },

  // Score badge (circular display)
  scoreBadgeContainer: {
    alignItems: "center",
    marginVertical: 30,
  },
  scoreBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  scoreBadgePass: {
    borderColor: colors.pass,
  },
  scoreBadgeNeedsImprovement: {
    borderColor: colors.needsImprovement,
  },
  scoreBadgeFail: {
    borderColor: colors.fail,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: colors.navy,
  },
  scorePercent: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: -4,
  },
  statusBadge: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  statusBadgePass: {
    backgroundColor: colors.passLight,
  },
  statusBadgeNeedsImprovement: {
    backgroundColor: colors.needsImprovementLight,
  },
  statusBadgeFail: {
    backgroundColor: colors.failLight,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  statusTextPass: {
    color: colors.pass,
  },
  statusTextNeedsImprovement: {
    color: colors.needsImprovement,
  },
  statusTextFail: {
    color: colors.fail,
  },

  // Metadata section
  metadataSection: {
    backgroundColor: colors.backgroundAlt,
    padding: 15,
    borderRadius: 4,
    marginBottom: 20,
  },
  metadataRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  metadataLabel: {
    width: 120,
    fontWeight: "bold",
    color: colors.text,
    fontSize: 9,
  },
  metadataValue: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 9,
  },

  // Section summary cards
  sectionSummaryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
  },
  sectionCard: {
    width: "48%",
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginBottom: 8,
  },
  sectionCardTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.navy,
    marginBottom: 6,
  },
  sectionCardScore: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  sectionCardScorePass: {
    color: colors.pass,
  },
  sectionCardScoreNeedsImprovement: {
    color: colors.needsImprovement,
  },
  sectionCardScoreFail: {
    color: colors.fail,
  },
  sectionCardWeight: {
    fontSize: 8,
    color: colors.textLight,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },

  // Detail page styles
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.navy,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.navy,
  },
  sectionScoreBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  sectionScoreText: {
    fontSize: 11,
    fontWeight: "bold",
  },

  // Criteria table
  criteriaTable: {
    marginTop: 10,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.navy,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    color: colors.white,
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    backgroundColor: colors.backgroundAlt,
  },
  criterionCol: {
    width: "25%",
    paddingRight: 8,
  },
  verdictCol: {
    width: "12%",
    paddingRight: 8,
  },
  confidenceCol: {
    width: "10%",
    paddingRight: 8,
  },
  evidenceCol: {
    width: "53%",
  },
  criterionTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 2,
  },
  criterionRationale: {
    fontSize: 8,
    color: colors.textMuted,
    lineHeight: 1.3,
  },

  // Verdict badges
  verdictBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  verdictBadgeMet: {
    backgroundColor: colors.passLight,
  },
  verdictBadgeMissed: {
    backgroundColor: colors.failLight,
  },
  verdictBadgePartial: {
    backgroundColor: colors.needsImprovementLight,
  },
  verdictBadgeNotObserved: {
    backgroundColor: "#e5e7eb",
  },
  verdictBadgeNotApplicable: {
    backgroundColor: "#f3f4f6",
  },
  verdictText: {
    fontSize: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  verdictTextMet: {
    color: colors.met,
  },
  verdictTextMissed: {
    color: colors.missed,
  },
  verdictTextPartial: {
    color: colors.partial,
  },
  verdictTextNotObserved: {
    color: colors.notObserved,
  },
  verdictTextNotApplicable: {
    color: colors.notApplicable,
  },

  // Confidence bar
  confidenceContainer: {
    alignItems: "flex-start",
  },
  confidenceValue: {
    fontSize: 8,
    color: colors.text,
    marginBottom: 2,
  },
  confidenceBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
  },
  confidenceFill: {
    height: "100%",
    backgroundColor: colors.navy,
    borderRadius: 2,
  },

  // Evidence display
  evidenceItem: {
    marginBottom: 6,
  },
  evidenceQuote: {
    fontSize: 8,
    color: colors.textMuted,
    fontStyle: "italic",
    fontFamily: "Courier",
    backgroundColor: colors.backgroundAlt,
    padding: 4,
    borderRadius: 2,
    marginBottom: 2,
  },
  evidenceTimestamp: {
    fontSize: 7,
    color: colors.textLight,
  },
  noEvidence: {
    fontSize: 8,
    color: colors.textLight,
    fontStyle: "italic",
  },

  // Warnings section
  warningsSection: {
    marginTop: 20,
    padding: 12,
    backgroundColor: colors.needsImprovementLight,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: colors.needsImprovement,
  },
  warningsTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.needsImprovement,
    marginBottom: 8,
  },
  warningItem: {
    fontSize: 9,
    color: colors.text,
    marginBottom: 4,
    paddingLeft: 8,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    fontSize: 8,
    color: colors.textLight,
  },
  footerBrand: {
    color: colors.afdRed,
    fontWeight: "bold",
  },
  footerPage: {
    color: colors.textMuted,
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
 * Helper function to format percentage
 */
function formatPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
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
  }).format(new Date(date));
}

/**
 * Get status-specific styles
 */
function getStatusStyles(status: "pass" | "needs_improvement" | "fail") {
  switch (status) {
    case "pass":
      return {
        badge: styles.scoreBadgePass,
        statusBadge: styles.statusBadgePass,
        statusText: styles.statusTextPass,
        cardScore: styles.sectionCardScorePass,
        color: colors.pass,
      };
    case "needs_improvement":
      return {
        badge: styles.scoreBadgeNeedsImprovement,
        statusBadge: styles.statusBadgeNeedsImprovement,
        statusText: styles.statusTextNeedsImprovement,
        cardScore: styles.sectionCardScoreNeedsImprovement,
        color: colors.needsImprovement,
      };
    case "fail":
      return {
        badge: styles.scoreBadgeFail,
        statusBadge: styles.statusBadgeFail,
        statusText: styles.statusTextFail,
        cardScore: styles.sectionCardScoreFail,
        color: colors.fail,
      };
  }
}

/**
 * Get verdict-specific styles
 */
function getVerdictStyles(verdict: string) {
  switch (verdict) {
    case "met":
      return {
        badge: styles.verdictBadgeMet,
        text: styles.verdictTextMet,
      };
    case "missed":
      return {
        badge: styles.verdictBadgeMissed,
        text: styles.verdictTextMissed,
      };
    case "partial":
      return {
        badge: styles.verdictBadgePartial,
        text: styles.verdictTextPartial,
      };
    case "not_observed":
      return {
        badge: styles.verdictBadgeNotObserved,
        text: styles.verdictTextNotObserved,
      };
    case "not_applicable":
    default:
      return {
        badge: styles.verdictBadgeNotApplicable,
        text: styles.verdictTextNotApplicable,
      };
  }
}

/**
 * Props for ScorecardPDFDocument
 */
export interface ScorecardPDFDocumentProps {
  scorecard: RtassScorecard;
  rubric?: RtassRubricTemplate;
  transcriptFilename?: string;
  incidentInfo?: {
    incidentNumber?: string;
    incidentDate?: Date;
    location?: string;
  };
}

/**
 * Footer Component
 */
const PDFFooter: React.FC = () => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerBrand}>Austin RTASS</Text>
    <Text>Radio Traffic Analysis Scoring System</Text>
    <Text
      style={styles.footerPage}
      render={({ pageNumber, totalPages }) =>
        `Page ${pageNumber} of ${totalPages}`
      }
    />
  </View>
);

/**
 * Cover Page Component
 */
const CoverPage: React.FC<{
  scorecard: RtassScorecard;
  rubric?: RtassRubricTemplate;
  transcriptFilename?: string;
  incidentInfo?: ScorecardPDFDocumentProps["incidentInfo"];
}> = ({ scorecard, rubric, transcriptFilename, incidentInfo }) => {
  const statusStyles = getStatusStyles(scorecard.overall.status);
  const statusLabel = scorecard.overall.status.replace("_", " ");

  return (
    <Page size="A4" style={styles.coverPage}>
      {/* Header */}
      <View style={styles.coverHeader}>
        <Text style={styles.coverTitle}>RTASS Scorecard</Text>
        <Text style={styles.coverSubtitle}>
          Radio Traffic Analysis Scoring System
        </Text>
      </View>

      {/* Score Badge */}
      <View style={styles.scoreBadgeContainer}>
        <View style={[styles.scoreBadge, statusStyles.badge]}>
          <Text style={styles.scoreValue}>
            {Math.round(scorecard.overall.score * 100)}
          </Text>
          <Text style={styles.scorePercent}>%</Text>
        </View>
        <View style={[styles.statusBadge, statusStyles.statusBadge]}>
          <Text style={[styles.statusText, statusStyles.statusText]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Metadata */}
      <View style={styles.metadataSection}>
        {transcriptFilename && (
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Transcript:</Text>
            <Text style={styles.metadataValue}>{transcriptFilename}</Text>
          </View>
        )}
        {incidentInfo?.incidentNumber && (
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Incident Number:</Text>
            <Text style={styles.metadataValue}>
              {incidentInfo.incidentNumber}
            </Text>
          </View>
        )}
        {incidentInfo?.incidentDate && (
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Incident Date:</Text>
            <Text style={styles.metadataValue}>
              {formatDate(incidentInfo.incidentDate)}
            </Text>
          </View>
        )}
        {incidentInfo?.location && (
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Location:</Text>
            <Text style={styles.metadataValue}>{incidentInfo.location}</Text>
          </View>
        )}
        {rubric && (
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Rubric:</Text>
            <Text style={styles.metadataValue}>
              {rubric.name} v{rubric.version}
            </Text>
          </View>
        )}
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Generated:</Text>
          <Text style={styles.metadataValue}>
            {formatDate(scorecard.createdAt)}
          </Text>
        </View>
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Model:</Text>
          <Text style={styles.metadataValue}>
            {scorecard.modelInfo.model}
            {scorecard.modelInfo.deployment
              ? ` (${scorecard.modelInfo.deployment})`
              : ""}
          </Text>
        </View>
      </View>

      {/* Section Summary Cards */}
      <View style={styles.sectionSummaryContainer}>
        {scorecard.sections.map((section) => {
          const sectionStatusStyles = getStatusStyles(section.status);
          return (
            <View key={section.sectionId} style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle}>{section.title}</Text>
              <Text
                style={[styles.sectionCardScore, sectionStatusStyles.cardScore]}
              >
                {formatPercent(section.score)}
              </Text>
              <Text style={styles.sectionCardWeight}>
                Weight: {Math.round(section.weight * 100)}%
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${section.score * 100}%`,
                      backgroundColor: sectionStatusStyles.color,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Warnings */}
      {scorecard.warnings && scorecard.warnings.length > 0 && (
        <View style={styles.warningsSection}>
          <Text style={styles.warningsTitle}>Warnings</Text>
          {scorecard.warnings.slice(0, 5).map((warning, idx) => (
            <Text key={idx} style={styles.warningItem}>
              • {warning}
            </Text>
          ))}
          {scorecard.warnings.length > 5 && (
            <Text style={styles.warningItem}>
              + {scorecard.warnings.length - 5} more...
            </Text>
          )}
        </View>
      )}

      <PDFFooter />
    </Page>
  );
};

/**
 * Criteria Row Component
 */
const CriteriaRow: React.FC<{
  criterion: RtassScorecardCriterion;
  isAlt: boolean;
}> = ({ criterion, isAlt }) => {
  const verdictStyles = getVerdictStyles(criterion.verdict);

  return (
    <View
      style={[styles.tableRow, isAlt ? styles.tableRowAlt : {}]}
      wrap={false}
    >
      {/* Criterion */}
      <View style={styles.criterionCol}>
        <Text style={styles.criterionTitle}>{criterion.title}</Text>
        <Text style={styles.criterionRationale}>{criterion.rationale}</Text>
      </View>

      {/* Verdict */}
      <View style={styles.verdictCol}>
        <View style={[styles.verdictBadge, verdictStyles.badge]}>
          <Text style={[styles.verdictText, verdictStyles.text]}>
            {criterion.verdict.replace("_", " ")}
          </Text>
        </View>
      </View>

      {/* Confidence */}
      <View style={[styles.confidenceCol, styles.confidenceContainer]}>
        <Text style={styles.confidenceValue}>
          {Math.round(criterion.confidence * 100)}%
        </Text>
        <View style={styles.confidenceBar}>
          <View
            style={[
              styles.confidenceFill,
              { width: `${criterion.confidence * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Evidence */}
      <View style={styles.evidenceCol}>
        {criterion.evidence.length > 0 ? (
          criterion.evidence.slice(0, 2).map((e, idx) => (
            <View key={idx} style={styles.evidenceItem}>
              <Text style={styles.evidenceQuote}>
                &quot;{e.quote.length > 80 ? e.quote.slice(0, 80) + "..." : e.quote}&quot;
              </Text>
              <Text style={styles.evidenceTimestamp}>
                @ {formatTimestamp(e.start)}
                {e.speaker ? ` • ${e.speaker}` : ""}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noEvidence}>No evidence provided</Text>
        )}
        {criterion.evidence.length > 2 && (
          <Text style={styles.evidenceTimestamp}>
            + {criterion.evidence.length - 2} more...
          </Text>
        )}
      </View>
    </View>
  );
};

/**
 * Section Detail Page Component
 */
const SectionDetailPage: React.FC<{
  section: RtassScorecardSection;
}> = ({ section }) => {
  const statusStyles = getStatusStyles(section.status);

  return (
    <Page size="A4" style={styles.page} wrap>
      {/* Section Header */}
      <View style={styles.sectionHeader} wrap={false}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={[styles.sectionScoreBadge, statusStyles.statusBadge]}>
          <Text style={[styles.sectionScoreText, statusStyles.statusText]}>
            {formatPercent(section.score)}
          </Text>
        </View>
      </View>

      {/* Criteria Table */}
      <View style={styles.criteriaTable}>
        {/* Table Header */}
        <View style={styles.tableHeader} wrap={false}>
          <Text style={[styles.tableHeaderCell, styles.criterionCol]}>
            Criterion
          </Text>
          <Text style={[styles.tableHeaderCell, styles.verdictCol]}>
            Verdict
          </Text>
          <Text style={[styles.tableHeaderCell, styles.confidenceCol]}>
            Conf.
          </Text>
          <Text style={[styles.tableHeaderCell, styles.evidenceCol]}>
            Evidence
          </Text>
        </View>

        {/* Criteria Rows */}
        {section.criteria.map((criterion, idx) => (
          <CriteriaRow
            key={criterion.criterionId}
            criterion={criterion}
            isAlt={idx % 2 === 1}
          />
        ))}
      </View>

      <PDFFooter />
    </Page>
  );
};

/**
 * ScorecardPDFDocument Component
 *
 * Main PDF document component for RTASS scorecards.
 * Generates a multi-page PDF with:
 * - Cover page with overall score and section summary
 * - Detail pages for each section with criteria breakdown
 */
export const ScorecardPDFDocument: React.FC<ScorecardPDFDocumentProps> = ({
  scorecard,
  rubric,
  transcriptFilename,
  incidentInfo,
}) => {
  return (
    <Document
      title={`RTASS Scorecard - ${transcriptFilename || scorecard.id}`}
      author="Austin RTASS"
      subject="Radio Traffic Analysis Scorecard"
      keywords="rtass, scorecard, radio, traffic, analysis"
      creator="Austin RTASS"
    >
      {/* Cover Page */}
      <CoverPage
        scorecard={scorecard}
        rubric={rubric}
        transcriptFilename={transcriptFilename}
        incidentInfo={incidentInfo}
      />

      {/* Section Detail Pages */}
      {scorecard.sections.map((section) => (
        <SectionDetailPage key={section.sectionId} section={section} />
      ))}
    </Document>
  );
};

export default ScorecardPDFDocument;
