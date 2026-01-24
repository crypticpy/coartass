/**
 * PDF Parsing API Route
 *
 * Server-side PDF text extraction using unpdf.
 * unpdf is specifically designed for serverless environments and
 * avoids browser-side pdfjs-dist worker initialization issues.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { estimateTokens } from "@/lib/token-utils";

export const runtime = "nodejs";

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        { status: 400 },
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();

    // Parse PDF using unpdf (designed for serverless environments)
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const result = await extractText(pdf, { mergePages: true });

    const text = (result.text as string).trim();
    const tokenCount = estimateTokens(text);
    const warnings: string[] = [];

    if (!text || text.length < 10) {
      warnings.push(
        "No text extracted from PDF. The document may contain only images or scanned content.",
      );
    }

    if (tokenCount > 50000) {
      warnings.push(
        `PDF is very large (~${tokenCount.toLocaleString()} tokens). Consider using specific pages or a shorter excerpt.`,
      );
    }

    return NextResponse.json({
      text,
      tokenCount,
      numPages: result.totalPages,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    console.error("PDF parsing error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("password")) {
      return NextResponse.json(
        {
          error:
            "PDF is password-protected. Please unlock the PDF and try again.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: `Failed to parse PDF: ${message}` },
      { status: 500 },
    );
  }
}
