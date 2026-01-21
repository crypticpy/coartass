/**
 * Skip to main content link for accessibility
 * Hidden until focused via keyboard navigation (Tab key)
 * Uses sr-only pattern that becomes visible on focus
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[9999] focus:block focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-3 focus:font-semibold focus:text-white focus:no-underline focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
    >
      Skip to main content
    </a>
  );
}
