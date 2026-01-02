/**
 * Template Validation Schemas
 *
 * Zod schemas for validating template creation, editing, and structure.
 * Includes validation for Lucide icons, output formats, template sections,
 * section dependencies, and hybrid mode compatibility.
 */

import { z } from 'zod';

/**
 * Common Lucide React Icon Names
 * This is a curated list of commonly used icons. For a complete list,
 * see: https://lucide.dev/icons
 */
const LUCIDE_ICONS = [
  // Common UI icons
  'Mic', 'FileAudio', 'FileText', 'File', 'Files', 'Folder', 'FolderOpen',
  'Download', 'Upload', 'Save', 'Trash', 'Edit', 'Plus', 'Minus', 'X',
  'Check', 'ChevronDown', 'ChevronUp', 'ChevronLeft', 'ChevronRight',
  'Search', 'Settings', 'Menu', 'MoreVertical', 'MoreHorizontal',

  // Meeting & Communication
  'Users', 'User', 'UserPlus', 'MessageSquare', 'MessageCircle',
  'Video', 'Phone', 'Calendar', 'Clock', 'Timer',

  // Analysis & Documents
  'FileCheck', 'FileEdit', 'FilePlus', 'FileSearch', 'FileSignature',
  'Clipboard', 'ClipboardCheck', 'ClipboardList', 'ListChecks',
  'CheckSquare', 'Square', 'Circle', 'Target',

  // Actions & Status
  'PlayCircle', 'PauseCircle', 'StopCircle', 'SkipForward', 'SkipBack',
  'Repeat', 'Shuffle', 'Volume', 'Volume2', 'VolumeX',
  'AlertCircle', 'AlertTriangle', 'Info', 'HelpCircle',
  'CheckCircle', 'XCircle', 'Loader', 'RefreshCw',

  // Categories
  'BookOpen', 'Book', 'Briefcase', 'Flag', 'Star', 'Heart',
  'Tag', 'Tags', 'Hash', 'AtSign', 'Zap', 'TrendingUp',

  // Organization
  'Filter', 'SortAsc', 'SortDesc', 'Layout', 'Grid', 'List',
  'Columns', 'Rows', 'Maximize', 'Minimize', 'Copy', 'Share',
] as const;

/**
 * Output Format Schema
 */
export const outputFormatSchema = z.enum(['bullet_points', 'paragraph', 'table'], {
  message: 'Output format must be one of: bullet_points, paragraph, table',
});

/**
 * Template Category Schema
 */
export const templateCategorySchema = z.enum(['meeting', 'interview', 'review', 'custom'], {
  message: 'Template category must be one of: meeting, interview, review, custom',
});

/**
 * Output Type Schema
 */
export const outputTypeSchema = z.enum(['summary', 'action_items', 'quotes', 'decisions'], {
  message: 'Output type must be one of: summary, action_items, quotes, decisions',
});

/**
 * Lucide Icon Name Schema
 * Validates that the icon name exists in the Lucide library
 */
export const lucideIconSchema = z
  .string()
  .min(1, 'Icon name cannot be empty')
  .refine(
    (iconName) => {
      // Allow any string that matches common icon naming patterns
      // This is more permissive since Lucide has many icons
      return /^[A-Z][a-zA-Z0-9]*$/.test(iconName);
    },
    {
      message: 'Icon name must be in PascalCase (e.g., FileAudio, Users, CheckCircle)',
    }
  )
  .refine(
    (iconName) => {
      // Check against our curated list or allow any PascalCase string
      // This allows for future Lucide icons without updating the schema
      return (LUCIDE_ICONS as readonly string[]).includes(iconName) || /^[A-Z][a-zA-Z0-9]*$/.test(iconName);
    },
    {
      message: `Icon must be in PascalCase format. Common icons: ${LUCIDE_ICONS.slice(0, 10).join(', ')}, etc.`,
    }
  );

/**
 * Template Section ID Schema
 */
const sectionIdSchema = z
  .string()
  .min(1, 'Section ID cannot be empty')
  .regex(
    /^[a-z0-9-_]+$/,
    'Section ID can only contain lowercase letters, numbers, hyphens, and underscores'
  );

/**
 * Template Section Name Schema
 */
