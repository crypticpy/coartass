/**
 * Transcript PDF Document Component
 *
 * React-PDF component for generating professional transcript PDFs.
 * Includes metadata, timestamped segments, proper pagination, and branding.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { Transcript } from "@/types";

// Note: Helvetica is a built-in font in @react-pdf/renderer and doesn't need registration.
// The styles use fontFamily: "Helvetica" which works out of the box.

/**
 * PDF Stylesheet with professional business report styling
 */
const styles = StyleSheet.create({
  // Page layout
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 50,
    fontSize: 11,
    fontFamily: "Helvetica",
  },

  // Header section
  header: {
    marginBottom: 30,
    borderBottom: "2 solid #1a1a1a",
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#1a1a1a",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#666666",
    marginBottom: 4,
  },

  // Metadata section
  metadata: {
    marginBottom: 25,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  metadataRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  metadataLabel: {
    width: 100,
    fontWeight: "bold",
    color: "#333333",
  },
  metadataValue: {
    flex: 1,
    color: "#555555",
  },

  // Content section
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 12,
    marginTop: 8,
    color: "#1a1a1a",
  },

  // Segment styles
  segment: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "0.5 solid #e5e5e5",
  },
  segmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 9,
    color: "#666666",
    backgroundColor: "#f0f0f0",
    padding: "3 6",
    borderRadius: 3,
    marginRight: 8,
  },
  speaker: {
    fontSize: 9,
    color: "#0066cc",
    fontWeight: "bold",
  },
  segmentText: {
    fontSize: 11,
    color: "#333333",
    lineHeight: 1.6,
  },

  // Footer section
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1 solid #e5e5e5",
    paddingTop: 8,
    fontSize: 8,
    color: "#999999",
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    textAlign: "right",
  },

  // Branding
  branding: {
    fontSize: 7,
    color: "#999999",
    marginTop: 2,
  },

  // Full transcript section (for continuous text)
  fullTranscript: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "#fafafa",
    borderRadius: 4,
    lineHeight: 1.8,
  },
  fullTranscriptText: {
    fontSize: 10,
    color: "#444444",
  },
});

/**
 * Helper function to format duration in HH:MM:SS
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Helper function to format timestamp from seconds to MM:SS or HH:MM:SS
 */
function formatTimestamp(seconds: number): string {
  return formatDuration(seconds);
}

/**
 * Helper function to format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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
 * Props for TranscriptPDFDocument
 */
export interface TranscriptPDFDocumentProps {
  /** The transcript data to render */
  transcript: Transcript;
  /** Whether to include the full continuous transcript text */
  includeFullText?: boolean;
  /** Whether to show individual segments with timestamps */
  includeSegments?: boolean;
}

/**
 * Header Component
 */
const PDFHeader: React.FC<{ transcript: Transcript }> = ({ transcript }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>Transcript</Text>
    <Text style={styles.headerSubtitle}>{transcript.filename}</Text>
    <Text style={styles.headerSubtitle}>
      Generated on {formatDate(new Date())}
    </Text>
  </View>
);

/**
 * Metadata Component
 */
const PDFMetadata: React.FC<{ transcript: Transcript }> = ({ transcript }) => (
  <View style={styles.metadata}>
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>File:</Text>
      <Text style={styles.metadataValue}>{transcript.filename}</Text>
    </View>
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>Created:</Text>
      <Text style={styles.metadataValue}>
        {formatDate(transcript.createdAt)}
      </Text>
    </View>
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>Duration:</Text>
      <Text style={styles.metadataValue}>
        {formatDuration(transcript.metadata.duration)}
      </Text>
    </View>
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>File Size:</Text>
      <Text style={styles.metadataValue}>
        {formatFileSize(transcript.metadata.fileSize)}
      </Text>
    </View>
    {transcript.metadata.language && (
      <View style={styles.metadataRow}>
        <Text style={styles.metadataLabel}>Language:</Text>
        <Text style={styles.metadataValue}>
          {transcript.metadata.language.toUpperCase()}
        </Text>
      </View>
    )}
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>Model:</Text>
      <Text style={styles.metadataValue}>{transcript.metadata.model}</Text>
    </View>
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>Segments:</Text>
      <Text style={styles.metadataValue}>{transcript.segments.length}</Text>
    </View>
  </View>
);

/**
 * Segment Component
 */
const PDFSegment: React.FC<{
  segment: Transcript["segments"][0];
}> = ({ segment }) => (
  <View style={styles.segment} wrap={false}>
    <View style={styles.segmentHeader}>
      <Text style={styles.timestamp}>
        {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
      </Text>
      {segment.speaker && (
        <Text style={styles.speaker}>{segment.speaker}</Text>
      )}
    </View>
    <Text style={styles.segmentText}>{segment.text}</Text>
  </View>
);

/**
 * Footer Component with page numbers and branding
 */
const PDFFooter: React.FC<{ transcript: Transcript }> = ({ transcript }) => (
  <View style={styles.footer} fixed>
    <View style={styles.footerLeft}>
      <Text>{transcript.filename}</Text>
      <Text style={styles.branding}>
        Generated with Austin RTASS
      </Text>
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
 * TranscriptPDFDocument Component
 *
 * Main PDF document component that renders a complete transcript
 * with professional formatting suitable for business use.
 *
 * @example
 * ```tsx
 * import { pdf } from '@react-pdf/renderer';
 * import { TranscriptPDFDocument } from './transcript-pdf';
 *
 * const blob = await pdf(
 *   <TranscriptPDFDocument transcript={transcript} />
 * ).toBlob();
 * ```
 */
export const TranscriptPDFDocument: React.FC<TranscriptPDFDocumentProps> = ({
  transcript,
  includeFullText = true,
  includeSegments = true,
}) => {
  // Group segments by page (approximately 10-15 segments per page depending on text length)
  // This is handled automatically by react-pdf's layout engine, but we can optimize rendering

  return (
    <Document
      title={`Transcript - ${transcript.filename}`}
      author="Austin RTASS"
      subject="Audio Transcript"
      keywords="transcript, radio, fire, ems, police"
      creator="Austin RTASS"
    >
      <Page size="A4" style={styles.page}>
        <PDFHeader transcript={transcript} />
        <PDFMetadata transcript={transcript} />

        <View style={styles.content}>
          {/* Full Transcript Text Section */}
          {includeFullText && transcript.text && (
            <>
              <Text style={styles.sectionTitle}>Full Transcript</Text>
              <View style={styles.fullTranscript}>
                <Text style={styles.fullTranscriptText}>{transcript.text}</Text>
              </View>
            </>
          )}

          {/* Timestamped Segments Section */}
          {includeSegments && transcript.segments.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Timestamped Segments ({transcript.segments.length})
              </Text>
              {transcript.segments.map((segment) => (
                <PDFSegment key={segment.index} segment={segment} />
              ))}
            </>
          )}
        </View>

        <PDFFooter transcript={transcript} />
      </Page>
    </Document>
  );
};

/**
 * Export default for convenience
 */
export default TranscriptPDFDocument;
