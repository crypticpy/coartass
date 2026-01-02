/**
 * Type-safe localStorage wrapper for application user preferences
 * Provides getter/setter functions for non-sensitive user settings only
 *
 * SECURITY NOTE: This module NO LONGER stores API keys or sensitive credentials.
 * All API configuration is now managed via server-side environment variables.
 */

/**
 * Storage keys for user preferences (non-sensitive only)
 */
const STORAGE_KEYS = {
  THEME: 'user_theme_preference',
} as const;

/**
 * Theme preference type
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Get user theme preference from localStorage
 */
export function getThemePreference(): Theme | null {
  if (typeof window === 'undefined') return null;
  const theme = localStorage.getItem(STORAGE_KEYS.THEME);
  return theme as Theme | null;
}

/**
 * Set user theme preference in localStorage
 */
export function setThemePreference(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

/**
 * Clear all user preferences from localStorage
 * NOTE: This does NOT clear API keys (they are no longer stored client-side)
 */
export function clearAllPreferences(): void {
  if (typeof window === 'undefined') return;
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}

/**
 * Get all user preferences as an object
 */
export function getAllPreferences() {
  return {
    theme: getThemePreference(),
  };
}
