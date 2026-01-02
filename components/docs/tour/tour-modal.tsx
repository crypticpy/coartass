'use client';

import * as React from 'react';
import { Paper, Text, Button, Group, Stack, Progress, Loader, Center } from '@mantine/core';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTour } from './tour-provider';

// ============================================================================
// Constants
// ============================================================================

const MODAL_Z_INDEX = 9999;
const MODAL_WIDTH = 320;
const MODAL_OFFSET = 16; // Distance from target element
const HIGHLIGHT_PADDING = 8;
const VIEWPORT_PADDING = 16;

// ============================================================================
// Types
// ============================================================================

interface ModalPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  transformOrigin: string;
}

type Placement = 'top' | 'bottom' | 'left' | 'right';

// ============================================================================
// Utilities
// ============================================================================

function calculateModalPosition(
  targetRect: DOMRect | null,
  placement: Placement,
  modalHeight: number
): ModalPosition {
  if (!targetRect) {
    // Center in viewport if no target
    return {
      top: window.innerHeight / 2 - modalHeight / 2,
      left: window.innerWidth / 2 - MODAL_WIDTH / 2,
      transformOrigin: 'center center',
    };
  }

  const adjustedRect = {
    top: targetRect.top - HIGHLIGHT_PADDING,
    left: targetRect.left - HIGHLIGHT_PADDING,
    width: targetRect.width + HIGHLIGHT_PADDING * 2,
    height: targetRect.height + HIGHLIGHT_PADDING * 2,
    bottom: targetRect.bottom + HIGHLIGHT_PADDING,
    right: targetRect.right + HIGHLIGHT_PADDING,
  };

  let position: ModalPosition;

  switch (placement) {
    case 'top':
      position = {
        bottom: window.innerHeight - adjustedRect.top + MODAL_OFFSET,
        left: adjustedRect.left + adjustedRect.width / 2 - MODAL_WIDTH / 2,
        transformOrigin: 'bottom center',
      };
      break;

    case 'bottom':
      position = {
        top: adjustedRect.bottom + MODAL_OFFSET,
        left: adjustedRect.left + adjustedRect.width / 2 - MODAL_WIDTH / 2,
        transformOrigin: 'top center',
      };
      break;

    case 'left':
      position = {
        top: adjustedRect.top + adjustedRect.height / 2 - modalHeight / 2,
        right: window.innerWidth - adjustedRect.left + MODAL_OFFSET,
        transformOrigin: 'right center',
      };
      break;

    case 'right':
      position = {
        top: adjustedRect.top + adjustedRect.height / 2 - modalHeight / 2,
        left: adjustedRect.right + MODAL_OFFSET,
        transformOrigin: 'left center',
      };
      break;

    default:
      position = {
        top: adjustedRect.bottom + MODAL_OFFSET,
        left: adjustedRect.left + adjustedRect.width / 2 - MODAL_WIDTH / 2,
        transformOrigin: 'top center',
      };
  }

  // Ensure modal stays within viewport
  if (position.left !== undefined) {
    position.left = Math.max(
      VIEWPORT_PADDING,
      Math.min(position.left, window.innerWidth - MODAL_WIDTH - VIEWPORT_PADDING)
    );
  }
  if (position.right !== undefined) {
    position.right = Math.max(
      VIEWPORT_PADDING,
      Math.min(position.right, window.innerWidth - MODAL_WIDTH - VIEWPORT_PADDING)
    );
  }
  if (position.top !== undefined) {
    position.top = Math.max(
      VIEWPORT_PADDING,
      Math.min(position.top, window.innerHeight - modalHeight - VIEWPORT_PADDING)
    );
  }
  if (position.bottom !== undefined) {
    position.bottom = Math.max(
      VIEWPORT_PADDING,
      Math.min(position.bottom, window.innerHeight - modalHeight - VIEWPORT_PADDING)
    );
  }

  return position;
}

// ============================================================================
// Component
// ============================================================================

