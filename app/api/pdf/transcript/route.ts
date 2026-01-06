/**
 * Transcript PDF Generation API Route
 *
 * Server-side endpoint for generating PDF documents from transcripts.
 * Provides an alternative to client-side PDF generation for cases where
 * client-side performance is insufficient or browser compatibility is limited.
 */

import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { TranscriptPDFDocument } from "@/lib/pdf/transcript-pdf";
import { errorResponse, successResponse } from "@/lib/api-utils";
import type { Transcript } from "@/types";

/**
 * Request body interface for PDF generation
 */
interface PDFGenerationRequest {
  /** The transcript data to convert to PDF */
  transcript: Transcript;
  /** Whether to include the full continuous transcript text */
  includeFullText?: boolean;
  /** Whether to show individual segments with timestamps */
  includeSegments?: boolean;
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
 * POST /api/pdf/transcript
 *
 * Generates a PDF document from a transcript on the server side.
 *
 * @example
 * ```ts
 * const response = await fetch('/api/pdf/transcript', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     transcript: myTranscript,
 *     includeFullText: true,
 *     includeSegments: true,
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
    const { transcript, includeFullText = true, includeSegments = true } = body as PDFGenerationRequest;

    // Validate transcript
    if (!validateTranscript(transcript)) {
      return errorResponse("Invalid transcript data", 400, {
        type: "invalid_transcript",
        message: "The provided transcript data is missing required fields or is malformed",
      });
    }

    // Convert createdAt string to Date if needed
    const transcriptData: Transcript = {
      ...transcript,
      createdAt: typeof transcript.createdAt === "string"
        ? new Date(transcript.createdAt)
        : transcript.createdAt,
    };

    // Generate PDF document
    const pdfBuffer = await renderToBuffer(
      React.createElement(TranscriptPDFDocument, {
        transcript: transcriptData,
        includeFullText,
        includeSegments,
      }) as React.ReactElement
    );

    // Return PDF as response
    return new NextResponse(pdfBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${transcriptData.filename.replace(/\.[^/.]+$/, "")}-transcript.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);

    // Handle specific error types
    if (error instanceof SyntaxError) {
      return errorResponse("Invalid JSON", 400, {
        type: "invalid_json",
        message: "The request body contains invalid JSON",
      });
    }

    // Generic error response
    return errorResponse("PDF generation failed", 500, {
      type: "pdf_generation_failed",
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    });
  }
}

/**
 * GET /api/pdf/transcript
 *
 * Returns API information and usage instructions.
 */
export async function GET() {
  return successResponse({
    endpoint: "/api/pdf/transcript",
    method: "POST",
    description: "Generates a PDF document from transcript data",
    requestBody: {
      transcript: "Transcript object (required)",
      includeFullText: "boolean (optional, default: true)",
      includeSegments: "boolean (optional, default: true)",
    },
    responseType: "application/pdf",
    example: {
      url: "/api/pdf/transcript",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        transcript: {
          id: "abc123",
          filename: "meeting.mp3",
          text: "Full transcript text...",
          segments: [
            { index: 0, start: 0, end: 5, text: "Hello world" },
          ],
          metadata: {
            model: "whisper-1",
            duration: 300,
            fileSize: 1024000,
          },
          createdAt: "2024-11-17T12:00:00Z",
        },
        includeFullText: true,
        includeSegments: true,
      },
    },
  });
}
