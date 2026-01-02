'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { generateDemoData } from '@/lib/demo-data';
import { saveTranscript, saveAnalysis } from '@/lib/db';
import { clearAllDemoData } from '@/hooks/use-demo-data';
import type { Transcript } from '@/types/transcript';
import type { Analysis } from '@/types/analysis';

// ============================================================================
// Type Definitions
// ============================================================================

export interface TourStep {
  /** Unique identifier for this step */
  id: string;
  /** The data-tour-id value of the target element */
  target: string;
  /** Step title displayed in the modal */
  title: string;
  /** Step content/description */
  content: string;
  /** Position of the modal relative to the target element */
  placement: 'top' | 'bottom' | 'left' | 'right';
  /** Optional route to navigate to before showing this step */
  route?: string;
}

export interface TourConfig {
  /** Unique identifier for this tour */
  id: string;
  /** Display name of the tour */
  name: string;
  /** Description of what the tour covers */
  description: string;
  /** Ordered list of steps in the tour */
  steps: TourStep[];
}

export interface TourContextValue {
  /** Whether a tour is currently active */
  isActive: boolean;
  /** The currently running tour configuration */
  currentTour: TourConfig | null;
  /** Index of the current step (0-based) */
  currentStepIndex: number;
  /** Start a tour by its ID */
  startTour: (tourId: string) => void;
  /** Advance to the next step */
  nextStep: () => void;
  /** Go back to the previous step */
  prevStep: () => void;
  /** End the current tour */
  endTour: () => void;
  /** Jump to a specific step by index */
  goToStep: (index: number) => void;
  /** Register a tour configuration */
  registerTour: (tour: TourConfig) => void;
  /** Unregister a tour configuration */
  unregisterTour: (tourId: string) => void;
  /** Current step data */
  currentStep: TourStep | null;
  /** Whether we're waiting for navigation to complete */
  isNavigating: boolean;
  /** Whether demo data is being loaded */
  isLoadingDemoData: boolean;
}

// ============================================================================
// Context
// ============================================================================

const TourContext = React.createContext<TourContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface TourProviderProps {
  children: React.ReactNode;
  /** Pre-registered tours */
  tours?: TourConfig[];
}

