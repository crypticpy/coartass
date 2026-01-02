/**
 * Storage Monitoring (IndexedDB)
 */

import { DatabaseError, getDatabase } from "./core";

/**
 * Storage estimate information.
 */
export interface StorageEstimate {
  /** Total bytes used */
  usage: number;
  /** Total bytes available (may be undefined in some browsers) */
  quota?: number;
  /** Percentage used (0-100) */
  percentUsed?: number;
  /** Human-readable usage string */
  usageFormatted: string;
  /** Human-readable quota string */
  quotaFormatted?: string;
}

/**
 * Result of a storage quota check operation.
 * Used to determine if there's enough space before large uploads.
 */
export interface StorageQuotaCheckResult {
  /** Whether there's enough space for the requested bytes */
  hasSpace: boolean;
  /** Number of bytes available (if quota info is available) */
  availableBytes?: number;
  /** Percentage of quota currently used (0-100) */
  percentUsed?: number;
  /** True if storage is running low (>90% used or <100MB available) */
  warningThreshold: boolean;
  /** Error message if hasSpace is false */
  error?: string;
}

/**
 * Storage status information for proactive quota warnings.
 * Used for displaying storage usage indicators to users.
 */
export interface StorageStatus {
  /** Total bytes currently used */
  used: number;
  /** Total bytes available (quota) */
  quota: number;
  /** Percentage of quota used (0-100) */
  percentUsed: number;
  /** True if storage is running low (>80% used) */
  isLow: boolean;
  /** Human-readable used storage string */
  usedFormatted: string;
  /** Human-readable quota string */
  quotaFormatted: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Gets storage quota and usage information.
 */
export async function getStorageEstimate(): Promise<StorageEstimate> {
  try {
    if (!navigator.storage || !navigator.storage.estimate) {
      throw new DatabaseError(
        "Storage estimation is not supported in this browser",
        "STORAGE_API_NOT_SUPPORTED"
      );
    }

    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota;

    let percentUsed: number | undefined;
    if (quota && quota > 0) {
      percentUsed = (usage / quota) * 100;
    }

    return {
      usage,
      quota,
      percentUsed,
      usageFormatted: formatBytes(usage),
      quotaFormatted: quota ? formatBytes(quota) : undefined,
    };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(
      "Failed to get storage estimate",
      "STORAGE_ESTIMATE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get current storage status for proactive quota warnings.
 */
export async function getStorageStatus(): Promise<StorageStatus> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentUsed = quota > 0 ? (used / quota) * 100 : 0;

      return {
        used,
        quota,
        percentUsed,
        isLow: percentUsed > 80,
        usedFormatted: formatBytes(used),
        quotaFormatted: formatBytes(quota),
      };
    } catch (error) {
      console.warn("[getStorageStatus] Failed to get storage estimate:", error);
      // Return safe defaults on error
      return {
        used: 0,
        quota: 0,
        percentUsed: 0,
        isLow: false,
        usedFormatted: "0 Bytes",
        quotaFormatted: "0 Bytes",
      };
    }
  }

  // Storage API not supported - return safe defaults
  return {
    used: 0,
    quota: 0,
    percentUsed: 0,
    isLow: false,
    usedFormatted: "0 Bytes",
    quotaFormatted: "0 Bytes",
  };
}

/**
 * Check storage quota before attempting large operations.
 * Returns whether there's enough space and warns if running low.
 */
export async function checkStorageQuota(requiredBytes: number): Promise<StorageQuotaCheckResult> {
  try {
    const estimate = await getStorageEstimate();

    if (estimate.quota === undefined || estimate.usage === undefined) {
      // Can't determine quota, assume OK but can't give warnings
      return { hasSpace: true, warningThreshold: false };
    }

    const availableBytes = estimate.quota - estimate.usage;
    const hasSpace = availableBytes >= requiredBytes;

    // Warn if less than 10% remaining or less than 100MB available
    const warningThreshold =
      (estimate.percentUsed !== undefined && estimate.percentUsed > 90) ||
      availableBytes < 100 * 1024 * 1024;

    return {
      hasSpace,
      availableBytes,
      percentUsed: estimate.percentUsed,
      warningThreshold,
      error: hasSpace
        ? undefined
        : `Not enough storage space. Need ${formatBytes(requiredBytes)}, only ${formatBytes(availableBytes)} available.`,
    };
  } catch (error) {
    console.warn("Storage quota check failed:", error);
    // On error, assume OK to not block user, but can't give warnings
    return { hasSpace: true, warningThreshold: false };
  }
}

/**
 * Calculates detailed storage usage by counting records in key tables.
 */
export async function calculateStorageUsage(): Promise<{
  transcriptCount: number;
  templateCount: number;
  analysisCount: number;
  totalRecords: number;
}> {
  try {
    const db = getDatabase();

    const [transcriptCount, templateCount, analysisCount] = await Promise.all([
      db.transcripts.count(),
      db.templates.count(),
      db.analyses.count(),
    ]);

    return {
      transcriptCount,
      templateCount,
      analysisCount,
      totalRecords: transcriptCount + templateCount + analysisCount,
    };
  } catch (error) {
    throw new DatabaseError(
      "Failed to calculate storage usage",
      "USAGE_CALCULATION_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

