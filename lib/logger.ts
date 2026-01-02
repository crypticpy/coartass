export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

/** Maximum length for any single string value in metadata */
const MAX_STRING_LENGTH = 2000;
/** Maximum depth for nested objects in metadata */
const MAX_OBJECT_DEPTH = 4;

function normalizeLevel(value: string | undefined): LogLevel | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === 'debug' || v === 'info' || v === 'warn' || v === 'error' || v === 'silent') return v;
  return null;
}

function getConfiguredLevel(): LogLevel {
  const defaultLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
  const isBrowser = typeof window !== 'undefined';
  const publicLevel = normalizeLevel(process.env.NEXT_PUBLIC_LOG_LEVEL);
  const serverLevel = normalizeLevel(process.env.LOG_LEVEL);

  // Client bundles should only respect NEXT_PUBLIC_*; server should prefer LOG_LEVEL.
  if (isBrowser) return publicLevel ?? defaultLevel;
  return serverLevel ?? publicLevel ?? defaultLevel;
}

function shouldLog(level: LogLevel): boolean {
  const configured = getConfiguredLevel();
  return LEVEL_RANK[level] >= LEVEL_RANK[configured];
}

/**
 * Sanitize a string value for safe logging.
 * - Truncates overly long strings
 * - Removes control characters that could enable log injection
 * - Escapes newlines to prevent log forging
 */
function sanitizeString(value: string): string {
  // Remove control characters except common whitespace (tab, newline, carriage return)
   
  let sanitized = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Escape newlines to prevent log forging (fake log entries)
  sanitized = sanitized.replace(/\n/g, '\\n').replace(/\r/g, '\\r');

  // Truncate if too long
  if (sanitized.length > MAX_STRING_LENGTH) {
    return sanitized.slice(0, MAX_STRING_LENGTH) + '...[truncated]';
  }

  return sanitized;
}

/**
 * Recursively sanitize metadata values to prevent log injection attacks.
 * Handles strings, numbers, booleans, arrays, and plain objects.
 */
function sanitizeMetadata(
  value: unknown,
  depth = 0
): unknown {
  if (depth > MAX_OBJECT_DEPTH) {
    return '[max depth exceeded]';
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeMetadata(item, depth + 1));
  }

  if (typeof value === 'object') {
    // Handle Error objects specially
    if (value instanceof Error) {
      return {
        name: sanitizeString(value.name),
        message: sanitizeString(value.message),
        stack: value.stack ? sanitizeString(value.stack) : undefined,
      };
    }

    // Plain objects
    const result: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 50);
    for (const [key, val] of entries) {
      result[sanitizeString(key)] = sanitizeMetadata(val, depth + 1);
    }
    return result;
  }

  // For other types (functions, symbols, etc.), convert to string representation
  return `[${typeof value}]`;
}

function emit(
  level: Exclude<LogLevel, 'silent'>,
  prefix: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  const sanitizedMessage = sanitizeString(message);
  const full = prefix ? `${prefix} ${sanitizedMessage}` : sanitizedMessage;
  const sanitizedMeta = meta ? sanitizeMetadata(meta) : undefined;
  const out = sanitizedMeta ? [full, sanitizedMeta] : [full];

  if (level === 'debug') console.debug(...out);
  else if (level === 'info') console.info(...out);
  else if (level === 'warn') console.warn(...out);
  else console.error(...out);
}

export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  /** Create a child logger with additional default metadata (e.g., requestId) */
  child: (defaultMeta: Record<string, unknown>) => Logger;
}

export function createLogger(scope?: string, defaultMeta?: Record<string, unknown>): Logger {
  const prefix = scope ? `[${scope}]` : '';

  const mergeMeta = (meta?: Record<string, unknown>): Record<string, unknown> | undefined => {
    if (!defaultMeta && !meta) return undefined;
    return { ...defaultMeta, ...meta };
  };

  return {
    debug: (message, meta) => {
      if (!shouldLog('debug')) return;
      emit('debug', prefix, message, mergeMeta(meta));
    },
    info: (message, meta) => {
      if (!shouldLog('info')) return;
      emit('info', prefix, message, mergeMeta(meta));
    },
    warn: (message, meta) => {
      if (!shouldLog('warn')) return;
      emit('warn', prefix, message, mergeMeta(meta));
    },
    error: (message, meta) => {
      if (!shouldLog('error')) return;
      emit('error', prefix, message, mergeMeta(meta));
    },
    child: (childMeta) => createLogger(scope, { ...defaultMeta, ...childMeta }),
  };
}

/**
 * Generate a request correlation ID.
 * Uses crypto.randomUUID if available, otherwise falls back to a simple random string.
 */
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Extract or generate a request ID from a request object.
 * Checks common headers: x-request-id, x-correlation-id, x-trace-id
 */
export function getRequestId(request: { headers: { get: (name: string) => string | null } }): string {
  return (
    request.headers.get('x-request-id') ||
    request.headers.get('x-correlation-id') ||
    request.headers.get('x-trace-id') ||
    generateRequestId()
  );
}