const sectionNameSchema = z
  .string()
  .min(1, 'Section name cannot be empty')
  .max(100, 'Section name must be 100 characters or less')
  .trim();

/**
 * Template Section Prompt Schema
 */
const sectionPromptSchema = z
  .string()
  .min(10, 'Section prompt must be at least 10 characters')
  .max(2000, 'Section prompt must be 2000 characters or less')
  .trim();

/**
 * Template Section Schema (with optional dependencies)
 */
export const templateSectionSchema = z.object({
  id: sectionIdSchema,
  name: sectionNameSchema,
  prompt: sectionPromptSchema,
  extractEvidence: z.boolean().default(true),
  outputFormat: outputFormatSchema,
  dependencies: z.array(sectionIdSchema).optional(),
});

/**
 * Template Section Input Schema (before ID is assigned)
 */
export const templateSectionInputSchema = templateSectionSchema.omit({ id: true });

/**
 * Template ID Schema
 */
const templateIdSchema = z
  .string()
  .min(1, 'Template ID cannot be empty')
  .regex(
    /^[a-z0-9-_]+$/,
    'Template ID can only contain lowercase letters, numbers, hyphens, and underscores'
  );

/**
 * Template Name Schema
 */
const templateNameSchema = z
  .string()
  .min(1, 'Template name cannot be empty')
  .max(100, 'Template name must be 100 characters or less')
  .trim();

/**
 * Template Description Schema
 */
const templateDescriptionSchema = z
  .string()
  .min(10, 'Template description must be at least 10 characters')
  .max(500, 'Template description must be 500 characters or less')
  .trim();


// ============================================================================
// DEPENDENCY VALIDATION TYPES AND FUNCTIONS
// ============================================================================

/**
 * Severity levels for validation issues
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * A single validation issue found during template validation
 */
export interface ValidationIssue {
  /** Severity of the issue */
  severity: ValidationSeverity;
  /** Short code identifying the issue type */
  code: string;
  /** Human-readable description of the issue */
  message: string;
  /** ID of the section(s) involved, if applicable */
  sectionIds?: string[];
  /** Additional context about the issue */
  details?: Record<string, unknown>;
}

/**
 * Result of dependency validation
 */
export interface DependencyValidationResult {
  /** Whether the template passes validation (no errors, warnings allowed) */
  valid: boolean;
  /** All issues found during validation */
  issues: ValidationIssue[];
  /** Quick access to error-level issues */
  errors: ValidationIssue[];
  /** Quick access to warning-level issues */
  warnings: ValidationIssue[];
  /** Quick access to info-level issues */
  info: ValidationIssue[];
}

/**
 * Hybrid batch names used by the hybrid analysis strategy
 */
export type HybridBatchName = 'foundation' | 'discussion' | 'action';

/**
 * Keywords that determine hybrid batch assignment
 */
const HYBRID_BATCH_KEYWORDS: Record<HybridBatchName, string[]> = {
  foundation: ['attendee', 'participant', 'agenda', 'summary'],
  discussion: ['discussion', 'decision', 'key point', 'topic'],
  action: ['action', 'next step', 'follow-up', 'follow up'],
};

/**
 * Result of hybrid compatibility analysis
 */
export interface HybridCompatibilityResult {
  /** Whether the template will work well with hybrid mode */
  compatible: boolean;
  /** Assignment of sections to batches */
  batchAssignments: Record<HybridBatchName, string[]>;
  /** Sections that fall to default batch (foundation) */
  defaultBatchSections: string[];
  /** Validation issues related to hybrid compatibility */
  issues: ValidationIssue[];
}

/**
 * Comprehensive template dependency information
 */
export interface TemplateDependencyInfo {
  /** Total number of sections in the template */
  totalSections: number;
  /** Number of sections with dependencies */
  sectionsWithDependencies: number;
  /** Maximum dependency chain depth */
  maxDependencyDepth: number;
  /** Sections that have no dependents (leaf nodes) */
  leafSections: string[];
  /** Sections that have no dependencies (root nodes) */
  rootSections: string[];
  /** Whether the template will benefit from advanced mode */
  benefitsFromAdvancedMode: boolean;
  /** Explanation for the advanced mode recommendation */
  advancedModeRationale: string;
  /** Dependency chains from root to leaf */
  dependencyChains: string[][];
}


