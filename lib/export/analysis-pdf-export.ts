/**
 * Analysis PDF Export Wrapper
 *
 * Wraps the existing @react-pdf/renderer component for use in the export system.
 * Handles dynamic import and blob generation.
 */

import React from "react";
import type { Analysis, Transcript, Template } from "@/types";
import type { ExportOptions } from "./analysis-exporter";

/**
 * Generate PDF blob from analysis data
 *
 * Uses dynamic import to avoid bundling @react-pdf/renderer in the main bundle.
 */
export async function generateAnalysisPdf(
  analysis: Analysis,
  transcript: Transcript,
  template: Template,
  options: Required<ExportOptions>
): Promise<Blob> {
  // Dynamic imports for code splitting
  const [{ pdf }, { AnalysisPDFDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/lib/pdf/analysis-pdf"),
  ]);

  // Filter the analysis based on options
  const filteredAnalysis = filterAnalysisForExport(analysis, options);

  // Generate the PDF document element
  const documentElement = React.createElement(AnalysisPDFDocument, {
    analysis: filteredAnalysis,
    transcript,
    template,
    includeMetadata: options.includeMetadata,
    includeTableOfContents: options.includeTOC,
  });

  // Render to blob - cast to ReactElement to satisfy pdf() types
  const blob = await pdf(documentElement as React.ReactElement).toBlob();
  return blob;
}

/**
 * Filter analysis results based on export options
 */
function filterAnalysisForExport(
  analysis: Analysis,
  options: Required<ExportOptions>
): Analysis {
  const filteredResults = { ...analysis.results };

  // Remove summary if not included
  if (!options.includeSummary) {
    delete filteredResults.summary;
  }

  // Remove or filter sections
  if (!options.includeSections) {
    filteredResults.sections = [];
  } else if (!options.includeEvidence) {
    // Keep sections but remove evidence
    filteredResults.sections = filteredResults.sections.map((section) => ({
      ...section,
      evidence: [],
    }));
  }

  if (!options.includeBenchmarks) {
    delete filteredResults.benchmarks;
  }

  if (!options.includeRadioReports) {
    delete filteredResults.radioReports;
  }

  if (!options.includeSafetyEvents) {
    delete filteredResults.safetyEvents;
  }

  return {
    ...analysis,
    results: filteredResults,
  };
}
