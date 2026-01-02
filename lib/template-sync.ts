/**
 * Template Synchronization Module
 *
 * Handles automatic synchronization of built-in templates from the bundle
 * to IndexedDB. Detects changes, handles conflicts, and migrates existing users.
 *
 * Key features:
 * - Quick bundle version check to skip sync if nothing changed
 * - Per-template content hash for granular change detection
 * - Conflict detection: won't overwrite user-modified templates
 * - Migration support for existing users without sync metadata
 * - Detailed sync results for debugging and user notification
 */

import { v4 as uuidv4 } from 'uuid';
import type { Template } from '@/types/template';
import { getDatabase } from './db';
import {
  BUILT_IN_TEMPLATES,
  TEMPLATE_BUNDLE_VERSION,
  CURRENT_SCHEMA_VERSION,
  type TemplateInput,
} from './generated/templates';

/**
 * Storage key for tracking bundle version
 */
const BUNDLE_VERSION_KEY = 'template-bundle-version';

/**
 * Storage key for tracking schema version
 */
const SCHEMA_VERSION_KEY = 'template-schema-version';

/**
 * Storage key for tracking sync engine version.
 * This lets us force a one-time re-sync when we fix sync logic bugs
 * even if the bundle/schema versions already match in localStorage.
 */
const SYNC_ENGINE_VERSION_KEY = 'template-sync-engine-version';

/**
 * Increment this when sync logic changes require a re-run for existing users.
 */
const CURRENT_SYNC_ENGINE_VERSION = 2;

/**
 * Result of a single template sync operation
 */
export interface TemplateSyncChange {
  name: string;
  type: 'added' | 'updated' | 'skipped-user-modified' | 'skipped-no-change' | 'error';
  details?: string;
}

/**
 * Overall result of template synchronization
 */
export interface TemplateSyncResult {
  status: 'up-to-date' | 'synchronized' | 'partial-failure';
  bundleVersion: string;
  previousVersion: string | null;
  changes: TemplateSyncChange[];
  stats: {
    added: number;
    updated: number;
    skippedUserModified: number;
    skippedNoChange: number;
    errors: number;
  };
  /** Templates that were skipped due to user modifications */
  userModifiedTemplates: string[];
}

/**
 * Check if the stored bundle version matches the current bundle
 */
function getStoredBundleVersion(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(BUNDLE_VERSION_KEY);
  } catch {
    return null;
  }
}

/**
 * Update the stored bundle version
 */
function setStoredBundleVersion(version: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BUNDLE_VERSION_KEY, version);
  } catch (error) {
    console.error('[TemplateSync] Failed to update bundle version:', error);
  }
}

/**
 * Get the stored schema version
 */
function getStoredSchemaVersion(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const stored = localStorage.getItem(SCHEMA_VERSION_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Update the stored schema version
 */
function setStoredSchemaVersion(version: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCHEMA_VERSION_KEY, version.toString());
  } catch (error) {
    console.error('[TemplateSync] Failed to update schema version:', error);
  }
}

/**
 * Get the stored sync engine version.
 */
function getStoredSyncEngineVersion(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const stored = localStorage.getItem(SYNC_ENGINE_VERSION_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Update the stored sync engine version.
 */
function setStoredSyncEngineVersion(version: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SYNC_ENGINE_VERSION_KEY, version.toString());
  } catch (error) {
    console.error('[TemplateSync] Failed to update sync engine version:', error);
  }
}

/**
 * Compute a content hash for a template that matches scripts/build-templates.mjs.
 * Uses WebCrypto SHA-256 and returns the first 16 hex chars.
 */
async function computeTemplateContentHash(template: Template | TemplateInput): Promise<string> {
  const contentForHash = {
    name: template.name,
    description: template.description,
    icon: template.icon,
    category: template.category,
    outputs: template.outputs,
    supportsSupplementalMaterial: template.supportsSupplementalMaterial || false,
    sections: template.sections.map(section => ({
      id: section.id,
      name: section.name,
      prompt: section.prompt,
      extractEvidence: section.extractEvidence,
      outputFormat: section.outputFormat,
      dependencies: section.dependencies || [],
    })),
  };

  // IMPORTANT: This intentionally mirrors the build script's hashing input.
  // Keep this in sync with scripts/build-templates.mjs.
  const stableJson = stableStringify(contentForHash);

  // WebCrypto SHA-256 (available in modern browsers and in Node 20+).
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto not available for template hashing');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(stableJson);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  const fullHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return fullHex.substring(0, 16);
}

