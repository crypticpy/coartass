/**
 * Simple in-memory rate limiter for Next.js route handlers.
 *
 * Notes:
 * - This is per-instance (not shared across replicas). For multi-replica deployments
 *   (e.g., Azure Container Apps), consider using Redis or Azure API Management.
 * - Intended as a lightweight guardrail against accidental abuse and tight retry loops.
 * - Includes periodic cleanup to prevent memory leaks under sustained load.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface RateLimitConfig {
  /** Namespace for the limit (e.g. "transcribe") */
  key: string;
  /** Window size in milliseconds */
  windowMs: number;
  /** Maximum requests allowed within the window */
  max: number;
}

interface RateLimitState {
  count: number;
  resetAt: number;
  lastSeenAt: number;
}

const store = new Map<string, RateLimitState>();
const MAX_KEYS = 5000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_ENTRY_AGE_MS = 60 * 60 * 1000; // 1 hour

let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

function nowMs(): number {
  return Date.now();
}

function getClientIp(request: NextRequest): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const azureIp = request.headers.get('x-azure-clientip')?.trim();
  if (azureIp) return azureIp;

  return null;
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function getClientKey(request: NextRequest): string {
  const ip = getClientIp(request) ?? 'unknown';
  const userAgent = (request.headers.get('user-agent') ?? '').slice(0, 200);
  return fnv1a32(`${ip}|${userAgent}`);
}

/**
 * Remove stale entries from the store. Called both on-demand (when at capacity)
 * and periodically via setInterval to prevent memory accumulation.
 */
function cleanupStore(): void {
  const now = nowMs();
  const cutoff = now - STALE_ENTRY_AGE_MS;

  // Always remove expired entries (window has passed)
  for (const [key, value] of store) {
    if (value.resetAt <= now || value.lastSeenAt < cutoff) {
      store.delete(key);
    }
  }

  // If still over capacity after removing expired, evict oldest entries (LRU)
  if (store.size > MAX_KEYS) {
    const entries = Array.from(store.entries())
      .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt);

    const toRemove = entries.slice(0, store.size - MAX_KEYS + 100); // Remove extra 100 for headroom
    for (const [key] of toRemove) {
      store.delete(key);
    }
  }
}

/**
 * Start periodic cleanup if not already running.
 * Safe to call multiple times; only one interval will be created.
 */
function ensureCleanupInterval(): void {
  if (cleanupIntervalId !== null) return;

  cleanupIntervalId = setInterval(() => {
    cleanupStore();
  }, CLEANUP_INTERVAL_MS);

  // Prevent the interval from keeping the process alive during shutdown
  if (typeof cleanupIntervalId === 'object' && 'unref' in cleanupIntervalId) {
    cleanupIntervalId.unref();
  }
}

/** For testing: stop the cleanup interval and clear the store */
export function _resetRateLimiter(): void {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
  store.clear();
}

/** For testing: get current store size */
export function _getStoreSize(): number {
  return store.size;
}

function buildStoreKey(configKey: string, clientKey: string): string {
  return `${configKey}:${clientKey}`;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
}

export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  options?: { clientKey?: string }
): RateLimitDecision {
  // Start periodic cleanup on first use
  ensureCleanupInterval();
  cleanupStore();

  const clientKey = options?.clientKey ?? getClientKey(request);
  const key = buildStoreKey(config.key, clientKey);

  const now = nowMs();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt, lastSeenAt: now });
    return {
      allowed: true,
      limit: config.max,
      remaining: Math.max(config.max - 1, 0),
      resetAt,
    };
  }

  existing.lastSeenAt = now;

  if (existing.count >= config.max) {
    const retryAfterSeconds = Math.max(Math.ceil((existing.resetAt - now) / 1000), 1);
    return {
      allowed: false,
      limit: config.max,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  store.set(key, existing);

  return {
    allowed: true,
    limit: config.max,
    remaining: Math.max(config.max - existing.count, 0),
    resetAt: existing.resetAt,
  };
}

export function rateLimitResponse(decision: RateLimitDecision): NextResponse {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(decision.limit),
    'X-RateLimit-Remaining': String(decision.remaining),
    'X-RateLimit-Reset': String(Math.floor(decision.resetAt / 1000)),
  };
  if (decision.retryAfterSeconds) {
    headers['Retry-After'] = String(decision.retryAfterSeconds);
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Too many requests. Please wait and try again.',
      details: {
        type: 'rate_limited',
        limit: decision.limit,
        resetAt: decision.resetAt,
      },
    },
    { status: 429, headers }
  );
}