/**
 * Validate section dependencies for structural issues
 *
 * Checks for:
 * - Invalid dependency references (pointing to non-existent section IDs)
 * - Circular dependencies between sections
 * - Self-referencing dependencies
 *
 * @param sections - Array of template sections to validate
 * @returns Validation result with all issues found
 *
 * @example
 * ```typescript
 * const sections = [
 *   { id: 'a', name: 'A', dependencies: ['b'] },
 *   { id: 'b', name: 'B', dependencies: ['a'] }, // Circular!
 * ];
 * const result = validateSectionDependencies(sections);
 * // result.valid === false
 * // result.errors contains circular dependency error
 * ```
 */
export function validateSectionDependencies(
  sections: Array<{ id: string; name: string; dependencies?: string[] }>
): DependencyValidationResult {
  const issues: ValidationIssue[] = [];
  const sectionIds = new Set(sections.map((s) => s.id));
  const sectionNameById = new Map(sections.map((s) => [s.id, s.name]));

  // Check each section's dependencies
  for (const section of sections) {
    const deps = section.dependencies || [];

    // Check for self-reference
    if (deps.includes(section.id)) {
      issues.push({
        severity: 'error',
        code: 'SELF_REFERENCE',
        message: `Section "${section.name}" (${section.id}) references itself as a dependency`,
        sectionIds: [section.id],
      });
    }

    // Check for invalid references
    for (const depId of deps) {
      if (!sectionIds.has(depId)) {
        issues.push({
          severity: 'error',
          code: 'INVALID_DEPENDENCY_REFERENCE',
          message: `Section "${section.name}" (${section.id}) depends on non-existent section "${depId}"`,
          sectionIds: [section.id],
          details: { invalidDependencyId: depId },
        });
      }
    }

    // Check for duplicate dependencies
    const uniqueDeps = new Set(deps);
    if (uniqueDeps.size !== deps.length) {
      const duplicates = deps.filter((dep, idx) => deps.indexOf(dep) !== idx);
      const uniqueDuplicates = Array.from(new Set(duplicates));
      issues.push({
        severity: 'warning',
        code: 'DUPLICATE_DEPENDENCY',
        message: `Section "${section.name}" (${section.id}) has duplicate dependencies: ${uniqueDuplicates.join(', ')}`,
        sectionIds: [section.id],
        details: { duplicates: uniqueDuplicates },
      });
    }
  }

  // Check for circular dependencies using DFS
  const circularChains = detectCircularDependencies(sections);
  for (const chain of circularChains) {
    const chainNames = chain.map((id) => sectionNameById.get(id) || id);
    issues.push({
      severity: 'error',
      code: 'CIRCULAR_DEPENDENCY',
      message: `Circular dependency detected: ${chainNames.join(' -> ')} -> ${chainNames[0]}`,
      sectionIds: chain,
      details: { chain },
    });
  }

  // Categorize issues by severity
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const info = issues.filter((i) => i.severity === 'info');

  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
    info,
  };
}


/**
 * Detect circular dependencies using depth-first search
 *
 * @param sections - Array of template sections
 * @returns Array of circular chains (each chain is an array of section IDs)
 */
function detectCircularDependencies(
  sections: Array<{ id: string; dependencies?: string[] }>
): string[][] {
  const adjacencyList = new Map<string, string[]>();
  for (const section of sections) {
    adjacencyList.set(section.id, section.dependencies || []);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const circularChains: string[][] = [];

  function dfs(nodeId: string, path: string[]): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      // Skip invalid references (already caught by other validation)
      if (!adjacencyList.has(neighbor)) {
        continue;
      }

      if (!visited.has(neighbor)) {
        if (dfs(neighbor, [...path, nodeId])) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle - extract the cycle portion
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          circularChains.push(path.slice(cycleStart));
        } else {
          // The cycle includes the current node
          circularChains.push([...path, nodeId].slice(path.indexOf(neighbor) !== -1 ? path.indexOf(neighbor) : 0));
        }
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const section of sections) {
    if (!visited.has(section.id)) {
      dfs(section.id, []);
    }
  }

  // Deduplicate chains (same cycle can be detected from different starting points)
  const uniqueChains: string[][] = [];
  const seenChainSignatures = new Set<string>();

  for (const chain of circularChains) {
    // Normalize the chain by starting from the smallest ID
    const minIdx = chain.indexOf(chain.reduce((a, b) => (a < b ? a : b)));
    const normalized = [...chain.slice(minIdx), ...chain.slice(0, minIdx)];
    const signature = normalized.join('|');

    if (!seenChainSignatures.has(signature)) {
      seenChainSignatures.add(signature);
      uniqueChains.push(chain);
    }
  }

  return uniqueChains;
}


