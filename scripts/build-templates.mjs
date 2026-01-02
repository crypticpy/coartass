#!/usr/bin/env node
/**
 * Template Build Script
 *
 * Aggregates individual YAML template files into a TypeScript module.
 * This script is run at build time to generate lib/generated/templates.ts
 *
 * Features:
 * - Validates template structure
 * - Generates content hashes for change detection
 * - Computes bundle version for quick sync checks
 * - Supports automatic template synchronization
 *
 * Usage: node scripts/build-templates.mjs
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, '../data/templates');
const OUTPUT_FILE = path.join(__dirname, '../lib/generated/templates.ts');
const CATEGORIES = ['meeting', 'interview', 'review'];

/**
 * Current template schema version.
 * Increment this when adding new fields or making breaking changes.
 * Templates with older schema versions will be force-updated.
 *
 * Version history:
 * - 1: Added supportsSupplementalMaterial, schemaVersion, bundleCreatedAt
 */
const CURRENT_SCHEMA_VERSION = 1;

/**
 * Bundle creation date - used for versioning
 */
const BUNDLE_CREATED_AT = new Date().toISOString();

/**
 * Stable stringify for hashing.
 * Sorts object keys recursively while preserving array order.
 */
function stableStringify(value) {
  function sortKeysDeep(input) {
    if (Array.isArray(input)) {
      return input.map(sortKeysDeep);
    }
    if (input && typeof input === 'object') {
      const obj = input;
      const sorted = {};
      for (const key of Object.keys(obj).sort()) {
        sorted[key] = sortKeysDeep(obj[key]);
      }
      return sorted;
    }
    return input;
  }

  return JSON.stringify(sortKeysDeep(value));
}

/**
 * Compute a stable content hash for a template.
 * Only includes fields that define the template's behavior.
 * Ignores id, createdAt, and other runtime fields.
 */
function computeContentHash(template) {
  // Create a normalized object with only the fields that matter for content
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

  // Create stable JSON (sorted keys) and hash it
  const stableJson = stableStringify(contentForHash);
  return crypto.createHash('sha256').update(stableJson).digest('hex').substring(0, 16);
}

/**
 * Recursively find all YAML files in a directory
 */
function findYamlFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findYamlFiles(fullPath));
    } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Validate a template object against expected structure
 */
