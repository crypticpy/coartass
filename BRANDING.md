# Branding Guide

This guide explains how to customize the Austin RTASS application for your organization. You can change the logo, colors, application name, and more without modifying the core application code.

## Table of Contents

- [Quick Overview](#quick-overview)
- [Logo Replacement](#logo-replacement)
- [Color Scheme](#color-scheme)
- [Application Name](#application-name)
- [Typography](#typography)
- [Testing Your Changes](#testing-your-changes)

## Quick Overview

The main customization points are:

| What | Where | Difficulty |
|------|-------|------------|
| Logo | `public/images/` | Easy |
| Favicon | `public/` | Easy |
| App name | `app/layout.tsx`, `public/site.webmanifest` | Easy |
| Colors | `lib/mantine-theme.ts` | Medium |
| Fonts | `app/layout.tsx` | Medium |

## Logo Replacement

### Logo Files

Replace these files in the `public/images/` directory:

| File | Size | Purpose |
|------|------|---------|
| `coa-logo.png` | 200×60px | Main header logo (light mode) |
| `coa-logo.webp` | 200×60px | Main header logo (WebP version) |
| `coa-icon.png` | 64×64px | Square icon version |
| `coa-icon.webp` | 64×64px | Square icon (WebP version) |

**Tips:**
- Keep aspect ratios similar to avoid layout issues
- Provide both PNG and WebP formats for browser compatibility
- Use transparent backgrounds
- For best results, provide 2x resolution images (400×120px for logo)

### Favicon Files

Replace these files in the `public/` directory:

| File | Size | Purpose |
|------|------|---------|
| `favicon.ico` | 32×32px | Browser tab icon |
| `favicon-16x16.png` | 16×16px | Small favicon |
| `favicon-32x32.png` | 32×32px | Standard favicon |
| `apple-touch-icon.png` | 180×180px | iOS home screen |
| `android-chrome-192x192.png` | 192×192px | Android home screen |
| `android-chrome-512x512.png` | 512×512px | Android splash screen |

**Generating Favicons:**

You can use online tools like [favicon.io](https://favicon.io/) or [RealFaviconGenerator](https://realfavicongenerator.net/) to generate all required sizes from a single source image.

## Color Scheme

### Overview

Colors are defined in `lib/mantine-theme.ts`. The application uses a custom color palette that you can fully customize.

### Primary Color

The primary brand color is used for buttons, links, and accent elements. To change it:

1. Open `lib/mantine-theme.ts`
2. Find the `primaryColor` setting (currently `'aphBlue'`)
3. Either change it to use a different color from the palette, or create your own

### Creating Your Color Palette

Each color in Mantine needs 10 shades (index 0 = lightest, 9 = darkest). Here's the structure:

```typescript
// In lib/mantine-theme.ts

// Replace or rename this with your brand color
const yourBrandColor: MantineColorsTuple = [
  '#E6F1FF',  // 0: lightest (backgrounds)
  '#CCE3FF',  // 1
  '#99C7FF',  // 2
  '#66ABFF',  // 3
  '#338FFF',  // 4
  '#0073FF',  // 5
  '#0052CC',  // 6: DEFAULT (primary buttons) - This is the main brand color
  '#003D99',  // 7
  '#002966',  // 8
  '#001433',  // 9: darkest
];
```

### Using Your Colors

After defining your palette, register it and set it as primary:

```typescript
// In lib/mantine-theme.ts

export const mantineTheme = createTheme({
  primaryColor: 'yourBrand',  // Use your color name
  primaryShade: 6,            // Which shade to use as default

  colors: {
    yourBrand: yourBrandColor,
    // Keep or remove other colors as needed
  },
  // ...rest of theme
});
```

### Dark Mode Considerations

The app automatically supports dark mode. Mantine uses shade indices:
- Light mode: Uses lower indices (0-4) for backgrounds
- Dark mode: Uses higher indices (6-9) for backgrounds

Ensure your colors have enough contrast in both modes.

### Semantic Colors

The theme includes semantic colors for feedback:

```typescript
// In lib/mantine-theme.ts, under theme.other.semantic
semantic: {
  success: '#009F4D',  // Green - for success messages
  error: '#F83125',    // Red - for errors
  warning: '#FF8F00',  // Orange - for warnings
  info: '#009CDE',     // Blue - for information
},
```

Update these to match your brand's secondary colors.

## Application Name

### Page Metadata

Update the application name in `app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  title: "Austin RTASS - Your Organization Name",
  description: "Your custom description here",
  keywords: ["transcription", "radio traffic", "AI", "your keywords"],
  // ...icons config
};
```

### Web App Manifest

Update `public/site.webmanifest` for Progressive Web App support:

```json
{
  "name": "Austin RTASS - Your Org",
  "short_name": "Transcriber",
  "description": "Your description",
  "theme_color": "#YOUR_PRIMARY_COLOR",
  "background_color": "#ffffff",
  // ...rest of config
}
```

### Header Component

If you want to change the text shown in the header:

1. Open `components/layout/header.tsx`
2. Find the application name text
3. Update to your organization's name

## Typography

### Default Fonts

The app uses Geist font (loaded locally in `app/layout.tsx`). To use a different font:

### Using Google Fonts

```typescript
// In app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

// Update the body className
<body className={`${inter.variable} antialiased`}>
```

Then update the theme to use the new font variable:

```typescript
// In lib/mantine-theme.ts
fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, sans-serif',
```

### Using Custom Local Fonts

1. Add your font files to `app/fonts/`
2. Update `app/layout.tsx`:

```typescript
import localFont from "next/font/local";

const yourFont = localFont({
  src: "./fonts/YourFont.woff2",
  variable: "--font-custom",
});
```

3. Update the theme to use your font variable

## Testing Your Changes

### Development Testing

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open `http://localhost:3000` in your browser

3. Test these scenarios:
   - [ ] Logo displays correctly in header
   - [ ] Logo works in both light and dark modes
   - [ ] Favicon appears in browser tab
   - [ ] Colors are consistent across pages
   - [ ] Buttons and interactive elements use primary color
   - [ ] Error and success messages use appropriate colors
   - [ ] Text is readable against all backgrounds
   - [ ] Dark mode toggle works correctly

### Production Build Test

Before deploying:

```bash
npm run build
npm start
```

Verify the production build shows your branding correctly.

### Browser Compatibility

Test your branding in:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### Mobile Testing

Check that:
- [ ] Logo scales properly on mobile
- [ ] PWA icon appears correctly when installed
- [ ] Colors work on mobile devices

## Common Customization Examples

### Example: Blue Corporate Theme

```typescript
// lib/mantine-theme.ts
const corporateBlue: MantineColorsTuple = [
  '#E8F4FD', '#C5E4F9', '#A2D4F5', '#7FC4F1',
  '#5CB4ED', '#0066CC', '#004C99', '#003366',
  '#001A33', '#000D1A',
];

export const mantineTheme = createTheme({
  primaryColor: 'corporateBlue',
  colors: {
    corporateBlue,
  },
  // ...
});
```

### Example: Government Agency Theme

```typescript
// lib/mantine-theme.ts
const govGreen: MantineColorsTuple = [
  '#E6F3EB', '#C2E2CF', '#9ED1B3', '#7AC097',
  '#56AF7B', '#006633', '#004D26', '#00331A',
  '#001A0D', '#000D06',
];

export const mantineTheme = createTheme({
  primaryColor: 'govGreen',
  colors: {
    govGreen,
  },
  other: {
    semantic: {
      success: '#006633',
      error: '#CC0000',
      warning: '#FF9900',
      info: '#0066CC',
    },
  },
});
```

## Need Help?

If you encounter issues with branding customization:

1. Check that all required files are in the correct locations
2. Clear your browser cache after making changes
3. Verify Next.js hot reload picked up your changes (restart `npm run dev` if needed)
4. Check the browser console for any errors

For more complex customizations, refer to the [Mantine documentation](https://mantine.dev/theming/theme-object/).
