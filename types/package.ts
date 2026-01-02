/**
 * Package Type Definitions
 *
 * Re-exports package types from the validation module to ensure
 * a single source of truth for the package schema.
 */

// Re-export all types from the validation module
export type {
  ExportableTranscript,
  ExportableAnalysis,
  PackageMetadata,
  MeetingTranscriberPackage,
  ValidationResult,
} from '@/lib/package/validation';

// Re-export constants
export { MAX_PACKAGE_SIZE, PACKAGE_FORMAT_VERSION } from '@/lib/package/validation';

/**
 * Action to take when importing a package that conflicts with existing data.
 * - 'rename': Import with a new unique ID (preserves existing data)
 * - 'cancel': Abort the import operation
 */
export type ImportConflictAction = 'rename' | 'cancel';

/**
 * Type guard to check if a string is a valid ImportConflictAction.
 */
export function isImportConflictAction(action: string): action is ImportConflictAction {
  return action === 'rename' || action === 'cancel';
}
