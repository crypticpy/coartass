'use client';

import * as React from 'react';
import { useTour } from './tour-provider';

// ============================================================================
// Constants
// ============================================================================

const OVERLAY_Z_INDEX = 9998;
const HIGHLIGHT_PADDING = 8;
const BORDER_RADIUS = 8;

// ============================================================================
// Types
// ============================================================================

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ============================================================================
// Component
// ============================================================================

export function TourHighlight() {
  const { isActive, currentStep, isNavigating } = useTour();
  const [targetRect, setTargetRect] = React.useState<TargetRect | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);
  const observerRef = React.useRef<ResizeObserver | null>(null);

  // Find and track the target element
  React.useEffect(() => {
    if (!isActive || !currentStep || isNavigating) {
      setTargetRect(null);
      setIsVisible(false);
      return;
    }

    const findAndTrackElement = () => {
      const targetElement = document.querySelector(
        `[data-tour-id="${currentStep.target}"]`
      ) as HTMLElement | null;

      if (!targetElement) {
        // Element not found - might still be loading
        setTargetRect(null);
        setIsVisible(false);
        return;
      }

      const updatePosition = () => {
        const rect = targetElement.getBoundingClientRect();
        setTargetRect({
          top: rect.top - HIGHLIGHT_PADDING,
          left: rect.left - HIGHLIGHT_PADDING,
          width: rect.width + HIGHLIGHT_PADDING * 2,
          height: rect.height + HIGHLIGHT_PADDING * 2,
        });
        setIsVisible(true);
      };

      // Initial position
      updatePosition();

      // Set up ResizeObserver
      observerRef.current = new ResizeObserver(updatePosition);
      observerRef.current.observe(targetElement);

      // Listen for scroll and resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        observerRef.current?.disconnect();
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    };

    // Small delay to ensure DOM is ready after navigation
    const timer = setTimeout(findAndTrackElement, 50);

    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
    };
  }, [isActive, currentStep, isNavigating]);

  // Don't render if tour is not active or we're navigating
  if (!isActive || isNavigating || !isVisible || !targetRect) {
    return null;
  }

  // Calculate the box-shadow to create the spotlight effect
  // Using a large box-shadow spread to cover the entire viewport
  const boxShadow = `
    0 0 0 9999px rgba(0, 0, 0, 0.5),
    0 0 0 2px var(--mantine-primary-color-filled)
  `;

  return (
    <>
      {/* Spotlight overlay using box-shadow trick */}
      <div
        style={{
          position: 'fixed',
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          borderRadius: BORDER_RADIUS,
          boxShadow,
          zIndex: OVERLAY_Z_INDEX,
          pointerEvents: 'none',
          transition: 'all 0.3s ease-out',
        }}
        aria-hidden="true"
      />

      {/* Click blocker for the overlay area (outside the spotlight) */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: OVERLAY_Z_INDEX - 1,
          pointerEvents: 'auto',
        }}
        onClick={(e) => {
          // Only block clicks outside the target area
          const clickX = e.clientX;
          const clickY = e.clientY;

          const isInsideTarget =
            clickX >= targetRect.left &&
            clickX <= targetRect.left + targetRect.width &&
            clickY >= targetRect.top &&
            clickY <= targetRect.top + targetRect.height;

          if (!isInsideTarget) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        aria-hidden="true"
      />

      {/* Allow interactions with the highlighted element */}
      <div
        style={{
          position: 'fixed',
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          zIndex: OVERLAY_Z_INDEX,
          pointerEvents: 'none', // Let clicks through to the actual element
          borderRadius: BORDER_RADIUS,
        }}
        aria-hidden="true"
      />
    </>
  );
}
