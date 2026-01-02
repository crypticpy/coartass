'use client';

import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import type { PropsWithChildren } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { IntlProvider } from '@/components/providers/intl-provider';
import { TemplateSeeder } from '@/components/providers/template-seeder';
import { mantineTheme } from '@/lib/mantine-theme';
import { TourProvider, TourHighlight, TourModal } from '@/components/docs/tour';
import { allTours } from '@/lib/tours';

export function Providers({ children }: PropsWithChildren) {
  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme="auto">
      <ModalsProvider>
        <IntlProvider>
          <ThemeProvider>
            <TourProvider tours={allTours}>
              <TemplateSeeder />
              {children}
              <TourHighlight />
              <TourModal />
            </TourProvider>
          </ThemeProvider>
        </IntlProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}