export function TourProvider({ children, tours = [] }: TourProviderProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Tour registry - stores all available tours
  const [tourRegistry, setTourRegistry] = React.useState<Map<string, TourConfig>>(
    () => new Map(tours.map((tour) => [tour.id, tour]))
  );

  // Current tour state
  const [isActive, setIsActive] = React.useState(false);
  const [currentTour, setCurrentTour] = React.useState<TourConfig | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [isLoadingDemoData, setIsLoadingDemoData] = React.useState(false);

  // Track if demo data has been loaded this session
  const demoDataLoadedRef = React.useRef(false);

  // Track if a tour is currently active (for cleanup on unmount/interrupt)
  const tourActiveRef = React.useRef(false);

  // Track pending navigation target
  const pendingNavigationRef = React.useRef<{
    stepIndex: number;
    route: string;
  } | null>(null);

  // Get current step
  const currentStep = React.useMemo(() => {
    if (!currentTour || currentStepIndex < 0 || currentStepIndex >= currentTour.steps.length) {
      return null;
    }
    return currentTour.steps[currentStepIndex];
  }, [currentTour, currentStepIndex]);

  // Handle route changes - complete pending navigation
  React.useEffect(() => {
    if (pendingNavigationRef.current && pendingNavigationRef.current.route === pathname) {
      // Navigation complete - show the step after a brief delay for DOM to settle
      const targetStepIndex = pendingNavigationRef.current.stepIndex;
      pendingNavigationRef.current = null;

      const timer = setTimeout(() => {
        setIsNavigating(false);
        setCurrentStepIndex(targetStepIndex);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Load demo data for tours
  // IMPORTANT: Always clears existing demo data first to prevent accumulation
  const loadDemoData = React.useCallback(async () => {
    // Only load once per session
    if (demoDataLoadedRef.current) {
      return;
    }

    setIsLoadingDemoData(true);
    try {
      // CRITICAL: Clear any existing demo data before loading new
      // This prevents demo data accumulation from multiple tour runs
      await clearAllDemoData();

      const demoData = generateDemoData();

      // Load transcripts
      for (const transcript of demoData.transcripts) {
        await saveTranscript(transcript as Transcript);
      }

      // Load analyses
      for (const analysis of demoData.analyses) {
        await saveAnalysis(analysis as Analysis);
      }

      demoDataLoadedRef.current = true;
      tourActiveRef.current = true;
      console.log('[TourProvider] Demo data loaded successfully');
    } catch (error) {
      console.error('[TourProvider] Failed to load demo data:', error);
      // Continue with tour even if demo data fails
    } finally {
      setIsLoadingDemoData(false);
    }
  }, []);

  // Navigate to step with optional route change
  const navigateToStep = React.useCallback(
    async (stepIndex: number) => {
      if (!currentTour || stepIndex < 0 || stepIndex >= currentTour.steps.length) {
        return;
      }

      const step = currentTour.steps[stepIndex];

      // If step has a route and we're not already there, navigate first
      if (step.route && step.route !== pathname) {
        setIsNavigating(true);
        pendingNavigationRef.current = { stepIndex, route: step.route };
        router.push(step.route);
      } else {
        // No navigation needed - show step directly
        setCurrentStepIndex(stepIndex);
      }
    },
    [currentTour, pathname, router]
  );

  // Start a tour - loads demo data first, then begins the tour
  const startTour = React.useCallback(
    async (tourId: string) => {
      const tour = tourRegistry.get(tourId);
      if (!tour || tour.steps.length === 0) {
        console.warn(`Tour "${tourId}" not found or has no steps`);
        return;
      }

      // Load demo data before starting the tour
      await loadDemoData();

      setCurrentTour(tour);
      setIsActive(true);
      setCurrentStepIndex(-1); // Will be set after potential navigation

      // Navigate to the first step
      const firstStep = tour.steps[0];
      if (firstStep.route && firstStep.route !== pathname) {
        setIsNavigating(true);
        pendingNavigationRef.current = { stepIndex: 0, route: firstStep.route };
        router.push(firstStep.route);
      } else {
        setCurrentStepIndex(0);
      }
    },
    [tourRegistry, pathname, router, loadDemoData]
  );

  // End tour and clean up demo data
  // Note: Must be defined before nextStep due to dependency
  const endTour = React.useCallback(async () => {
    setIsActive(false);
    setCurrentTour(null);
    setCurrentStepIndex(0);
    setIsNavigating(false);
    pendingNavigationRef.current = null;

    // Clean up demo data when tour ends
    // This ensures demo data doesn't pollute the user's real transcript list
    if (tourActiveRef.current) {
      tourActiveRef.current = false;
      try {
        await clearAllDemoData();
        console.log('[TourProvider] Demo data cleaned up on tour end');
      } catch (error) {
        console.error('[TourProvider] Failed to clean up demo data:', error);
      }
    }
  }, []);

  // Next step
  const nextStep = React.useCallback(() => {
    if (!currentTour) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= currentTour.steps.length) {
      // Tour complete - use endTour to ensure cleanup
      endTour();
    } else {
      navigateToStep(nextIndex);
    }
  }, [currentTour, currentStepIndex, navigateToStep, endTour]);

  // Previous step
  const prevStep = React.useCallback(() => {
    if (!currentTour || currentStepIndex <= 0) return;
    navigateToStep(currentStepIndex - 1);
  }, [currentTour, currentStepIndex, navigateToStep]);

  // Go to specific step
  const goToStep = React.useCallback(
    (index: number) => {
      if (!currentTour) return;
      if (index < 0 || index >= currentTour.steps.length) return;
      navigateToStep(index);
    },
    [currentTour, navigateToStep]
  );

  // Register a tour
  const registerTour = React.useCallback((tour: TourConfig) => {
    setTourRegistry((prev) => {
      const next = new Map(prev);
      next.set(tour.id, tour);
      return next;
    });
  }, []);

  // Unregister a tour
  const unregisterTour = React.useCallback((tourId: string) => {
    setTourRegistry((prev) => {
      const next = new Map(prev);
      next.delete(tourId);
      return next;
    });
  }, []);

  // Keyboard navigation
  React.useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          endTour();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          nextStep();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          prevStep();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, nextStep, prevStep, endTour]);

  // Handle interrupted tours (page close, refresh, navigation away)
  // Clean up demo data to prevent accumulation from abandoned tours
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      // Note: Can't await async operations in beforeunload
      // The cleanup will happen on next tour start via clearAllDemoData
      if (tourActiveRef.current) {
        console.log('[TourProvider] Tour interrupted by page unload');
        // Mark as inactive so next session knows to clean up
        tourActiveRef.current = false;
      }
    };

    // Also handle visibility change (user switches tabs during tour)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && tourActiveRef.current) {
        console.log('[TourProvider] Page hidden during tour');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on component unmount - this catches React navigation away
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // If tour was active when component unmounts, clean up demo data
      if (tourActiveRef.current) {
        console.log('[TourProvider] Cleaning up demo data on unmount');
        // Fire and forget - can't await in cleanup
        clearAllDemoData().catch(console.error);
        tourActiveRef.current = false;
      }
    };
  }, []);

  const contextValue: TourContextValue = React.useMemo(
    () => ({
      isActive,
      currentTour,
      currentStepIndex,
      startTour,
      nextStep,
      prevStep,
      endTour,
      goToStep,
      registerTour,
      unregisterTour,
      currentStep,
      isNavigating,
      isLoadingDemoData,
    }),
    [
      isActive,
      currentTour,
      currentStepIndex,
      startTour,
      nextStep,
      prevStep,
      endTour,
      goToStep,
      registerTour,
      unregisterTour,
      currentStep,
      isNavigating,
      isLoadingDemoData,
    ]
  );

  return <TourContext.Provider value={contextValue}>{children}</TourContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useTour(): TourContextValue {
  const context = React.useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
