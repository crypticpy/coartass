/**
 * Template Type Definitions
 *
 * Types for defining custom analysis templates that determine how
 * transcripts are processed and what information is extracted.
 */

/**
 * Output formatting options for analysis results.
 */
export type OutputFormat =
  | 'bullet_points'  // Format as bullet list
  | 'paragraph'      // Format as continuous prose
  | 'table';         // Format as structured table

/**
 * Template categorization for organization and filtering.
 */
export type TemplateCategory =
  | 'meeting'   // Templates for meeting notes and summaries
  | 'interview' // Templates for interview analysis
  | 'review'    // Templates for review and feedback sessions
  | 'custom';   // User-defined custom templates

/**
 * Types of outputs that can be generated from analysis.
 */
export type OutputType =
  | 'summary'       // Condensed overview of content
  | 'action_items'  // Extracted tasks and responsibilities
  | 'quotes'        // Notable quotations from the transcript
  | 'decisions';    // Key decisions made during the meeting

/**
 * Defines a single section within a template's analysis structure.
 * Each section represents a specific aspect to be extracted from the transcript.
 */
export interface TemplateSection {
  /** Unique identifier for the section */
  id: string;

  /** Display name for the section */
  name: string;

  /** AI prompt used to extract this section's content from the transcript */
  prompt: string;

  /** Whether to include timestamp citations as evidence */
  extractEvidence: boolean;

  /** How to format the extracted content */
  outputFormat: OutputFormat;

  /**
   * Optional array of section IDs this section depends on.
   * When using Advanced strategy, this section will receive results
   * from dependent sections for contextual analysis.
   *
   * Example: "Decisions" might depend on ["agenda-items", "key-discussions"]
   * to ensure decisions are properly linked to agenda topics.
   */
  dependencies?: string[];
}

/**
 * Complete template definition for transcript analysis.
 * Templates define the structure and prompts for extracting information.
 */
export interface Template {
  /** Unique identifier for the template */
  id: string;

  /** Display name of the template */
  name: string;

  /** Brief description of the template's purpose */
  description: string;

  /** Lucide icon name for visual representation */
  icon: string;

  /** Template category for organization */
  category: TemplateCategory;

  /** Array of sections to extract from transcripts */
  sections: TemplateSection[];

  /** Types of outputs this template generates */
  outputs: OutputType[];

  /** Whether this is a user-created custom template */
  isCustom: boolean;

  /** Timestamp when the template was created */
  createdAt: Date;

  /**
   * Whether this template supports supplemental material uploads.
   * When true, users can upload Word docs, PDFs, PowerPoint files,
   * or paste text to provide additional context for analysis.
   */
  supportsSupplementalMaterial?: boolean;

  // --- Sync/versioning fields (for built-in template synchronization) ---

  /**
   * Schema version number for the template structure.
   * Incremented when we add new fields or make breaking changes.
   * Templates with older schema versions are force-updated.
   * Current version: 1 (added supportsSupplementalMaterial)
   */
  schemaVersion?: number;

  /**
   * When this template was created/updated in the bundle.
   * Set at build time, used to determine if template needs updating.
   */
  bundleCreatedAt?: Date;

  /**
   * SHA-256 hash of template content (first 16 chars).
   * Used to detect if user has modified a built-in template.
   * Set when template is synced from bundle; if current content
   * produces a different hash, user has made local modifications.
   */
  contentHash?: string;

  /**
   * Bundle version this template was synced from.
   * Used for tracking which version of the template bundle
   * this template originated from.
   */
  bundleVersion?: string;

  /**
   * When this template was last synchronized from the bundle.
   * Only set for built-in templates.
   */
  lastSyncedAt?: Date;
}

/**
 * Type guard to check if a string is a valid OutputFormat.
 */
export function isOutputFormat(format: string): format is OutputFormat {
  return ['bullet_points', 'paragraph', 'table'].includes(format);
}

/**
 * Type guard to check if a string is a valid TemplateCategory.
 */
export function isTemplateCategory(category: string): category is TemplateCategory {
  return ['meeting', 'interview', 'review', 'custom'].includes(category);
}

/**
 * Type guard to check if a string is a valid OutputType.
 */
export function isOutputType(type: string): type is OutputType {
  return ['summary', 'action_items', 'quotes', 'decisions'].includes(type);
}

/**
 * Helper type for template creation (before ID and timestamp are assigned).
 */
export type TemplateInput = Omit<Template, 'id' | 'createdAt'>;

/**
 * Helper type for updating template fields (all fields optional except ID).
 */
export type TemplateUpdate = Partial<Omit<Template, 'id'>> & Pick<Template, 'id'>;

/**
 * Helper type for section creation (before ID is assigned).
 */
export type TemplateSectionInput = Omit<TemplateSection, 'id'>;

/**
 * Default template configuration for common use cases.
 */
export interface DefaultTemplateConfig {
  /** Category this default template belongs to */
  category: TemplateCategory;

  /** Whether this template can be modified by users */
  editable: boolean;

  /** Default sections included in this template */
  defaultSections: TemplateSectionInput[];
}
