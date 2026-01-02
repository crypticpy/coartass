/**
 * API Utility Functions
 *
 * Provides common utility functions for API route handlers including
 * standardized response formatting for both successful and error responses.
 */

import { NextResponse } from 'next/server';

/**
 * Creates a standardized error response for API routes
 *
 * @param message - Error message to return to the client
 * @param status - HTTP status code (e.g., 400, 500)
 * @param details - Optional additional error details
 * @returns NextResponse with error body
 *
 * @example
 * return errorResponse('File not found', 404, { fileId: '123' });
 */
export function errorResponse(
  message: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse {
  const errorBody: Record<string, unknown> = {
    success: false,
    error: message,
  };

  if (details) {
    errorBody.details = details;
  }

  return NextResponse.json(errorBody, { status });
}

/**
 * Creates a standardized success response for API routes
 *
 * @param data - Data to return to the client
 * @param status - HTTP status code (defaults to 200)
 * @returns NextResponse with success body
 *
 * @example
 * return successResponse({ transcript: data }, 201);
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}