/**
 * Validate section names for hybrid mode compatibility
 *
 * Checks how sections will be assigned to hybrid batches and warns about
 * potential issues like all sections falling into the same batch.
 *
 * @param sections - Array of template sections to validate
 * @returns Hybrid compatibility analysis result
 *
 * @example
 * ```typescript
 * const sections = [
 *   { id: 'custom-1', name: 'Custom Analysis' },
 *   { id: 'custom-2', name: 'Another Custom Section' },
 * ];
 * const result = validateSectionNamesForHybrid(sections);
 * // result.compatible === false (all sections fall to default batch)
 * ```
 */
export function validateSectionNamesForHybrid(
  sections: Array<{ id: string; name: string }>
): HybridCompatibilityResult {
  const issues: ValidationIssue[] = [];
  const batchAssignments: Record<HybridBatchName, string[]> = {
    foundation: [],
    discussion: [],
    action: [],
  };
  const defaultBatchSections: string[] = [];

  // Assign each section to a batch
  for (const section of sections) {
    const nameLower = section.name.toLowerCase();
    let assigned = false;

    // Check each batch's keywords
    for (const [batchName, keywords] of Object.entries(HYBRID_BATCH_KEYWORDS) as [HybridBatchName, string[]][]) {
      if (keywords.some((keyword) => nameLower.includes(keyword))) {
        batchAssignments[batchName].push(section.id);
        assigned = true;
        break;
      }
    }

    // Falls to default (foundation) batch
    if (!assigned) {
      defaultBatchSections.push(section.id);
      batchAssignments.foundation.push(section.id);
    }
  }

  // Calculate batch distribution
  const foundationCount = batchAssignments.foundation.length;
  const discussionCount = batchAssignments.discussion.length;
  const actionCount = batchAssignments.action.length;
  const totalSections = sections.length;

  // Check for issues
  const activeBatches = [foundationCount, discussionCount, actionCount].filter((c) => c > 0).length;

  if (activeBatches === 1) {
    issues.push({
      severity: 'warning',
      code: 'SINGLE_BATCH_TEMPLATE',
      message: 'All sections will be processed in a single batch. Hybrid mode provides no benefit over basic mode for this template.',
      details: {
        foundationCount,
        discussionCount,
        actionCount,
      },
    });
  }

  if (defaultBatchSections.length > 0 && defaultBatchSections.length === totalSections) {
    issues.push({
      severity: 'warning',
      code: 'NO_HYBRID_KEYWORDS',
      message: `No section names match hybrid batch keywords. All ${totalSections} sections will fall to the foundation batch.`,
      sectionIds: defaultBatchSections,
      details: {
        expectedKeywords: HYBRID_BATCH_KEYWORDS,
        sectionNames: sections.map((s) => s.name),
      },
    });
  } else if (defaultBatchSections.length > 0) {
    issues.push({
      severity: 'info',
      code: 'DEFAULT_BATCH_SECTIONS',
      message: `${defaultBatchSections.length} section(s) will fall to the default foundation batch due to non-matching names.`,
      sectionIds: defaultBatchSections,
      details: {
        sectionNames: sections.filter((s) => defaultBatchSections.includes(s.id)).map((s) => s.name),
      },
    });
  }

  // Check for imbalanced batches
  if (activeBatches >= 2) {
    const counts = [foundationCount, discussionCount, actionCount];
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts.filter((c) => c > 0));

    if (maxCount > 3 * minCount && minCount > 0) {
      issues.push({
        severity: 'info',
        code: 'IMBALANCED_BATCHES',
        message: 'Batch sizes are significantly imbalanced, which may result in uneven processing times.',
        details: {
          foundationCount,
          discussionCount,
          actionCount,
        },
      });
    }
  }

  return {
    compatible: activeBatches >= 2,
    batchAssignments,
    defaultBatchSections,
    issues,
  };
}