/**
 * Legacy (v1) hash computation used by the original sync engine.
 * WARNING: This intentionally mirrors the old, flawed stable-stringify behavior
 * that used a JSON replacer array and therefore did not include nested keys.
 * We keep it solely to support one-time migrations of previously stored hashes.
 */
async function computeTemplateContentHashLegacyV1(
  template: Template | TemplateInput
): Promise<string> {
  const contentForHash = {
    name: template.name,
    description: template.description,
    icon: template.icon,
    category: template.category,
    outputs: template.outputs,
    supportsSupplementalMaterial: template.supportsSupplementalMaterial || false,
    sections: template.sections.map(section => ({
      id: section.id,
      name: section.name,
      prompt: section.prompt,
      extractEvidence: section.extractEvidence,
      outputFormat: section.outputFormat,
      dependencies: section.dependencies || [],
    })),
  };

  // Legacy behavior: JSON replacer array filtered nested keys.
  // This is NOT a correct stable stringify; it is kept only for migration.
  const stableJson = JSON.stringify(contentForHash, Object.keys(contentForHash).sort());

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto not available for template hashing');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(stableJson);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  const fullHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return fullHex.substring(0, 16);
}

/**
 * Stable stringify for hashing.
 * Sorts object keys recursively while preserving array order.
 */
function stableStringify(value: unknown): string {
  function sortKeysDeep(input: unknown): unknown {
    if (Array.isArray(input)) {
      return input.map(sortKeysDeep);
    }
    if (input && typeof input === 'object') {
      const record = input as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(record).sort()) {
        sorted[key] = sortKeysDeep(record[key]);
      }
      return sorted;
    }
    return input;
  }

  return JSON.stringify(sortKeysDeep(value));
}

/**
 * Check if a template has been modified by the user.
 *
 * This is used to decide whether it is safe to overwrite a built-in template
 * when the bundle has changed.
 *
 * Rules:
 * - If the stored template's last-synced hash matches its current content hash,
 *   the user hasn't modified it since the last sync (safe to update).
 * - If the stored template's last-synced hash matches the current bundle hash
 *   but content differs, we treat it as user-modified (skip).
 * - If we lack sync metadata (legacy templates), be conservative and assume
 *   user-modified when content differs.
 */
async function hasUserModified(
  stored: Template,
  bundleTemplate: TemplateInput,
  options?: { allowLegacyHashMigration?: boolean }
): Promise<boolean> {
  // No sync metadata: if content differs, treat as user-modified to avoid overwriting.
  if (!stored.contentHash) {
    return true;
  }

  // If the stored hash equals the current bundle hash but content differs, the user changed it.
  // (Bundle hash represents the exact content we last synced when bundle hasn't changed.)
  if (stored.contentHash === bundleTemplate.contentHash) {
    return true;
  }

  // Bundle hash differs; disambiguate "bundle updated" vs "user modified" by checking
  // whether the stored template's CURRENT content still matches what we last synced.
  try {
    const currentHash = await computeTemplateContentHash(stored);
    if (currentHash === stored.contentHash) {
      return false;
    }

    if (options?.allowLegacyHashMigration) {
      try {
        const legacyHash = await computeTemplateContentHashLegacyV1(stored);
        return legacyHash !== stored.contentHash;
      } catch (legacyError) {
        console.warn(
          '[TemplateSync] Failed to compute legacy template hash; treating as user-modified',
          {
            templateName: stored.name,
            error: legacyError instanceof Error ? legacyError.message : String(legacyError),
          }
        );
        return true;
      }
    }

    return true;
  } catch (error) {
    console.warn('[TemplateSync] Failed to compute stored template hash; treating as user-modified', {
      templateName: stored.name,
      error: error instanceof Error ? error.message : String(error),
    });

    return true;
  }
}

