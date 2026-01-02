'use client';

import * as React from 'react';
import { Button, type ButtonProps } from '@mantine/core';
import { Play } from 'lucide-react';
import { useTour } from './tour-provider';

// ============================================================================
// Types
// ============================================================================

interface TourTriggerProps extends Omit<ButtonProps, 'onClick'> {
  /** The ID of the tour to start */
  tourId: string;
  /** Optional custom label (defaults to "Start Tour") */
  label?: string;
  /** Hide the play icon */
  hideIcon?: boolean;
  /** Callback after tour starts */
  onTourStart?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function TourTrigger({
  tourId,
  label = 'Start Tour',
  hideIcon = false,
  onTourStart,
  ...buttonProps
}: TourTriggerProps) {
  const { startTour, isActive } = useTour();

  const handleClick = React.useCallback(() => {
    startTour(tourId);
    onTourStart?.();
  }, [startTour, tourId, onTourStart]);

  return (
    <Button
      leftSection={!hideIcon ? <Play size={16} /> : undefined}
      onClick={handleClick}
      disabled={isActive}
      {...buttonProps}
    >
      {label}
    </Button>
  );
}
