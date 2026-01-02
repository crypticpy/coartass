/**
 * User-Defined Template Categories
 *
 * Utilities for managing user-defined template categories stored in localStorage.
 * Allows users to create custom categories and assign templates to them, with
 * fallback to the built-in template-categories.ts system.
 */

import { getTemplateCategory } from './template-categories';

/**
 * localStorage key for user category settings
 */
const STORAGE_KEY = 'meeting-transcriber-user-categories';

/**
 * User category settings interface
 */
export interface UserCategorySettings {
  /** Custom category names defined by the user (e.g., ['Agile', 'Executive', 'Process']) */
  customCategories: string[];
  /** Mapping of template IDs to user-assigned category names */
  templateAssignments: Record<string, string>;
}

/**
 * Default settings when none exist
 */
const DEFAULT_SETTINGS: UserCategorySettings = {
  customCategories: [],
  templateAssignments: {},
};

/**
 * Check if we're in a browser environment (SSR-safe)
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get user category settings from localStorage
 *
 * @returns User category settings, or defaults if not set or in SSR
 */
export function getUserCategorySettings(): UserCategorySettings {
  if (!isBrowser()) {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(stored);

    // Validate the structure
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray(parsed.customCategories) &&
      typeof parsed.templateAssignments === 'object' &&
      parsed.templateAssignments !== null
    ) {
      return parsed as UserCategorySettings;
    }

    // Invalid structure, return defaults
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error reading user category settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save user category settings to localStorage
 *
 * @param settings - The settings to save
 */
export function saveUserCategorySettings(settings: UserCategorySettings): void {
  if (!isBrowser()) {
    console.warn('Cannot save user category settings: not in browser environment');
    return;
  }

  try {
    const json = JSON.stringify(settings);
    localStorage.setItem(STORAGE_KEY, json);
  } catch (error) {
    console.error('Error saving user category settings:', error);
  }
}

/**
 * Reset user category settings (clear localStorage entry)
 */
export function resetUserCategorySettings(): void {
  if (!isBrowser()) {
    console.warn('Cannot reset user category settings: not in browser environment');
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error resetting user category settings:', error);
  }
}

/**
 * Get the effective category for a template
 *
 * Returns the user-assigned category if one exists, otherwise falls back to
 * the built-in category from template-categories.ts
 *
 * @param templateId - The template ID to look up
 * @param templateName - The template name (used for fallback lookup)
 * @returns The effective category name
 */
export function getEffectiveCategory(
  templateId: string,
  templateName: string
): string {
  const settings = getUserCategorySettings();

  // Check if user has assigned a custom category
  const userCategory = settings.templateAssignments[templateId];
  if (userCategory) {
    return userCategory;
  }

  // Fall back to built-in category
  return getTemplateCategory(templateName);
}