/**
 * Get comprehensive information about a template's dependency structure
 *
 * Analyzes the template to provide insights about:
 * - Dependency depth and complexity
 * - Root and leaf sections
 * - Whether advanced mode would be beneficial
 *
 * @param template - Template to analyze (needs sections array)
 * @returns Comprehensive dependency information
 *
 * @example
 * ```typescript
 * const template = {
 *   sections: [
 *     { id: 'a', name: 'Agenda', dependencies: [] },
 *     { id: 'b', name: 'Decisions', dependencies: ['a'] },
 *     { id: 'c', name: 'Actions', dependencies: ['b'] },
 *   ],
 * };
 * const info = getTemplateDependencyInfo(template);
 * // info.maxDependencyDepth === 3
 * // info.benefitsFromAdvancedMode === true
 * ```
 */
export function getTemplateDependencyInfo(
  template: { sections: Array<{ id: string; name: string; dependencies?: string[] }> }
): TemplateDependencyInfo {
  const sections = template.sections;
  const sectionIds = new Set(sections.map((s) => s.id));

  // Build adjacency list and reverse adjacency list
  const dependsOn = new Map<string, string[]>();
  const dependedBy = new Map<string, string[]>();

  for (const section of sections) {
    dependsOn.set(section.id, section.dependencies?.filter((d) => sectionIds.has(d)) || []);
    dependedBy.set(section.id, []);
  }

  // Build reverse adjacency
  for (const section of sections) {
    const deps = section.dependencies || [];
    for (const depId of deps) {
      if (sectionIds.has(depId)) {
        dependedBy.get(depId)!.push(section.id);
      }
    }
  }

  // Find root sections (no dependencies)
  const rootSections = sections
    .filter((s) => (dependsOn.get(s.id)?.length || 0) === 0)
    .map((s) => s.id);

  // Find leaf sections (no dependents)
  const leafSections = sections
    .filter((s) => (dependedBy.get(s.id)?.length || 0) === 0)
    .map((s) => s.id);

  // Count sections with dependencies
  const sectionsWithDependencies = sections.filter((s) => (s.dependencies?.length || 0) > 0).length;

  // Calculate max dependency depth using BFS from each root
  let maxDependencyDepth = 0;
  const dependencyChains: string[][] = [];

  function findAllPaths(startId: string, path: string[] = []): void {
    const currentPath = [...path, startId];
    const dependents = dependedBy.get(startId) || [];

    if (dependents.length === 0) {
      // This is a leaf - record the path
      dependencyChains.push(currentPath);
      maxDependencyDepth = Math.max(maxDependencyDepth, currentPath.length);
    } else {
      for (const dependentId of dependents) {
        // Avoid infinite loops from circular deps
        if (!currentPath.includes(dependentId)) {
          findAllPaths(dependentId, currentPath);
        }
      }
    }
  }

  // Start from each root
  for (const rootId of rootSections) {
    findAllPaths(rootId);
  }

  // If no roots (all sections have dependencies, likely circular), start from any
  if (rootSections.length === 0 && sections.length > 0) {
    maxDependencyDepth = 1;
  }

  // Determine if template benefits from advanced mode
  let benefitsFromAdvancedMode = false;
  let advancedModeRationale = '';

  if (sectionsWithDependencies === 0) {
    advancedModeRationale = 'No dependencies defined. Basic or Hybrid mode is recommended.';
  } else if (maxDependencyDepth >= 3) {
    benefitsFromAdvancedMode = true;
    advancedModeRationale = `Deep dependency chain (depth ${maxDependencyDepth}) benefits from sequential contextual analysis.`;
  } else if (sectionsWithDependencies >= 3) {
    benefitsFromAdvancedMode = true;
    advancedModeRationale = `Multiple sections with dependencies (${sectionsWithDependencies}) benefit from relationship mapping.`;
  } else if (sectionsWithDependencies > 0) {
    advancedModeRationale = `Some dependencies exist (${sectionsWithDependencies} sections). Hybrid mode may be sufficient.`;
  }

  // Limit chains to unique paths (avoid explosion for complex templates)
  const uniqueChains = dependencyChains
    .filter((chain, idx, arr) => {
      const signature = chain.join('|');
      return arr.findIndex((c) => c.join('|') === signature) === idx;
    })
    .slice(0, 10); // Limit to 10 chains for readability

  return {
    totalSections: sections.length,
    sectionsWithDependencies,
    maxDependencyDepth,
    leafSections,
    rootSections,
    benefitsFromAdvancedMode,
    advancedModeRationale,
    dependencyChains: uniqueChains,
  };
}


