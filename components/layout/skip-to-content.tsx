"use client";

/**
 * Skip to main content link for accessibility
 * Shows on keyboard focus for screen reader users
 */
export function SkipToContent() {
  return (
    <>
      <a
        href="#main-content"
        className="skip-to-content"
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          zIndex: 9999,
          padding: "0.75rem 1rem",
          backgroundColor: "var(--mantine-color-aphBlue-6)",
          color: "white",
          borderRadius: "0.375rem",
          textDecoration: "none",
          fontWeight: 600,
          opacity: 0,
          pointerEvents: "none",
          transition: "opacity 0.2s",
        }}
      >
        Skip to main content
      </a>
      <style jsx>{`
        .skip-to-content:focus {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
    </>
  );
}
