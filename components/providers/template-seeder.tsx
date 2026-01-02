"use client";

/**
 * Template Seeder Component
 *
 * Handles automatic seeding of built-in templates on first app load.
 * This component runs once when the app initializes and ensures default
 * templates are available in IndexedDB.
 */

import { useEffect, useRef, useState } from 'react';
import { seedDefaultTemplates } from '@/lib/template-seeding';

/**
 * Client-side component that seeds default templates on mount.
 *
 * This component:
 * - Runs only on the client side (after hydration)
 * - Seeds templates only once (checked via localStorage)
 * - Handles errors gracefully without disrupting the app
 * - Provides no UI (invisible component)
 */
export function TemplateSeeder() {
  const hasSeededRef = useRef(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function performSeeding() {
      // Skip if already seeded or browser doesn't support IndexedDB
      if (hasSeededRef.current || typeof window === 'undefined') return;

      hasSeededRef.current = true;

      try {
        await seedDefaultTemplates();
        if (mounted) {
          console.log('Template seeding completed successfully');
        }
      } catch (err) {
        if (mounted) {
          const error = err instanceof Error ? err : new Error('Unknown error during template seeding');
          setError(error);
          console.error('Template seeding failed:', error);
        }
      }
    }

    performSeeding();

    return () => {
      mounted = false;
    };
  }, []); // Run once on mount

  // Log error for debugging but don't render anything
  if (error) {
    console.error('Template seeding error:', error);
  }

  // This component doesn't render anything
  return null;
}