/**
 * Combined validation result for a complete template
 */
export interface TemplateValidationResult {
  /** Whether the template is valid (no blocking errors) */
  valid: boolean;
  /** Dependency validation results */
  dependencyValidation: DependencyValidationResult;
  /** Hybrid mode compatibility results */
  hybridCompatibility: HybridCompatibilityResult;
  /** Template dependency structure info */
  dependencyInfo: TemplateDependencyInfo;
  /** All issues across all validations */
  allIssues: ValidationIssue[];
}

/**
 * Perform comprehensive template validation
 *
 * Runs all validation checks and returns a unified result.
 *
 * @param template - Template to validate
 * @returns Complete validation result
 */
export function validateTemplateComprehensive(
  template: { sections: Array<{ id: string; name: string; dependencies?: string[] }> }
): TemplateValidationResult {
  const dependencyValidation = validateSectionDependencies(template.sections);
  const hybridCompatibility = validateSectionNamesForHybrid(template.sections);
  const dependencyInfo = getTemplateDependencyInfo(template);

  const allIssues = [...dependencyValidation.issues, ...hybridCompatibility.issues];

  return {
    valid: dependencyValidation.valid,
    dependencyValidation,
    hybridCompatibility,
    dependencyInfo,
    allIssues,
  };
}


// ============================================================================
// TEMPLATE SCHEMA WITH DEPENDENCY VALIDATION
// ============================================================================

/**
 * Template Schema with dependency validation
 */
export const templateSchema = z.object({
  id: templateIdSchema,
  name: templateNameSchema,
  description: templateDescriptionSchema,
  icon: lucideIconSchema,
  category: templateCategorySchema,
  sections: z
    .array(templateSectionSchema)
    .min(1, 'Template must have at least one section')
    .max(20, 'Template cannot have more than 20 sections'),
  outputs: z
    .array(outputTypeSchema)
    .min(1, 'Template must have at least one output type')
    .max(4, 'Template cannot have more than 4 output types'),
  isCustom: z.boolean(),
  createdAt: z.date(),
}).superRefine((template, ctx) => {
  // Run dependency validation
  const result = validateSectionDependencies(template.sections);

  // Add errors to Zod context
  for (const error of result.errors) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error.message,
      path: ['sections'],
      params: {
        code: error.code,
        sectionIds: error.sectionIds,
      },
    });
  }

  // Warnings are not added as Zod issues (they don't block validation)
  // They can be accessed via validateTemplateComprehensive()
});

/**
 * Template Input Schema (before ID and createdAt are assigned)
 */
export const templateInputSchema = templateSchema.omit({ id: true, createdAt: true });

/**
 * Template Update Schema (partial with required ID)
 */
export const templateUpdateSchema = templateSchema.partial().required({ id: true });

/**
 * Default Template Configuration Schema
 */
export const defaultTemplateConfigSchema = z.object({
  category: templateCategorySchema,
  editable: z.boolean(),
  defaultSections: z.array(templateSectionInputSchema),
});

/**
 * Type inference from schemas
 */
export type OutputFormat = z.infer<typeof outputFormatSchema>;
export type TemplateCategory = z.infer<typeof templateCategorySchema>;
export type OutputType = z.infer<typeof outputTypeSchema>;
export type TemplateSection = z.infer<typeof templateSectionSchema>;
export type TemplateSectionInput = z.infer<typeof templateSectionInputSchema>;
export type Template = z.infer<typeof templateSchema>;
export type TemplateInput = z.infer<typeof templateInputSchema>;
export type TemplateUpdate = z.infer<typeof templateUpdateSchema>;
export type DefaultTemplateConfig = z.infer<typeof defaultTemplateConfigSchema>;

