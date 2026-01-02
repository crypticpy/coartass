/**
 * Template Category Mapping - Shared Constants
 *
 * Centralized category definitions for template organization across
 * both the templates page and analyze page. Uses the generated template
 * data as the source of truth.
 */

import { TEMPLATE_NAMES_BY_CATEGORY } from './generated/templates';

/**
 * Template category type definition
 */
export type TemplateCategory = 'meeting' | 'interview' | 'review' | 'custom';

/**
 * Built-in template categories with their associated template names.
 * This is derived from the generated template data.
 */
export const TEMPLATE_CATEGORIES = TEMPLATE_NAMES_BY_CATEGORY;

/**
 * Get the category for a template based on its name
 *
 * @param templateName - The name of the template
 * @param defaultCategory - Default category to return if not found (default: 'custom')
 * @returns The template category
 */
export function getTemplateCategory(
  templateName: string,
  defaultCategory: TemplateCategory = 'custom'
): TemplateCategory {
  for (const [category, names] of Object.entries(TEMPLATE_CATEGORIES)) {
    if ((names as readonly string[]).includes(templateName)) {
      return category as 'meeting' | 'interview' | 'review';
    }
  }
  return defaultCategory;
}
