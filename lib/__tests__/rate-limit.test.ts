/**
 * Rate Limiter Tests
 *
 * Tests for the in-memory rate limiter including:
 * - Basic rate limiting behavior
 * - Window expiration and reset
 * - Client key generation
 * - Store cleanup and LRU eviction
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  checkRateLimit,
  _resetRateLimiter,
  _getStoreSize,
  type RateLimitConfig,
} from '@/lib/rate-limit';

// Mock NextRequest
function createMockRequest(options: {
  ip?: string;
  userAgent?: string;
  headers?: Record<string, string>;
} = {}): { headers: { get: (name: string) => string | null } } {
  const headers = new Map<string, string>();

  if (options.ip) {
    headers.set('x-forwarded-for', options.ip);
  }
  if (options.userAgent) {
    headers.set('user-agent', options.userAgent);
  }
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      headers.set(key.toLowerCase(), value);
    }
  }

  return {
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) ?? null,
    },
  };
}

const defaultConfig: RateLimitConfig = {
  key: 'test',
  windowMs: 60 * 1000, // 1 minute
  max: 5,
};

describe('rate-limit', () => {
  beforeEach(() => {
    _resetRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    _resetRateLimiter();
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('allows requests under the limit', () => {
      const request = createMockRequest({ ip: '192.168.1.1' });

      for (let i = 0; i < 5; i++) {
        const decision = checkRateLimit(request as never, defaultConfig);
        expect(decision.allowed).toBe(true);
        expect(decision.remaining).toBe(4 - i);
      }
    });

    it('blocks requests over the limit', () => {
      const request = createMockRequest({ ip: '192.168.1.2' });

      // Use up all allowed requests
      for (let i = 0; i < 5; i++) {
        checkRateLimit(request as never, defaultConfig);
      }

      // Next request should be blocked
      const decision = checkRateLimit(request as never, defaultConfig);
      expect(decision.allowed).toBe(false);
      expect(decision.remaining).toBe(0);
      expect(decision.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('resets after window expires', () => {
      const request = createMockRequest({ ip: '192.168.1.3' });

      // Use up all allowed requests
      for (let i = 0; i < 5; i++) {
        checkRateLimit(request as never, defaultConfig);
      }

      // Should be blocked
      expect(checkRateLimit(request as never, defaultConfig).allowed).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(defaultConfig.windowMs + 1);

      // Should be allowed again
      const decision = checkRateLimit(request as never, defaultConfig);
      expect(decision.allowed).toBe(true);
      expect(decision.remaining).toBe(4);
    });

    it('tracks different clients separately', () => {
      const request1 = createMockRequest({ ip: '192.168.1.10' });
      const request2 = createMockRequest({ ip: '192.168.1.11' });

      // Use up all requests for client 1
      for (let i = 0; i < 5; i++) {
        checkRateLimit(request1 as never, defaultConfig);
      }

      // Client 1 should be blocked
      expect(checkRateLimit(request1 as never, defaultConfig).allowed).toBe(false);

      // Client 2 should still be allowed
      expect(checkRateLimit(request2 as never, defaultConfig).allowed).toBe(true);
    });

    it('tracks different endpoints separately', () => {
      const request = createMockRequest({ ip: '192.168.1.20' });

      const transcribeConfig: RateLimitConfig = { key: 'transcribe', windowMs: 60000, max: 5 };
      const analyzeConfig: RateLimitConfig = { key: 'analyze', windowMs: 60000, max: 5 };

      // Use up all requests for transcribe
      for (let i = 0; i < 5; i++) {
        checkRateLimit(request as never, transcribeConfig);
      }

      // Transcribe should be blocked
      expect(checkRateLimit(request as never, transcribeConfig).allowed).toBe(false);

      // Analyze should still be allowed
      expect(checkRateLimit(request as never, analyzeConfig).allowed).toBe(true);
    });

    it('returns correct rate limit headers info', () => {
      const request = createMockRequest({ ip: '192.168.1.30' });
      const config: RateLimitConfig = { key: 'headers-test', windowMs: 120000, max: 10 };

      const decision = checkRateLimit(request as never, config);

      expect(decision.limit).toBe(10);
      expect(decision.remaining).toBe(9);
      expect(decision.resetAt).toBeGreaterThan(Date.now());
    });

    it('supports custom client key override', () => {
      const request = createMockRequest({ ip: '192.168.1.40' });

      // Use custom key instead of IP-based key
      for (let i = 0; i < 5; i++) {
        checkRateLimit(request as never, defaultConfig, { clientKey: 'custom-user-123' });
      }

      // Should be blocked with custom key
      expect(
        checkRateLimit(request as never, defaultConfig, { clientKey: 'custom-user-123' }).allowed
      ).toBe(false);

      // Same IP with different custom key should be allowed
      expect(
        checkRateLimit(request as never, defaultConfig, { clientKey: 'custom-user-456' }).allowed
      ).toBe(true);
    });
  });

  describe('client key generation', () => {
    it('includes IP in client key', () => {
      const request1 = createMockRequest({ ip: '1.2.3.4', userAgent: 'same-agent' });
      const request2 = createMockRequest({ ip: '5.6.7.8', userAgent: 'same-agent' });

      // Different IPs should create different rate limit buckets
      for (let i = 0; i < 5; i++) {
        checkRateLimit(request1 as never, defaultConfig);
      }

      // Request 1 should be blocked
      expect(checkRateLimit(request1 as never, defaultConfig).allowed).toBe(false);

      // Request 2 (different IP) should still be allowed
      expect(checkRateLimit(request2 as never, defaultConfig).allowed).toBe(true);
    });

    it('falls back to x-real-ip header', () => {
      const request = createMockRequest({
        headers: { 'x-real-ip': '10.0.0.1' },
        userAgent: 'test-agent',
      });

      const decision = checkRateLimit(request as never, defaultConfig);
      expect(decision.allowed).toBe(true);
    });

    it('falls back to x-azure-clientip header', () => {
      const request = createMockRequest({
        headers: { 'x-azure-clientip': '10.0.0.2' },
        userAgent: 'test-agent',
      });

      const decision = checkRateLimit(request as never, defaultConfig);
      expect(decision.allowed).toBe(true);
    });
  });

  describe('store management', () => {
    it('tracks store size correctly', () => {
      expect(_getStoreSize()).toBe(0);

      // Add entries from different clients
      for (let i = 0; i < 10; i++) {
        const request = createMockRequest({ ip: `192.168.1.${i}` });
        checkRateLimit(request as never, defaultConfig);
      }

      // Each unique client creates one entry
      expect(_getStoreSize()).toBe(10);
    });

    it('cleans up expired entries', () => {
      // Create some entries
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest({ ip: `192.168.2.${i}` });
        checkRateLimit(request as never, defaultConfig);
      }

      expect(_getStoreSize()).toBe(5);

      // Advance time past the window
      vi.advanceTimersByTime(defaultConfig.windowMs + 1);

      // Trigger cleanup by making a new request
      const newRequest = createMockRequest({ ip: '192.168.2.100' });
      checkRateLimit(newRequest as never, defaultConfig);

      // Old entries should be cleaned up, only new one remains
      expect(_getStoreSize()).toBe(1);
    });

    it('resets completely when _resetRateLimiter is called', () => {
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest({ ip: `192.168.3.${i}` });
        checkRateLimit(request as never, defaultConfig);
      }

      expect(_getStoreSize()).toBe(5);

      _resetRateLimiter();

      expect(_getStoreSize()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles missing IP gracefully', () => {
      const request = createMockRequest({ userAgent: 'test-agent' });

      const decision = checkRateLimit(request as never, defaultConfig);
      expect(decision.allowed).toBe(true);
    });

    it('handles missing user-agent gracefully', () => {
      const request = createMockRequest({ ip: '192.168.4.1' });

      const decision = checkRateLimit(request as never, defaultConfig);
      expect(decision.allowed).toBe(true);
    });

    it('handles both missing gracefully', () => {
      const request = createMockRequest({});

      const decision = checkRateLimit(request as never, defaultConfig);
      expect(decision.allowed).toBe(true);
    });

    it('handles very short windows', () => {
      const shortConfig: RateLimitConfig = { key: 'short', windowMs: 100, max: 2 };
      const request = createMockRequest({ ip: '192.168.5.1' });

      checkRateLimit(request as never, shortConfig);
      checkRateLimit(request as never, shortConfig);

      expect(checkRateLimit(request as never, shortConfig).allowed).toBe(false);

      vi.advanceTimersByTime(101);

      expect(checkRateLimit(request as never, shortConfig).allowed).toBe(true);
    });

    it('handles max = 1 correctly', () => {
      const singleConfig: RateLimitConfig = { key: 'single', windowMs: 60000, max: 1 };
      const request = createMockRequest({ ip: '192.168.6.1' });

      const first = checkRateLimit(request as never, singleConfig);
      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(0);

      const second = checkRateLimit(request as never, singleConfig);
      expect(second.allowed).toBe(false);
    });
  });
});
