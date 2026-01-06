/**
 * Mantine Theme Configuration for Austin RTASS
 *
 * Defines the application's color palette and design system
 * with full support for light and dark modes.
 *
 * To customize branding for your organization, see BRANDING.md
 */

import { createTheme, MantineColorsTuple } from '@mantine/core';

/**
 * Brand Colors
 * Primary color palette - customize these for your organization's branding
 */
const aphBlue: MantineColorsTuple = [
  '#EEF0FB',  // lightest
  '#D5D9F4',
  '#BBC2ED',
  '#A1AAE6',
  '#8893DF',
  '#6E7CD8',
  '#44499C',  // DEFAULT - Logo Blue
  '#3A3D83',
  '#2F316A',
  '#22254E',  // darkest - Dark Blue
];

const aphGreen: MantineColorsTuple = [
  '#E6F7EF',  // lightest
  '#C2EDD7',
  '#9FE3BF',
  '#7BD9A7',
  '#58CF8F',
  '#34C577',
  '#009F4D',  // DEFAULT - Logo Green
  '#008743',  // Compliant Green
  '#006F38',
  '#005027',  // darkest - Dark Green
];

const aphRed: MantineColorsTuple = [
  '#FEE9E8',
  '#FDC8C4',
  '#FBA8A1',
  '#FA877D',
  '#F8665A',
  '#F74636',
  '#F83125',  // DEFAULT
  '#D72A1F',
  '#B6231A',
  '#951D15',
];

const aphOrange: MantineColorsTuple = [
  '#FFF4E6',
  '#FFE4C2',
  '#FFD59E',
  '#FFC57A',
  '#FFB556',
  '#FFA632',
  '#FF8F00',  // DEFAULT
  '#DB7A00',
  '#B76500',
  '#935000',
];

const aphYellow: MantineColorsTuple = [
  '#FFF9E6',
  '#FFF1C2',
  '#FFE99E',
  '#FFE17A',
  '#FFD956',
  '#FFD132',
  '#FFC600',  // DEFAULT
  '#DBA900',
  '#B78D00',
  '#937100',
];

const aphCyan: MantineColorsTuple = [
  '#E6F6FC',
  '#C2E9F7',
  '#9EDCF2',
  '#7ACFED',
  '#56C2E8',
  '#32B5E3',
  '#009CDE',  // DEFAULT
  '#0084BC',
  '#006D9A',
  '#005678',
];

const aphPurple: MantineColorsTuple = [
  '#F4EBFA',
  '#E4CDF2',
  '#D4AFEA',
  '#C491E2',
  '#B473DA',
  '#A455D2',
  '#9F3CC9',  // DEFAULT
  '#8833AB',
  '#712A8D',
  '#5A216F',
];

/**
 * Neutral Colors
 */
const aphGray: MantineColorsTuple = [
  '#F7F6F5',  // Faded White
  '#E8E7E6',
  '#D9D8D7',
  '#CAC9C8',
  '#C6C5C4',  // Light Gray
  '#B7B6B5',
  '#A8A7A6',
  '#999897',
  '#8A8988',
  '#636262',  // Dark Gray
];

/**
 * Main Mantine Theme
 */
export const mantineTheme = createTheme({
  // Primary brand color - change this to customize your theme
  primaryColor: 'aphBlue',
  primaryShade: 6,

  // Color palette
  colors: {
    aphBlue,
    aphGreen,
    aphRed,
    aphOrange,
    aphYellow,
    aphCyan,
    aphPurple,
    aphGray,
  },

  // Font family - Geist (loaded via Next.js)
  fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace: 'var(--font-geist-mono), "Courier New", Courier, monospace',
  headings: {
    fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '2.5rem', lineHeight: '1.1' },
      h2: { fontSize: '2rem', lineHeight: '1.2' },
      h3: { fontSize: '1.5rem', lineHeight: '1.3' },
      h4: { fontSize: '1.25rem', lineHeight: '1.4' },
      h5: { fontSize: '1.125rem', lineHeight: '1.4' },
      h6: { fontSize: '1rem', lineHeight: '1.5' },
    },
  },

  // Spacing scale
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },

  // Border radius
  radius: {
    xs: '0.25rem',
    sm: 'calc(0.5rem - 4px)',
    md: 'calc(0.5rem - 2px)',
    lg: '0.5rem',
    xl: '0.75rem',
  },

  // Default radius for components
  defaultRadius: 'md',

  // Breakpoints (matching PostCSS config)
  breakpoints: {
    xs: '36em',
    sm: '48em',
    md: '62em',
    lg: '75em',
    xl: '88em',
  },

  // Component-specific overrides
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 500,
          transition: 'all 0.15s ease',
          '&:active': {
            transform: 'scale(0.98)',
          },
        },
      },
    },

    Card: {
      defaultProps: {
        radius: 'lg',
        shadow: 'sm',
        withBorder: true,
      },
      styles: {
        root: {
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 10px 25px -5px rgba(68, 73, 156, 0.1), 0 8px 10px -6px rgba(68, 73, 156, 0.1)',
          },
        },
      },
    },

    Input: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        input: {
          transition: 'border-color 0.15s ease',
          '&:focus': {
            borderWidth: '2px',
          },
        },
      },
    },

    Badge: {
      defaultProps: {
        radius: 'md',
      },
    },

    Alert: {
      defaultProps: {
        radius: 'lg',
      },
    },

    Modal: {
      defaultProps: {
        radius: 'lg',
        centered: true,
      },
    },

    Tabs: {
      defaultProps: {
        radius: 'md',
      },
    },

    Accordion: {
      defaultProps: {
        radius: 'md',
      },
    },
  },

  // Other theme settings
  other: {
    // Custom utility values
    containerMaxWidth: '1280px',
    headerHeight: '64px',

    // Brand-specific colors (customize for your organization)
    aphBrandColors: {
      logoBlue: '#44499C',
      logoGreen: '#009F4D',
      darkBlue: '#22254E',
      darkGreen: '#005027',
      lightBlue: '#dcf2fd',
      lightGreen: '#dff0e3',
      fadedWhite: '#f7f6f5',
      compliantGreen: '#008743',
    },

    // Semantic colors
    semantic: {
      success: '#009F4D',
      error: '#F83125',
      warning: '#FF8F00',
      info: '#009CDE',
    },

    // Animations
    animations: {
      fadeIn: 'fade-in 0.3s ease-out',
      fadeInUp: 'fade-in-up 0.4s ease-out',
      slideInRight: 'slide-in-right 0.3s ease-out',
    },
  },
});

/**
 * Color scheme configuration for light/dark mode
 */
export const colorSchemeConfig = {
  defaultColorScheme: 'auto' as const,
  storageKey: 'mantine-color-scheme',
};
