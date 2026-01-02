/**
 * RTASS Scorecard PDF Generation API Route
 *
 * Server-side endpoint for generating PDF reports from RTASS scorecards.
 */

import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { ScorecardPDFDocument } from "@/lib/pdf/scorecard-pdf";
import type { RtassScorecard, RtassRubricTemplate } from "@/types/rtass";

/**
 * Request body interface for PDF generation
 */
interface PDFGenerationRequest {
  /** The scorecard to convert to PDF */
  scorecard: RtassScorecard;
  /** Optional rubric template information */
  rubric?: RtassRubricTemplate;
  /** Original transcript filename for context */
  transcriptFilename?: string;
  /** Optional incident information */
  incidentInfo?: {
    incidentNumber?: string;
    incidentDate?: Date;
    location?: string;
  };
}

/**
 * Validates the scorecard data from the request
 */
function validateScorecard(scorecard: unknown): scorecard is RtassScorecard {
  if (!scorecard || typeof scorecard !== "object") {
    return false;
  }

  const s = scorecard as Partial<RtassScorecard>;

  // Check required fields
  if (!s.id || typeof s.id !== "string") {
    return false;
  }

  if (!s.transcriptId || typeof s.transcriptId !== "string") {
    return false;
  }

  if (!s.rubricTemplateId || typeof s.rubricTemplateId !== "string") {
    return false;
  }

  if (!s.overall || typeof s.overall !== "object") {
    return false;
  }

  if (typeof s.overall.score !== "number") {
    return false;
  }

  if (!["pass", "needs_improvement", "fail"].includes(s.overall.status)) {
    return false;
  }

  if (!Array.isArray(s.sections)) {
    return false;
  }

  if (!s.createdAt) {
    return false;
  }

  if (!s.modelInfo || typeof s.modelInfo !== "object") {
    return false;
  }

  return true;
}

/**
 * POST /api/pdf/scorecard
 *
 * Generates a PDF report from RTASS scorecard results on the server side.
 *
 * @example
 * ```ts
 * const response = await fetch('/api/pdf/scorecard', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     scorecard: myScorecard,
 *     rubric: myRubric,
 *     transcriptFilename: 'incident-2024-001.mp3',
 *     incidentInfo: {
 *       incidentNumber: '2024-00123',
 *       incidentDate: new Date(),
 *       location: '123 Main Street',
 *     },
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
    const { scorecard, rubric, transcriptFilename, incidentInfo } =
      body as PDFGenerationRequest;

    // Validate scorecard
    if (!validateScorecard(scorecard)) {
      return NextResponse.json(
        {
          error: "Invalid scorecard data",
          message:
            "The provided scorecard data is missing required fields or is malformed",
        },
        { status: 400 }
      );
    }

    // Convert date strings to Date objects if needed
    const scorecardData: RtassScorecard = {
      ...scorecard,
      createdAt:
        typeof scorecard.createdAt === "string"
          ? new Date(scorecard.createdAt)
          : scorecard.createdAt,
    };

    const rubricData: RtassRubricTemplate | undefined = rubric
      ? {
          ...rubric,
          createdAt:
            typeof rubric.createdAt === "string"
              ? new Date(rubric.createdAt)
              : rubric.createdAt,
          updatedAt:
            rubric.updatedAt && typeof rubric.updatedAt === "string"
              ? new Date(rubric.updatedAt)
              : rubric.updatedAt,
        }
      : undefined;

    const incidentData = incidentInfo
      ? {
          ...incidentInfo,
          incidentDate:
            incidentInfo.incidentDate &&
            typeof incidentInfo.incidentDate === "string"
              ? new Date(incidentInfo.incidentDate)
              : incidentInfo.incidentDate,
        }
      : undefined;

    // Generate PDF document
    const pdfBuffer = await renderToBuffer(
      React.createElement(ScorecardPDFDocument, {
        scorecard: scorecardData,
        rubric: rubricData,
        transcriptFilename,
        incidentInfo: incidentData,
      }) as React.ReactElement
    );

    // Generate filename
    const filename = transcriptFilename
      ? `${transcriptFilename.replace(/\.[^/.]+$/, "")}-scorecard.pdf`
      : `rtass-scorecard-${scorecardData.id.slice(0, 8)}.pdf`;

    // Return PDF as response
    return new NextResponse(pdfBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Scorecard PDF generation error:", error);

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
        message:
          error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pdf/scorecard
 *
 * Returns API information and usage instructions.
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/pdf/scorecard",
    method: "POST",
    description: "Generates a PDF report from RTASS scorecard results",
    requestBody: {
      scorecard: "RtassScorecard object (required)",
      rubric: "RtassRubricTemplate object (optional)",
      transcriptFilename: "string (optional)",
      incidentInfo: {
        incidentNumber: "string (optional)",
        incidentDate: "Date (optional)",
        location: "string (optional)",
      },
    },
    responseType: "application/pdf",
    example: {
      url: "/api/pdf/scorecard",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        scorecard: {
          id: "scorecard-123",
          incidentId: "incident-001",
          transcriptId: "transcript-123",
          rubricTemplateId: "afd-a1016-v1",
          createdAt: "2024-01-15T12:00:00Z",
          modelInfo: {
            provider: "azure-openai",
            model: "gpt-5",
            deployment: "gpt-5",
          },
          overall: {
            score: 0.85,
            status: "pass",
          },
          sections: [
            {
              sectionId: "initial-arrival",
              title: "Initial Arrival",
              weight: 0.25,
              score: 0.9,
              status: "pass",
              criteria: [],
            },
          ],
        },
        transcriptFilename: "incident-2024-001.mp3",
        incidentInfo: {
          incidentNumber: "2024-00123",
          location: "123 Main Street",
        },
      },
    },
  });
}
