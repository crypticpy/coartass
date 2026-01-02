/**
 * Next.js Middleware
 *
 * Handles routing and internationalization for the Meeting Transcriber app.
 * This is a minimal middleware since the app uses client-side locale management
 * via localStorage rather than URL-based routing.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Content Security Policy configuration
 * MUST match next.config.mjs CSP - middleware handles non-API routes
 *
 * Key blob: requirements:
 * - script-src blob: - FFmpeg WASM worker scripts
 * - connect-src blob: - WaveSurfer audio fetch, FFmpeg file loading
 * - connect-src data: - @react-pdf/renderer Yoga WASM module
 * - worker-src blob: - Web Workers for WASM
 * - media-src blob: - Audio recording/playback
 *
 * Note: 'unsafe-eval' only included in dev mode for hot reload
 */
const ContentSecurityPolicy = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:"
    : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  "connect-src 'self' blob: data: https://*.openai.azure.com https://*.cognitiveservices.azure.com https://login.windows.net https://login.microsoftonline.com",
  "worker-src 'self' blob:",
  "child-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "block-all-mixed-content",
  "upgrade-insecure-requests",
].join('; ');

/**
 * Middleware function
 * Adds security headers to all responses
 * Locale handling is done client-side via IntlProvider and localStorage
 */
 
export function middleware(_request: NextRequest) {
  // Get the response
  const response = NextResponse.next();

  // Add security headers
  response.headers.set('Content-Security-Policy', ContentSecurityPolicy);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(), display-capture=(self)');

  return response;
}

/**
 * Configure which routes use this middleware
 * Currently applies to all routes
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