export function TourModal() {
  const { isActive, currentTour, currentStep, currentStepIndex, nextStep, prevStep, endTour, isNavigating } =
    useTour();

  const modalRef = React.useRef<HTMLDivElement>(null);
  const [modalHeight, setModalHeight] = React.useState(200);
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);
  const [isAnimating, setIsAnimating] = React.useState(false);

  // Find target element and track its position
  React.useEffect(() => {
    if (!isActive || !currentStep || isNavigating) {
      setTargetRect(null);
      return;
    }

    const findElement = () => {
      const targetElement = document.querySelector(
        `[data-tour-id="${currentStep.target}"]`
      ) as HTMLElement | null;

      if (targetElement) {
        setTargetRect(targetElement.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(findElement, 100);

    // Also listen for scroll/resize
    const handleUpdate = () => {
      const targetElement = document.querySelector(
        `[data-tour-id="${currentStep.target}"]`
      ) as HTMLElement | null;
      if (targetElement) {
        setTargetRect(targetElement.getBoundingClientRect());
      }
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isActive, currentStep, isNavigating]);

  // Measure modal height
  React.useEffect(() => {
    if (modalRef.current) {
      setModalHeight(modalRef.current.offsetHeight);
    }
  }, [currentStep]);

  // Animation on step change
  React.useEffect(() => {
    if (currentStep) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // Don't render if tour is not active
  if (!isActive || !currentTour) {
    return null;
  }

  // Show loading state while navigating
  if (isNavigating) {
    return (
      <Paper
        ref={modalRef}
        shadow="xl"
        radius="lg"
        p="lg"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: MODAL_WIDTH,
          zIndex: MODAL_Z_INDEX,
          backgroundColor: 'var(--mantine-color-body)',
          border: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="md" />
            <Text size="sm" c="dimmed">
              Loading next step...
            </Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  // Show error if no current step
  if (!currentStep) {
    return null;
  }

  const totalSteps = currentTour.steps.length;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  const position = calculateModalPosition(targetRect, currentStep.placement, modalHeight);

  return (
    <Paper
      ref={modalRef}
      shadow="xl"
      radius="lg"
      p="lg"
      style={{
        position: 'fixed',
        ...position,
        width: MODAL_WIDTH,
        zIndex: MODAL_Z_INDEX,
        backgroundColor: 'var(--mantine-color-body)',
        border: '1px solid var(--mantine-color-default-border)',
        opacity: isAnimating ? 0 : 1,
        transform: isAnimating ? 'scale(0.95)' : 'scale(1)',
        transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
        transformOrigin: position.transformOrigin,
      }}
      role="dialog"
      aria-labelledby="tour-modal-title"
      aria-describedby="tour-modal-content"
    >
      <Stack gap="md">
        {/* Header with close button */}
        <Group justify="space-between" align="flex-start">
          <Text id="tour-modal-title" fw={600} size="lg" style={{ flex: 1 }}>
            {currentStep.title}
          </Text>
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            p={4}
            onClick={endTour}
            aria-label="Close tour"
          >
            <X size={16} />
          </Button>
        </Group>

        {/* Content */}
        <Text id="tour-modal-content" size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
          {currentStep.content}
        </Text>

        {/* Progress indicator */}
        <Stack gap="xs">
          <Progress value={progress} size="xs" radius="xl" />
          <Text size="xs" c="dimmed" ta="center">
            Step {currentStepIndex + 1} of {totalSteps}
          </Text>
        </Stack>

        {/* Navigation buttons */}
        <Group justify="space-between" mt="xs">
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            onClick={endTour}
            styles={{ root: { minHeight: 36 } }}
          >
            Skip Tour
          </Button>

          <Group gap="xs">
            {!isFirstStep && (
              <Button
                variant="default"
                size="sm"
                leftSection={<ChevronLeft size={16} />}
                onClick={prevStep}
                styles={{ root: { minHeight: 36 } }}
              >
                Back
              </Button>
            )}

            <Button
              size="sm"
              rightSection={!isLastStep ? <ChevronRight size={16} /> : undefined}
              onClick={nextStep}
              styles={{ root: { minHeight: 36 } }}
            >
              {isLastStep ? 'Finish' : 'Next'}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Paper>
  );
}
