/**
 * Template Seeding / Synchronization
 *
 * Entry point for template synchronization on app load.
 * Handles both initial seeding for new users and updates for existing users.
 *
 * The synchronization system:
 * - Automatically adds new templates from the bundle
 * - Updates existing templates when bundle changes
 * - Preserves user modifications (won't overwrite customized templates)
 * - Quick exits if nothing has changed (bundle version check)
 * - Seamlessly migrates existing users from old seeding system
 */

import {
  synchronizeTemplates,
  forceSynchronizeTemplates as forceSync,
  getSyncStatus,
  type TemplateSyncResult,
} from './template-sync';

/**
 * Legacy localStorage key from old seeding system.
 * Used to detect and migrate existing users.
 */
const LEGACY_SEEDING_KEY = 'meeting-transcriber-templates-seeded';

// Re-export for backward compatibility and convenience
export { BUILT_IN_TEMPLATES } from './generated/templates';
export {
  synchronizeTemplates,
  forceSynchronizeTemplates,
  resetTemplateToDefault,
  getSyncStatus,
  type TemplateSyncResult,
  type TemplateSyncChange,
} from './template-sync';

/**
 * Last sync result, cached for UI access
 */
let lastSyncResult: TemplateSyncResult | null = null;

/**
 * Get the result of the last synchronization.
 * Useful for showing notifications about updated/skipped templates.
 */
export function getLastSyncResult(): TemplateSyncResult | null {
  return lastSyncResult;
}

/**
 * Check if this is an existing user migrating from the old seeding system.
 * Migration is needed when:
 * - The old seeding flag exists (user has templates seeded before)
 * - The new bundle version doesn't exist (never synced with new system)
 */
function needsMigration(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const hasLegacyFlag = localStorage.getItem(LEGACY_SEEDING_KEY) !== null;
    const status = getSyncStatus();

    // Migration needed if user has old flag but no bundle version
    return hasLegacyFlag && status.storedVersion === null;
  } catch {
    return false;
  }
}

/**
 * Clear the legacy seeding flag after successful migration.
 */
function clearLegacyFlag(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(LEGACY_SEEDING_KEY);
    console.log('[Templates] Cleared legacy seeding flag');
  } catch {
    // Non-critical - ignore
  }
}

/**
 * Seed/synchronize default templates on app load.
 *
 * This is the main entry point called during app initialization.
 * It replaces the old "seed once, never update" approach with
 * a proper synchronization that keeps templates up to date.
 *
 * Safe to call multiple times - uses bundle version check for quick exit.
 *
 * For existing users: Automatically detects and migrates from the old
 * seeding system without any manual intervention required.
 *
 * @returns Promise<void>
 * @throws Error if synchronization fails completely
 */
export async function seedDefaultTemplates(): Promise<void> {
  // Skip on server-side
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Check for migration from old seeding system
    const isMigration = needsMigration();

    if (isMigration) {
      console.log('[Templates] Migrating from legacy seeding system...');

      // Force sync to ensure all templates get proper metadata
      const result = await forceSync();
      lastSyncResult = result;

      // Clear old flag after successful migration
      clearLegacyFlag();

      console.log('[Templates] Migration complete:', {
        added: result.stats.added,
        updated: result.stats.updated,
        skippedUserModified: result.stats.skippedUserModified,
      });

      return;
    }

    // Normal flow: Check if sync is needed
    const status = getSyncStatus();

    if (!status.needsSync) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Templates] Up to date, no sync needed');
      }
      return;
    }

    // Perform synchronization
    const result = await synchronizeTemplates();
    lastSyncResult = result;

    // Log summary
    if (result.stats.added > 0 || result.stats.updated > 0) {
      console.log('[Templates] Synchronized:', {
        added: result.stats.added,
        updated: result.stats.updated,
      });
    }

    // Warn about user-modified templates that weren't updated
    if (result.userModifiedTemplates.length > 0) {
      console.log(
        '[Templates] Skipped templates with local modifications:',
        result.userModifiedTemplates
      );
    }

    // Log errors if any
    if (result.stats.errors > 0) {
      console.error('[Templates] Some templates failed to sync:', {
        errors: result.changes.filter(c => c.type === 'error'),
      });
    }

  } catch (error) {
    console.error('[Templates] Synchronization failed:', error);
    throw new Error(
      `Failed to synchronize templates: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * @deprecated Use seedDefaultTemplates() instead.
 * This function is kept for backward compatibility.
 */
export async function resetDefaultTemplates(): Promise<void> {
  if (typeof window === 'undefined') return;

  // Import dynamically to avoid circular dependencies
  const { forceSynchronizeTemplates } = await import('./template-sync');

  try {
    const result = await forceSynchronizeTemplates();
    lastSyncResult = result;

    console.log('[Templates] Force sync complete:', {
      added: result.stats.added,
      updated: result.stats.updated,
    });
  } catch (error) {
    console.error('[Templates] Force sync failed:', error);
    throw error;
  }
}

/**
 * Gets the count of built-in templates currently in the database
 */
export async function getBuiltInTemplateCount(): Promise<number> {
  try {
    const { getDatabase } = await import('./db');
    const db = getDatabase();
    const allTemplates = await db.templates.toArray();
    return allTemplates.filter(template => !template.isCustom).length;
  } catch (error) {
    console.error('Error getting built-in template count:', error);
    return 0;
  }
}

/**
 * Check if any templates have pending updates that were skipped
 * due to user modifications.
 */
export function hasSkippedUpdates(): boolean {
  return (lastSyncResult?.userModifiedTemplates.length ?? 0) > 0;
}

/**
 * Get list of templates that have user modifications
 * and may be out of date.
 */
export function getModifiedTemplateNames(): string[] {
  return lastSyncResult?.userModifiedTemplates ?? [];
}
