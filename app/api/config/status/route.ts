/**
 * Configuration Status API Route
 *
 * This server-side API route provides configuration status information
 * without exposing sensitive credentials to the client.
 *
 * Returns:
 * - Configuration status (configured/not configured)
 * - Provider type (Azure/OpenAI)
 * - Deployment names (non-sensitive)
 * - NEVER returns API keys or full endpoints
 */

import { NextResponse } from 'next/server';
import {
  getConfiguration,
  OpenAIConfigError,
  getWhisperDeployment,
  getGPT4Deployment,
} from '@/lib/openai';

/**
 * Configuration status response type
 */
export interface ConfigStatusResponse {
  configured: boolean;
  provider: 'azure' | 'openai' | 'none';
  whisperDeployment?: string;
  analysisDeployment?: string;
  endpointHost?: string; // Masked endpoint (hostname only, no full URL)
  error?: string;
}

/**
 * GET /api/config/status
 *
 * Returns the current OpenAI configuration status without exposing sensitive data.
 * This endpoint can be safely called from the client to check if the API is configured.
 *
 * @returns {ConfigStatusResponse} Configuration status information
 */
export async function GET(): Promise<NextResponse<ConfigStatusResponse>> {
  try {
    // Attempt to get configuration from environment variables
    const config = getConfiguration();

    // Build safe response object
    const response: ConfigStatusResponse = {
      configured: true,
      provider: config.provider,
    };

    // Add provider-specific information
    if (config.provider === 'azure') {
      // Get deployment names (safe to expose)
      try {
        response.whisperDeployment = getWhisperDeployment();
      } catch (error) {
        // Deployment not configured, but don't fail the request
        console.warn('Whisper deployment not configured:', error);
      }

      try {
        response.analysisDeployment = getGPT4Deployment();
      } catch (error) {
        // Deployment not configured, but don't fail the request
        console.warn('Analysis deployment not configured:', error);
      }

      // Extract and mask the endpoint (hostname only)
      if (config.endpoint) {
        try {
          const url = new URL(config.endpoint);
          response.endpointHost = url.hostname; // e.g., "your-resource.openai.azure.com"
        } catch (error) {
          console.error('Failed to parse endpoint URL:', error);
        }
      }
    } else {
      // For standard OpenAI, we use fixed model names
      response.whisperDeployment = 'whisper-1';
      response.analysisDeployment = 'gpt-5';
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=60', // Cache for 1 minute
      },
    });
  } catch (error) {
    // Configuration is not valid or missing
    if (error instanceof OpenAIConfigError) {
      // Return a safe error message without exposing details
      return NextResponse.json(
        {
          configured: false,
          provider: 'none' as const,
          error: 'OpenAI API not configured. Please set up environment variables.',
        },
        {
          status: 200, // Not a server error, just not configured
          headers: {
            'Cache-Control': 'private, no-cache', // Don't cache error state
          },
        }
      );
    }

    // Unexpected error
    console.error('Unexpected error in config status endpoint:', error);
    return NextResponse.json(
      {
        configured: false,
        provider: 'none' as const,
        error: 'Failed to check configuration status',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'private, no-cache',
        },
      }
    );
  }
}
