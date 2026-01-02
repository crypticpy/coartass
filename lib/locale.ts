/**
 * Locale Management Utilities
 *
 * Manages user language preference in localStorage
 * (No user accounts - settings stored locally in browser)
 */

import { defaultLocale, locales, type Locale } from '@/i18n/config';

const LOCALE_STORAGE_KEY = 'preferred-locale';

/**
 * Get the user's preferred locale from localStorage
 * Falls back to browser language, then default locale
 */
export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') {
    return defaultLocale;
  }

  // Check localStorage first
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && locales.includes(stored as Locale)) {
    return stored as Locale;
  }

  // Check browser language
  const browserLang = navigator.language.split('-')[0];
  if (locales.includes(browserLang as Locale)) {
    return browserLang as Locale;
  }

  return defaultLocale;
}

/**
 * Save the user's preferred locale to localStorage
 */
export function setStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

/**
 * Clear the stored locale preference
 */
export function clearStoredLocale(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(LOCALE_STORAGE_KEY);
}