function validateTemplate(template, filePath) {
  const errors = [];

  if (!template.name) errors.push('Missing required field: name');
  if (!template.description) errors.push('Missing required field: description');
  if (!template.icon) errors.push('Missing required field: icon');
  if (!template.category) errors.push('Missing required field: category');
  if (!CATEGORIES.includes(template.category)) {
    errors.push(`Invalid category: ${template.category}. Must be one of: ${CATEGORIES.join(', ')}`);
  }
  if (!Array.isArray(template.outputs) || template.outputs.length === 0) {
    errors.push('outputs must be a non-empty array');
  }
  if (!Array.isArray(template.sections) || template.sections.length === 0) {
    errors.push('sections must be a non-empty array');
  }

  // Validate sections
  if (template.sections) {
    const sectionIds = new Set();
    for (let i = 0; i < template.sections.length; i++) {
      const section = template.sections[i];
      const prefix = `sections[${i}]`;

      if (!section.id) errors.push(`${prefix}: Missing required field: id`);
      if (!section.name) errors.push(`${prefix}: Missing required field: name`);
      if (!section.prompt) errors.push(`${prefix}: Missing required field: prompt`);
      if (typeof section.extractEvidence !== 'boolean') {
        errors.push(`${prefix}: extractEvidence must be a boolean`);
      }
      if (!['bullet_points', 'paragraph', 'table'].includes(section.outputFormat)) {
        errors.push(`${prefix}: Invalid outputFormat: ${section.outputFormat}`);
      }

      if (section.id) {
        if (sectionIds.has(section.id)) {
          errors.push(`${prefix}: Duplicate section id: ${section.id}`);
        }
        sectionIds.add(section.id);
      }

      // Validate dependencies reference valid section ids
      if (section.dependencies) {
        for (const dep of section.dependencies) {
          if (!sectionIds.has(dep) && !template.sections.some(s => s.id === dep)) {
            errors.push(`${prefix}: Dependency "${dep}" references non-existent section`);
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation errors in ${filePath}:\n  - ${errors.join('\n  - ')}`);
  }
}

/**
 * Generate TypeScript code for a template
 */
function templateToTypeScript(template, contentHash) {
  const sections = template.sections.map(section => {
    const deps = section.dependencies
      ? `\n      dependencies: ${JSON.stringify(section.dependencies)},`
      : '';

    // Escape backticks and ${} in prompts for template literal safety
    const escapedPrompt = section.prompt
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${');

    return `    {
      id: '${section.id}',
      name: '${section.name.replace(/'/g, "\\'")}',
      prompt: \`${escapedPrompt}\`,
      extractEvidence: ${section.extractEvidence},
      outputFormat: '${section.outputFormat}',${deps}
    }`;
  });

  // Escape single quotes in name and description
  const escapedName = template.name.replace(/'/g, "\\'");
  const escapedDesc = template.description.replace(/'/g, "\\'");

  // Build optional fields
  const supplementalFlag = template.supportsSupplementalMaterial
    ? `\n    supportsSupplementalMaterial: true,`
    : '';

  return `  {
    name: '${escapedName}',
    description: '${escapedDesc}',
    icon: '${template.icon}',
    category: '${template.category}',
    isCustom: false,${supplementalFlag}
    schemaVersion: ${CURRENT_SCHEMA_VERSION},
    bundleCreatedAt: new Date('${BUNDLE_CREATED_AT}'),
    contentHash: '${contentHash}',
    outputs: ${JSON.stringify(template.outputs)},
    sections: [
${sections.join(',\n')}
    ]
  }`;
}

/**
 * Main build function
 */
function buildTemplates() {
  console.log('Building templates from YAML files...\n');

  const templates = [];
  let errorCount = 0;

  for (const category of CATEGORIES) {
    const categoryDir = path.join(TEMPLATES_DIR, category);
    if (!fs.existsSync(categoryDir)) {
      console.warn(`Warning: Category directory not found: ${category}`);
      continue;
    }

    const yamlFiles = findYamlFiles(categoryDir);
    console.log(`${category}/: ${yamlFiles.length} templates`);

    for (const filePath of yamlFiles) {
      const relativePath = path.relative(TEMPLATES_DIR, filePath);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const template = yaml.load(content);

        // Remove $schema field if present (not needed in output)
        delete template.$schema;

        validateTemplate(template, relativePath);

        // Compute content hash for change detection
        const contentHash = computeContentHash(template);

        templates.push({ template, relativePath, contentHash });
      } catch (err) {
        console.error(`\nError processing ${relativePath}:`);
        console.error(`  ${err.message}`);
        errorCount++;
      }
    }
  }

  if (errorCount > 0) {
    console.error(`\nBuild failed with ${errorCount} error(s)`);
    process.exit(1);
  }

  console.log(`\nTotal: ${templates.length} templates`);

  // Sort templates by name for consistent output
  templates.sort((a, b) => a.template.name.localeCompare(b.template.name));

  // Compute bundle version from all content hashes
  // This creates a single version that changes when ANY template changes
  const allHashes = templates.map(t => t.contentHash).sort().join('');
  const bundleVersion = crypto.createHash('sha256').update(allHashes).digest('hex').substring(0, 12);

  console.log(`Bundle version: ${bundleVersion}`);

  // Generate TypeScript output
  const templateCode = templates.map(t => templateToTypeScript(t.template, t.contentHash)).join(',\n\n');

  const output = `/**
 * Generated Template Definitions
 *
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT DIRECTLY
 * Edit the source YAML files in data/templates/ instead.
 *
 * Generated by: scripts/build-templates.mjs
 * Generated at: ${new Date().toISOString()}
 * Template count: ${templates.length}
 * Bundle version: ${bundleVersion}
 */

import type { Template } from '@/types/template';

/**
 * Template input type (before ID and timestamp are assigned)
 * Includes contentHash for sync/change detection
 */
export type TemplateInput = Omit<Template, 'id' | 'createdAt'>;

/**
 * Bundle version - changes when ANY template content changes.
 * Used for quick "anything changed?" check before detailed sync.
 */
export const TEMPLATE_BUNDLE_VERSION = '${bundleVersion}';

/**
 * Current schema version for template structure.
 * Templates with older schema versions will be force-updated.
 */
export const CURRENT_SCHEMA_VERSION = ${CURRENT_SCHEMA_VERSION};

/**
 * Built-in templates loaded from YAML files.
 * These are synchronized to IndexedDB on app load.
 * Each template includes a contentHash for change detection.
 */
export const BUILT_IN_TEMPLATES: TemplateInput[] = [
${templateCode}
];

/**
 * Get the count of built-in templates
 */
export const BUILT_IN_TEMPLATE_COUNT = ${templates.length};

/**
 * Get template names grouped by category
 */
export const TEMPLATE_NAMES_BY_CATEGORY = {
  meeting: ${JSON.stringify(templates.filter(t => t.template.category === 'meeting').map(t => t.template.name), null, 2).replace(/\n/g, '\n  ')},
  interview: ${JSON.stringify(templates.filter(t => t.template.category === 'interview').map(t => t.template.name), null, 2).replace(/\n/g, '\n  ')},
  review: ${JSON.stringify(templates.filter(t => t.template.category === 'review').map(t => t.template.name), null, 2).replace(/\n/g, '\n  ')}
} as const;
`;

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`\nGenerated: ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log('Build complete!');
}

buildTemplates();