/**
 * Validate template creation input
 *
 * @param input - Template creation data
 * @returns Validated template input
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * const templateData = {
 *   name: 'Daily Standup',
 *   description: 'Template for daily standup meetings',
 *   icon: 'Users',
 *   category: 'meeting',
 *   sections: [...],
 *   outputs: ['summary', 'action_items'],
 *   isCustom: true,
 * };
 *
 * try {
 *   const validated = validateTemplateInput(templateData);
 *   console.log('Template is valid:', validated);
 * } catch (error) {
 *   console.error('Validation failed:', error);
 * }
 * ```
 */
export function validateTemplateInput(input: unknown): TemplateInput {
  return templateInputSchema.parse(input);
}

/**
 * Validate template section
 *
 * @param section - Template section data
 * @returns Validated section
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * const section = {
 *   id: 'key-points',
 *   name: 'Key Points',
 *   prompt: 'Extract the main discussion points from the meeting',
 *   extractEvidence: true,
 *   outputFormat: 'bullet_points',
 * };
 *
 * const validated = validateTemplateSection(section);
 * ```
 */
export function validateTemplateSection(section: unknown): TemplateSection {
  return templateSectionSchema.parse(section);
}

/**
 * Validate template section input (without ID)
 *
 * @param input - Template section input data
 * @returns Validated section input
 * @throws {z.ZodError} If validation fails
 */
export function validateTemplateSectionInput(input: unknown): TemplateSectionInput {
  return templateSectionInputSchema.parse(input);
}

/**
 * Validate complete template
 *
 * @param template - Complete template data
 * @returns Validated template
 * @throws {z.ZodError} If validation fails
 */
export function validateTemplate(template: unknown): Template {
  return templateSchema.parse(template);
}

/**
 * Validate template update
 *
 * @param update - Template update data
 * @returns Validated update
 * @throws {z.ZodError} If validation fails
 */
export function validateTemplateUpdate(update: unknown): TemplateUpdate {
  return templateUpdateSchema.parse(update);
}

/**
 * Validate output format
 *
 * @param format - Output format string
 * @returns Validated output format
 * @throws {z.ZodError} If validation fails
 */
export function validateOutputFormat(format: unknown): OutputFormat {
  return outputFormatSchema.parse(format);
}

/**
 * Validate template category
 *
 * @param category - Category string
 * @returns Validated category
 * @throws {z.ZodError} If validation fails
 */
export function validateTemplateCategory(category: unknown): TemplateCategory {
  return templateCategorySchema.parse(category);
}

/**
 * Validate output type
 *
 * @param type - Output type string
 * @returns Validated output type
 * @throws {z.ZodError} If validation fails
 */
export function validateOutputType(type: unknown): OutputType {
  return outputTypeSchema.parse(type);
}

/**
 * Validate Lucide icon name
 *
 * @param iconName - Icon name to validate
 * @returns Validated icon name
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * try {
 *   const icon = validateLucideIcon('FileAudio');
 *   console.log('Valid icon:', icon);
 * } catch (error) {
 *   console.error('Invalid icon name');
 * }
 * ```
 */
export function validateLucideIcon(iconName: unknown): string {
  return lucideIconSchema.parse(iconName);
}

/**
 * Safe validation that returns success/error result instead of throwing
 *
 * @param input - Template input to validate
 * @returns Result object with success flag and data or error
 *
 * @example
 * ```typescript
 * const result = safeValidateTemplateInput(templateData);
 * if (result.success) {
 *   console.log('Valid template:', result.data);
 * } else {
 *   console.error('Validation errors:', result.error.format());
 * }
 * ```
 */
