/**
 * Health Check Endpoint
 *
 * Used by Docker health checks and load balancers to verify application health
 * Returns 200 OK if the application is running and ready to serve requests
 */

import { successResponse } from '@/lib/api-utils';

export async function GET() {
  // Basic health check - application is running
  // You can add more sophisticated checks here:
  // - Database connectivity
  // - External API availability
  // - Memory usage
  // - Disk space

  return successResponse({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