/**
 * Check if a stored template's content matches the bundle template.
 * Compares only the fields that define template behavior.
 */
function contentMatches(stored: Template, bundle: TemplateInput): boolean {
  // Quick checks first
  if (stored.name !== bundle.name) return false;
  if (stored.description !== bundle.description) return false;
  if (stored.icon !== bundle.icon) return false;
  if (stored.category !== bundle.category) return false;
  // Normalize undefined to false for comparison
  if ((stored.supportsSupplementalMaterial || false) !== (bundle.supportsSupplementalMaterial || false)) return false;

  // Check outputs
  if (stored.outputs.length !== bundle.outputs.length) return false;
  for (let i = 0; i < stored.outputs.length; i++) {
    if (stored.outputs[i] !== bundle.outputs[i]) return false;
  }

  // Check sections
  if (stored.sections.length !== bundle.sections.length) return false;
  for (let i = 0; i < stored.sections.length; i++) {
    const storedSection = stored.sections[i];
    const bundleSection = bundle.sections[i];

    if (storedSection.id !== bundleSection.id) return false;
    if (storedSection.name !== bundleSection.name) return false;
    if (storedSection.prompt !== bundleSection.prompt) return false;
    if (storedSection.extractEvidence !== bundleSection.extractEvidence) return false;
    if (storedSection.outputFormat !== bundleSection.outputFormat) return false;

    // Check dependencies
    const storedDeps = storedSection.dependencies || [];
    const bundleDeps = bundleSection.dependencies || [];
    if (storedDeps.length !== bundleDeps.length) return false;
    for (let j = 0; j < storedDeps.length; j++) {
      if (storedDeps[j] !== bundleDeps[j]) return false;
    }
  }

  return true;
}

/**
 * Synchronize built-in templates from bundle to IndexedDB.
 *
 * This function:
 * 1. Checks if sync is needed (bundle version comparison)
 * 2. For each bundle template, determines action:
 *    - Add if new
 *    - Update if changed and user hasn't modified
 *    - Skip if user has modified (preserve their changes)
 * 3. Updates bundle version marker on success
 *
 * Safe to call on every app load - quick exits if nothing to do.
 *
 * @returns Promise<TemplateSyncResult> with detailed sync information
 */