export function safeValidateTemplateInput(
  input: unknown
): { success: true; data: TemplateInput } | { success: false; error: z.ZodError } {
  const result = templateInputSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Safe validation for template sections
 *
 * @param section - Section to validate
 * @returns Result object with success flag and data or error
 */
export function safeValidateTemplateSection(
  section: unknown
): { success: true; data: TemplateSection } | { success: false; error: z.ZodError } {
  const result = templateSectionSchema.safeParse(section);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Get list of common Lucide icon names
 *
 * @returns Array of common icon names
 */
export function getCommonLucideIcons(): readonly string[] {
  return LUCIDE_ICONS;
}

/**
 * Check if a string is a valid output format (type guard)
 *
 * @param value - Value to check
 * @returns True if valid output format
 */
export function isOutputFormat(value: unknown): value is OutputFormat {
  return outputFormatSchema.safeParse(value).success;
}

/**
 * Check if a string is a valid template category (type guard)
 *
 * @param value - Value to check
 * @returns True if valid template category
 */
export function isTemplateCategory(value: unknown): value is TemplateCategory {
  return templateCategorySchema.safeParse(value).success;
}

/**
 * Check if a string is a valid output type (type guard)
 *
 * @param value - Value to check
 * @returns True if valid output type
 */
export function isOutputType(value: unknown): value is OutputType {
  return outputTypeSchema.safeParse(value).success;
}


// ============================================================================
// UTILITY EXPORTS FOR TEMPLATE EDITOR UI
// ============================================================================

/**
 * Get hybrid batch keywords for UI display
 *
 * @returns Object mapping batch names to their trigger keywords
 */
export function getHybridBatchKeywords(): Record<HybridBatchName, string[]> {
  return { ...HYBRID_BATCH_KEYWORDS };
}

/**
 * Determine which hybrid batch a section name would fall into
 *
 * @param sectionName - Name of the section
 * @returns The batch name or 'foundation' as default
 */
export function determineSectionHybridBatch(sectionName: string): HybridBatchName {
  const nameLower = sectionName.toLowerCase();

  for (const [batchName, keywords] of Object.entries(HYBRID_BATCH_KEYWORDS) as [HybridBatchName, string[]][]) {
    if (keywords.some((keyword) => nameLower.includes(keyword))) {
      return batchName;
    }
  }

  return 'foundation'; // Default
}

/**
 * Get suggested section names for a specific hybrid batch
 *
 * @param batch - The hybrid batch name
 * @returns Array of suggested section names for that batch
 */
export function getSuggestedSectionNames(batch: HybridBatchName): string[] {
  const suggestions: Record<HybridBatchName, string[]> = {
    foundation: [
      'Meeting Summary',
      'Attendees',
      'Participants',
      'Agenda Items',
      'Meeting Agenda',
    ],
    discussion: [
      'Key Discussions',
      'Decisions Made',
      'Key Points',
      'Discussion Topics',
      'Main Topics',
    ],
    action: [
      'Action Items',
      'Next Steps',
      'Follow-up Items',
      'Tasks Assigned',
      'Follow-up Actions',
    ],
  };

  return suggestions[batch];
}

/**
 * Check if a template has any dependency-related issues
 *
 * Quick check for template editor to show warning badge
 *
 * @param template - Template to check
 * @returns True if there are any dependency errors
 */
export function hasTemplateDependencyErrors(
  template: { sections: Array<{ id: string; dependencies?: string[] }> }
): boolean {
  const result = validateSectionDependencies(
    template.sections.map((s) => ({ id: s.id, name: s.id, dependencies: s.dependencies }))
  );
  return !result.valid;
}

/**
 * Get a human-readable summary of template's analysis mode compatibility
 *
 * @param template - Template to analyze
 * @returns Summary string describing recommended mode
 */
export function getTemplateAnalysisModeRecommendation(
  template: { sections: Array<{ id: string; name: string; dependencies?: string[] }> }
): string {
  const depInfo = getTemplateDependencyInfo(template);
  const hybridCompat = validateSectionNamesForHybrid(template.sections);

  if (depInfo.benefitsFromAdvancedMode) {
    return `Advanced mode recommended: ${depInfo.advancedModeRationale}`;
  }

  if (hybridCompat.compatible) {
    const batchCounts = Object.entries(hybridCompat.batchAssignments)
      .filter(([, ids]) => ids.length > 0)
      .map(([batch, ids]) => `${batch}: ${ids.length}`)
      .join(', ');
    return `Hybrid mode compatible (${batchCounts})`;
  }

  return 'Basic mode recommended: Simple template structure';
}
