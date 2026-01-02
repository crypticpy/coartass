/**
 * Analysis PDF Generation API Route
 *
 * Server-side endpoint for generating PDF reports from analysis results.
 * Provides an alternative to client-side PDF generation for cases where
 * client-side performance is insufficient or browser compatibility is limited.
 */

import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { AnalysisPDFDocument } from "@/lib/pdf/analysis-pdf";
import type { Analysis, Transcript, Template } from "@/types";

/**
 * Request body interface for PDF generation
 */
interface PDFGenerationRequest {
  /** The analysis results to convert to PDF */
  analysis: Analysis;
  /** The source transcript for context */
  transcript: Transcript;
  /** Optional template information */
  template?: Template;
  /** Whether to include table of contents */
  includeTableOfContents?: boolean;
}

/**
 * Validates the analysis data from the request
 */
function validateAnalysis(analysis: unknown): analysis is Analysis {
  if (!analysis || typeof analysis !== "object") {
    return false;
  }

  const a = analysis as Partial<Analysis>;

  // Check required fields
  if (!a.id || typeof a.id !== "string") {
    return false;
  }

  if (!a.transcriptId || typeof a.transcriptId !== "string") {
    return false;
  }

  if (!a.templateId || typeof a.templateId !== "string") {
    return false;
  }

  if (!a.results || typeof a.results !== "object") {
    return false;
  }

  if (!Array.isArray(a.results.sections)) {
    return false;
  }

  if (!a.createdAt) {
    return false;
  }

  return true;
}

/**
 * Validates the transcript data from the request
 */
function validateTranscript(transcript: unknown): transcript is Transcript {
  if (!transcript || typeof transcript !== "object") {
    return false;
  }

  const t = transcript as Partial<Transcript>;

  // Check required fields
  if (!t.id || typeof t.id !== "string") {
    return false;
  }

  if (!t.filename || typeof t.filename !== "string") {
    return false;
  }

  if (!t.text || typeof t.text !== "string") {
    return false;
  }

  if (!Array.isArray(t.segments)) {
    return false;
  }

  if (!t.metadata || typeof t.metadata !== "object") {
    return false;
  }

  if (!t.createdAt) {
    return false;
  }

  return true;
}

/**
 * POST /api/pdf/analysis
 *
 * Generates a PDF report from analysis results on the server side.
 *
 * @example
 * ```ts
 * const response = await fetch('/api/pdf/analysis', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     analysis: myAnalysis,
 *     transcript: myTranscript,
 *     template: myTemplate,
 *     includeTableOfContents: true,
 *   }),
 * });
 *
 * if (response.ok) {
 *   const blob = await response.blob();
 *   // Use blob for download
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const {
      analysis,
      transcript,
      template,
      includeTableOfContents = true,
    } = body as PDFGenerationRequest;

    // Validate analysis
    if (!validateAnalysis(analysis)) {
      return NextResponse.json(
        {
          error: "Invalid analysis data",
          message: "The provided analysis data is missing required fields or is malformed",
        },
        { status: 400 }
      );
    }

    // Validate transcript
    if (!validateTranscript(transcript)) {
      return NextResponse.json(
        {
          error: "Invalid transcript data",
          message: "The provided transcript data is missing required fields or is malformed",
        },
        { status: 400 }
      );
    }

    // Convert date strings to Date objects if needed
    const analysisData: Analysis = {
      ...analysis,
      createdAt: typeof analysis.createdAt === "string"
        ? new Date(analysis.createdAt)
        : analysis.createdAt,
    };

    const transcriptData: Transcript = {
      ...transcript,
      createdAt: typeof transcript.createdAt === "string"
        ? new Date(transcript.createdAt)
        : transcript.createdAt,
    };

    const templateData: Template | undefined = template
      ? {
          ...template,
          createdAt: typeof template.createdAt === "string"
            ? new Date(template.createdAt)
            : template.createdAt,
        }
      : undefined;

    // Generate PDF document
    const pdfBuffer = await renderToBuffer(
      React.createElement(AnalysisPDFDocument, {
        analysis: analysisData,
        transcript: transcriptData,
        template: templateData,
        includeTableOfContents,
      }) as React.ReactElement
    );

    // Return PDF as response
    return new NextResponse(pdfBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${transcriptData.filename.replace(/\.[^/.]+$/, "")}-analysis.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);

    // Handle specific error types
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "Invalid JSON",
          message: "The request body contains invalid JSON",
        },
        { status: 400 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        error: "PDF generation failed",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pdf/analysis
 *
 * Returns API information and usage instructions.
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/pdf/analysis",
    method: "POST",
    description: "Generates a PDF report from analysis results",
    requestBody: {
      analysis: "Analysis object (required)",
      transcript: "Transcript object (required)",
      template: "Template object (optional)",
      includeTableOfContents: "boolean (optional, default: true)",
    },
    responseType: "application/pdf",
    example: {
      url: "/api/pdf/analysis",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        analysis: {
          id: "analysis123",
          transcriptId: "transcript123",
          templateId: "template123",
          results: {
            summary: "Meeting summary...",
            sections: [
              {
                name: "Key Points",
                content: "Discussion points...",
                evidence: [
                  {
                    text: "Quote from transcript",
                    start: 10,
                    end: 15,
                    relevance: 0.9,
                  },
                ],
              },
            ],
            actionItems: [
              {
                id: "action-1",
                task: "Complete project proposal",
                owner: "John Doe",
                deadline: "Next week",
                timestamp: 120,
              },
            ],
          },
          createdAt: "2024-11-17T12:00:00Z",
        },
        transcript: {
          id: "transcript123",
          filename: "meeting.mp3",
          text: "Full transcript...",
          segments: [],
          metadata: {
            model: "whisper-1",
            duration: 300,
            fileSize: 1024000,
          },
          createdAt: "2024-11-17T12:00:00Z",
        },
        includeTableOfContents: true,
      },
    },
  });
}
