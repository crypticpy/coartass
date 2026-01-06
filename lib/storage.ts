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
  ANALYSIS_MODEL: 'analysis_model_preference',
  REASONING_EFFORT: 'analysis_reasoning_effort',
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
 * Analysis model preference type
 */
export type AnalysisModel = 'gpt-5' | 'gpt-5.2';

/**
 * Reasoning effort type
 */
export type ReasoningEffort = 'low' | 'medium' | 'high';

/**
 * Get analysis model preference from localStorage
 */
export function getAnalysisModelPreference(): AnalysisModel {
  if (typeof window === 'undefined') return 'gpt-5';
  const model = localStorage.getItem(STORAGE_KEYS.ANALYSIS_MODEL);
  if (model === 'gpt-5' || model === 'gpt-5.2') return model;
  return 'gpt-5'; // Default
}

/**
 * Set analysis model preference in localStorage
 */
export function setAnalysisModelPreference(model: AnalysisModel): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ANALYSIS_MODEL, model);
}

/**
 * Get reasoning effort preference from localStorage
 */
export function getReasoningEffortPreference(): ReasoningEffort {
  if (typeof window === 'undefined') return 'medium';
  const effort = localStorage.getItem(STORAGE_KEYS.REASONING_EFFORT);
  if (effort === 'low' || effort === 'medium' || effort === 'high') return effort;
  return 'medium'; // Default
}

/**
 * Set reasoning effort preference in localStorage
 */
export function setReasoningEffortPreference(effort: ReasoningEffort): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.REASONING_EFFORT, effort);
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
    analysisModel: getAnalysisModelPreference(),
    reasoningEffort: getReasoningEffortPreference(),
  };
}
