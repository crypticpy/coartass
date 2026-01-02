/**
 * Internationalization Provider
 *
 * Provides translations to the app based on user's locale preference
 * Locale is stored in localStorage (no user accounts)
 *
 * FIXED: Removed async loading to prevent loading screen issues
 */

"use client";

import * as React from "react";
import { NextIntlClientProvider } from "next-intl";
import { getStoredLocale } from "@/lib/locale";
import type { Locale } from "@/i18n/config";

// Import messages directly (no dynamic import)
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

const messagesMap = {
  en: enMessages,
  es: esMessages,
};

interface IntlProviderProps {
  children: React.ReactNode;
}

/**
 * Client-side internationalization provider
 * Loads messages synchronously based on stored locale preference
 */
export function IntlProvider({ children }: IntlProviderProps) {
  const [locale, setLocale] = React.useState<Locale>("en");
  const [isClient, setIsClient] = React.useState(false);

  // Load locale from storage on mount (client-side only)
  React.useEffect(() => {
    const storedLocale = getStoredLocale();
    setLocale(storedLocale);
    setIsClient(true);
  }, []);

  // During server render and initial client render, use default locale
  if (!isClient) {
    return (
      <NextIntlClientProvider locale="en" messages={enMessages} timeZone="America/Chicago">
        {children}
      </NextIntlClientProvider>
    );
  }

  // After hydration, use stored locale
  const messages = messagesMap[locale] || enMessages;

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="America/Chicago">
      {children}
    </NextIntlClientProvider>
  );
}
