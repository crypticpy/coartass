import bundleAnalyzer from '@next/bundle-analyzer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV !== 'production';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Content Security Policy configuration
// This CSP is designed for the Meeting Transcriber app which uses:
// - React/Next.js (requires 'unsafe-inline' for styles due to Mantine UI)
// - FFmpeg WASM workers (requires worker-src blob:)
// - Audio recording and playback (requires media-src blob:)
// - Azure OpenAI API calls (requires connect-src to Azure endpoints)
const ContentSecurityPolicy = [
  // Default: only allow resources from same origin
  "default-src 'self'",
  // Scripts: self + inline (Next.js hydration) + blob (FFmpeg WASM) + wasm-unsafe-eval (WASM compilation)
  // Note: 'wasm-unsafe-eval' is required for WebAssembly.instantiate() in modern browsers
  // Note: 'unsafe-eval' kept for dev mode (hot reload) and legacy WASM support
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:"
    : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
  // Styles: self + inline (required for Mantine UI component styling)
  "style-src 'self' 'unsafe-inline'",
  // Images: self + data URIs (for inline images) + blob (for generated images)
  "img-src 'self' data: blob:",
  // Fonts: self only
  "font-src 'self'",
  // Media: self + blob (for audio recording/playback)
  "media-src 'self' blob:",
  // Connections: self + blob (for WaveSurfer audio fetch) + data (for @react-pdf WASM) + Azure OpenAI endpoints
  "connect-src 'self' blob: data: https://*.openai.azure.com https://*.cognitiveservices.azure.com",
  // Workers: self + blob (for FFmpeg WASM workers)
  "worker-src 'self' blob:",
  // Child/frame sources: none (we don't embed iframes)
  "child-src 'none'",
  // Object sources: none (no plugins)
  "object-src 'none'",
  // Base URI: self only
  "base-uri 'self'",
  // Form actions: self only
  "form-action 'self'",
  // Frame ancestors: none (prevent clickjacking, supplements X-Frame-Options)
  "frame-ancestors 'none'",
  // Block mixed content
  "block-all-mixed-content",
  // Upgrade insecure requests in production
  "upgrade-insecure-requests",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output mode for Docker deployment
  // This creates a minimal .next/standalone folder with all required files
  output: 'standalone',
  // Ensure Next traces files from this repo root (avoids mis-detected monorepo/workspace roots)
  outputFileTracingRoot: __dirname,

  // Prevent FFmpeg WASM packages from being bundled for SSR
  // (Moved from experimental in Next.js 15)
  serverExternalPackages: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core'],

  webpack: (config, { isServer }) => {
    // Handle FFmpeg WASM files
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(), display-capture=(self)',
          },
        ],
      },
      {
        // Cross-Origin Isolation headers for FFmpeg WASM SharedArrayBuffer support
        // These enable multi-threaded WASM execution for better performance
        source: '/ffmpeg-core/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
