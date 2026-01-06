/**
 * Skip to main content link for accessibility
 * Shows on keyboard focus for screen reader users
 */
export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="absolute left-4 top-4 z-[9999] rounded-md bg-[var(--mantine-color-aphBlue-6)] px-4 py-3 font-semibold text-white no-underline opacity-0 pointer-events-none transition-opacity focus:opacity-100 focus:pointer-events-auto focus:outline-none"
    >
      Skip to main content
    </a>
  );
}