export async function synchronizeTemplates(): Promise<TemplateSyncResult> {
  // Skip on server-side
  if (typeof window === 'undefined') {
    return {
      status: 'up-to-date',
      bundleVersion: TEMPLATE_BUNDLE_VERSION,
      previousVersion: null,
      changes: [],
      stats: { added: 0, updated: 0, skippedUserModified: 0, skippedNoChange: 0, errors: 0 },
      userModifiedTemplates: [],
    };
  }

  const previousVersion = getStoredBundleVersion();
  const storedSchemaVersion = getStoredSchemaVersion();
  const storedSyncEngineVersion = getStoredSyncEngineVersion();
  const isSyncEngineMigration = storedSyncEngineVersion < CURRENT_SYNC_ENGINE_VERSION;
  const result: TemplateSyncResult = {
    status: 'up-to-date',
    bundleVersion: TEMPLATE_BUNDLE_VERSION,
    previousVersion,
    changes: [],
    stats: { added: 0, updated: 0, skippedUserModified: 0, skippedNoChange: 0, errors: 0 },
    userModifiedTemplates: [],
  };

  // Quick check: if everything matches, nothing to do.
  // NOTE: We must include schema AND sync engine version checks here,
  // otherwise schema upgrades or sync-bugfix migrations would be skipped.
  if (
    previousVersion === TEMPLATE_BUNDLE_VERSION &&
    storedSchemaVersion >= CURRENT_SCHEMA_VERSION &&
    storedSyncEngineVersion >= CURRENT_SYNC_ENGINE_VERSION
  ) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[TemplateSync] No sync needed, skipping');
    }
    return result;
  }

  console.log('[TemplateSync] Starting template synchronization', {
    previousVersion: previousVersion || '(none)',
    currentVersion: TEMPLATE_BUNDLE_VERSION,
    isSyncEngineMigration,
  });

  try {
    const db = getDatabase();
    const now = new Date();

    // Get all existing built-in templates
    const existingTemplates = await db.templates
      .filter(t => !t.isCustom)
      .toArray();

    // Create lookup by name
    const existingByName = new Map<string, Template>(
      existingTemplates.map(t => [t.name, t])
    );

    // Process each bundle template
    for (const bundleTemplate of BUILT_IN_TEMPLATES) {
      try {
        const existing = existingByName.get(bundleTemplate.name);

        if (!existing) {
          // New template - add it
          await db.templates.add({
            ...bundleTemplate,
            id: uuidv4(),
            createdAt: now,
            contentHash: bundleTemplate.contentHash,
            bundleVersion: TEMPLATE_BUNDLE_VERSION,
            lastSyncedAt: now,
          });

          result.changes.push({
            name: bundleTemplate.name,
            type: 'added',
          });
          result.stats.added++;
          continue;
        }

        // Check if schema version is outdated - force update if so
        // This handles migration when we add new fields to templates
        const existingSchemaVersion = existing.schemaVersion || 0;
        const needsSchemaUpdate = existingSchemaVersion < CURRENT_SCHEMA_VERSION;

        if (needsSchemaUpdate) {
          // Force update - schema version is outdated
          console.log(`[TemplateSync] Updating "${bundleTemplate.name}" from schema v${existingSchemaVersion} to v${CURRENT_SCHEMA_VERSION}`);

          await db.templates.update(existing.id, {
            ...bundleTemplate,
            id: existing.id,
            createdAt: existing.createdAt,
            schemaVersion: CURRENT_SCHEMA_VERSION,
            contentHash: bundleTemplate.contentHash,
            bundleVersion: TEMPLATE_BUNDLE_VERSION,
            lastSyncedAt: now,
          });

          result.changes.push({
            name: bundleTemplate.name,
            type: 'updated',
            details: `Schema upgrade v${existingSchemaVersion} → v${CURRENT_SCHEMA_VERSION}`,
          });
          result.stats.updated++;
          continue;
        }

        // Check if content matches (no change needed)
        if (contentMatches(existing, bundleTemplate)) {
          // Content matches - refresh sync metadata so future updates can detect user changes reliably.
          // This is also important when the hashing algorithm changes (hashes will differ even if content doesn't).
          if (
            existing.contentHash !== bundleTemplate.contentHash ||
            existing.bundleVersion !== TEMPLATE_BUNDLE_VERSION ||
            !existing.lastSyncedAt
          ) {
            await db.templates.update(existing.id, {
              contentHash: bundleTemplate.contentHash,
              bundleVersion: TEMPLATE_BUNDLE_VERSION,
              lastSyncedAt: now,
            });
          }

          result.changes.push({
            name: bundleTemplate.name,
            type: 'skipped-no-change',
          });
          result.stats.skippedNoChange++;
          continue;
        }

        // Content differs - check if user modified or bundle updated
        const hasUserChanges = await hasUserModified(existing, bundleTemplate, {
          allowLegacyHashMigration: isSyncEngineMigration,
        });

        if (hasUserChanges) {
          // User has modified this template - don't overwrite
          result.changes.push({
            name: bundleTemplate.name,
            type: 'skipped-user-modified',
            details: 'Template has local modifications',
          });
          result.stats.skippedUserModified++;
          result.userModifiedTemplates.push(bundleTemplate.name);
          continue;
        }

        // Safe to update - bundle changed and user hasn't modified
        await db.templates.update(existing.id, {
          ...bundleTemplate,
          // Preserve user's ID and createdAt
          id: existing.id,
          createdAt: existing.createdAt,
          // Update sync metadata
          contentHash: bundleTemplate.contentHash,
          bundleVersion: TEMPLATE_BUNDLE_VERSION,
          lastSyncedAt: now,
        });

        result.changes.push({
          name: bundleTemplate.name,
          type: 'updated',
        });
        result.stats.updated++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[TemplateSync] Error processing "${bundleTemplate.name}":`, error);

        result.changes.push({
          name: bundleTemplate.name,
          type: 'error',
          details: errorMessage,
        });
        result.stats.errors++;
      }
    }

    // Update bundle and schema version if no errors (or only some errors)
    if (result.stats.errors === 0) {
      setStoredBundleVersion(TEMPLATE_BUNDLE_VERSION);
      setStoredSchemaVersion(CURRENT_SCHEMA_VERSION);
      setStoredSyncEngineVersion(CURRENT_SYNC_ENGINE_VERSION);
      result.status = 'synchronized';
    } else if (result.stats.added > 0 || result.stats.updated > 0) {
      // Partial success - some templates synced, some failed
      setStoredBundleVersion(TEMPLATE_BUNDLE_VERSION);
      setStoredSchemaVersion(CURRENT_SCHEMA_VERSION);
      setStoredSyncEngineVersion(CURRENT_SYNC_ENGINE_VERSION);
      result.status = 'partial-failure';
    }

    console.log('[TemplateSync] Synchronization complete', {
      status: result.status,
      added: result.stats.added,
      updated: result.stats.updated,
      skippedUserModified: result.stats.skippedUserModified,
      skippedNoChange: result.stats.skippedNoChange,
      errors: result.stats.errors,
    });

    return result;

  } catch (error) {
    console.error('[TemplateSync] Synchronization failed:', error);
    throw error;
  }
}

/**
 * Force re-sync all templates, ignoring bundle version check.
 * Useful for debugging or manual refresh.
 */
export async function forceSynchronizeTemplates(): Promise<TemplateSyncResult> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(BUNDLE_VERSION_KEY);
      localStorage.removeItem(SYNC_ENGINE_VERSION_KEY);
    } catch {
      // Ignore
    }
  }
  return synchronizeTemplates();
}

/**
 * Get the current sync status without performing sync.
 */
export function getSyncStatus(): {
  bundleVersion: string;
  storedVersion: string | null;
  currentSchemaVersion: number;
  storedSchemaVersion: number;
  currentSyncEngineVersion: number;
  storedSyncEngineVersion: number;
  needsSync: boolean;
} {
  const storedVersion = getStoredBundleVersion();
  const storedSchemaVersion = getStoredSchemaVersion();
  const storedSyncEngineVersion = getStoredSyncEngineVersion();

  // Need sync if bundle version changed OR schema version is outdated
  const needsSync =
    storedVersion !== TEMPLATE_BUNDLE_VERSION ||
    storedSchemaVersion < CURRENT_SCHEMA_VERSION ||
    storedSyncEngineVersion < CURRENT_SYNC_ENGINE_VERSION;

  return {
    bundleVersion: TEMPLATE_BUNDLE_VERSION,
    storedVersion,
    currentSchemaVersion: CURRENT_SCHEMA_VERSION,
    storedSchemaVersion,
    currentSyncEngineVersion: CURRENT_SYNC_ENGINE_VERSION,
    storedSyncEngineVersion,
    needsSync,
  };
}

/**
 * Reset a specific template to its bundle default.
 * Useful when user wants to discard their modifications.
 *
 * @param templateName - Name of the template to reset
 * @returns True if reset was successful
 */
export async function resetTemplateToDefault(templateName: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const bundleTemplate = BUILT_IN_TEMPLATES.find(t => t.name === templateName);
  if (!bundleTemplate) {
    console.warn(`[TemplateSync] Template "${templateName}" not found in bundle`);
    return false;
  }

  try {
    const db = getDatabase();
    const existing = await db.templates
      .filter(t => t.name === templateName && !t.isCustom)
      .first();

    if (!existing) {
      console.warn(`[TemplateSync] Template "${templateName}" not found in database`);
      return false;
    }

    const now = new Date();
    await db.templates.update(existing.id, {
      ...bundleTemplate,
      id: existing.id,
      createdAt: existing.createdAt,
      contentHash: bundleTemplate.contentHash,
      bundleVersion: TEMPLATE_BUNDLE_VERSION,
      lastSyncedAt: now,
    });

    console.log(`[TemplateSync] Reset template "${templateName}" to default`);
    return true;

  } catch (error) {
    console.error(`[TemplateSync] Failed to reset template "${templateName}":`, error);
    return false;
  }
}
