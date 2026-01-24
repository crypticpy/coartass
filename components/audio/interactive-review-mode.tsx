/**
 * Interactive Review Mode Component
 *
 * Full-screen overlay optimized for classroom/projector display during
 * fireteam training reviews. Features:
 * - Large incident clock display
 * - Simplified, touch-friendly audio controls
 * - Auto-scrolling transcript with prominent highlighting
 * - Scorecard benchmark overlays with timing indicators
 *
 * Design: Industrial/Command Center aesthetic with fire department colors
 */

"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useDisclosure } from "@mantine/hooks";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  Settings,
  Volume2,
  VolumeX,
  Target,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSearch,
  StickyNote,
} from "lucide-react";
import { Text, Box, Tooltip, Slider, Badge } from "@mantine/core";
import { WaveformPlayer } from "./waveform-player";
import { AudioControlsModal } from "./audio-controls-modal";
import { ScorecardSelectorMenu } from "./scorecard-selector-menu";
import { ScorecardOverlayPanel } from "./scorecard-overlay-panel";
import { useAudioSync } from "@/hooks/use-audio-sync";
import {
  mapEvidenceToSegments,
  getEvidenceForSegment,
  type EvidenceMarker,
} from "@/lib/scorecard-evidence-utils";
import type { TranscriptSegment } from "@/types/transcript";
import type { TranscriptAnnotation } from "@/types/annotation";
import type { PlaybackSpeed } from "@/types/audio";
import type {
  RtassScorecard,
  RtassRubricTemplate,
  RtassScorecardCriterion,
} from "@/types/rtass";

/**
 * Props for the InteractiveReviewMode component
 */
interface InteractiveReviewModeProps {
  /** Audio source URL */
  audioUrl: string;
  /** Transcript segments with timing */
  segments: TranscriptSegment[];
  /** Optional initial scorecard for benchmark overlays */
  scorecard?: RtassScorecard;
  /** Optional rubric for benchmark definitions */
  rubric?: RtassRubricTemplate;
  /** All available scorecards for this transcript */
  scorecards?: RtassScorecard[];
  /** Total audio duration in seconds */
  duration: number;
  /** Callback to close the review mode */
  onClose?: () => void;
  /** Cache key for waveform peaks */
  cacheKey?: string;
  /** Map of segment index to annotations at that segment */
  annotationsBySegment?: Map<number, TranscriptAnnotation[]>;
}

/**
 * Benchmark timing indicator data
 */
interface TimingBenchmark {
  id: string;
  title: string;
  targetSeconds: number;
  actualSeconds?: number;
  status: "met" | "close" | "missed" | "pending";
  delta?: number;
}

/**
 * Speed button options for the simplified controls
 */
const SPEED_OPTIONS: { value: PlaybackSpeed; label: string }[] = [
  { value: 0.75, label: "0.75x" },
  { value: 1, label: "1x" },
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
];

/**
 * Format time as MM:SS or HH:MM:SS for large display
 */
function formatIncidentClock(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format segment timestamp for display
 */
function formatSegmentTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Extract timing benchmarks from rubric and scorecard
 */
function extractTimingBenchmarks(
  rubric?: RtassRubricTemplate,
  scorecard?: RtassScorecard,
  currentTime?: number,
): TimingBenchmark[] {
  if (!rubric) return [];

  const benchmarks: TimingBenchmark[] = [];

  for (const section of rubric.sections) {
    for (const criterion of section.criteria) {
      if (criterion.type === "timing" && criterion.timing?.targetSeconds) {
        // Find matching scorecard criterion for actual timing
        const scorecardCriterion = scorecard?.sections
          .flatMap((s) => s.criteria)
          .find((c) => c.criterionId === criterion.id);

        const targetSeconds = criterion.timing.targetSeconds;
        let actualSeconds: number | undefined;
        let status: TimingBenchmark["status"] = "pending";
        let delta: number | undefined;

        if (
          scorecardCriterion?.observedEvents &&
          scorecardCriterion.observedEvents.length > 0
        ) {
          // Use the first observed event as the actual time
          actualSeconds = scorecardCriterion.observedEvents[0].at;
          delta = actualSeconds - targetSeconds;

          if (delta <= 0) {
            status = "met";
          } else if (delta <= targetSeconds * 0.2) {
            // Within 20% of target
            status = "close";
          } else {
            status = "missed";
          }
        } else if (currentTime !== undefined && currentTime > targetSeconds) {
          // Target time has passed without observation
          status = "missed";
        }

        benchmarks.push({
          id: criterion.id,
          title: criterion.title,
          targetSeconds,
          actualSeconds,
          status,
          delta,
        });
      }
    }
  }

  return benchmarks.sort((a, b) => a.targetSeconds - b.targetSeconds);
}

/**
 * Get status color for benchmark
 */
function getBenchmarkColor(status: TimingBenchmark["status"]): string {
  switch (status) {
    case "met":
      return "var(--review-green)";
    case "close":
      return "var(--review-amber)";
    case "missed":
      return "var(--review-red)";
    case "pending":
    default:
      return "var(--review-text-dim)";
  }
}

/**
 * Get status icon for benchmark
 */
function getBenchmarkIcon(status: TimingBenchmark["status"]) {
  switch (status) {
    case "met":
      return <CheckCircle2 size={14} />;
    case "close":
      return <AlertTriangle size={14} />;
    case "missed":
      return <XCircle size={14} />;
    case "pending":
    default:
      return <Target size={14} />;
  }
}

/**
 * Interactive Review Mode Component
 *
 * Full-screen overlay for classroom/projector display during training reviews.
 */
export function InteractiveReviewMode({
  audioUrl,
  segments,
  scorecard: initialScorecard,
  rubric,
  scorecards = [],
  duration,
  onClose,
  cacheKey,
  annotationsBySegment,
}: InteractiveReviewModeProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  // Track if component is mounted (SSR-safe portal pattern)
  const [isMounted, setIsMounted] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showBenchmarks, setShowBenchmarks] = useState(true);
  const [
    audioControlsOpened,
    { open: openAudioControls, close: closeAudioControls },
  ] = useDisclosure(false);

  // Selected scorecard state - default to the initial scorecard if provided
  const [selectedScorecardId, setSelectedScorecardId] = useState<string | null>(
    initialScorecard?.id ?? null,
  );

  // Get the currently selected scorecard
  const selectedScorecard = useMemo(() => {
    if (!selectedScorecardId) return undefined;
    return (
      scorecards.find((sc) => sc.id === selectedScorecardId) ?? initialScorecard
    );
  }, [selectedScorecardId, scorecards, initialScorecard]);

  // Build evidence map for selected scorecard
  const evidenceMap = useMemo(() => {
    if (!selectedScorecard) return new Map<number, EvidenceMarker[]>();
    return mapEvidenceToSegments(selectedScorecard, segments);
  }, [selectedScorecard, segments]);

  // Use audio sync hook
  const { syncState, controls, registerWaveSurfer, enhancement } = useAudioSync(
    {
      segments,
      initialSpeed: 1,
      initialVolume: 0.8,
    },
  );

  const {
    currentTime,
    duration: syncDuration,
    state,
    speed,
    volume,
    muted,
    activeSegmentIndex,
  } = syncState;

  const isPlaying = state === "playing";
  const isLoading = state === "loading";
  const effectiveDuration = duration || syncDuration;

  // Extract timing benchmarks (for timeline markers)
  const benchmarks = useMemo(
    () => extractTimingBenchmarks(rubric, selectedScorecard, currentTime),
    [rubric, selectedScorecard, currentTime],
  );

  // Handler for criterion clicks - jump to evidence timestamp
  const handleCriterionClick = useCallback(
    (criterion: RtassScorecardCriterion, evidenceIndex?: number) => {
      if (criterion.evidence && criterion.evidence.length > 0) {
        const idx = evidenceIndex ?? 0;
        const evidence = criterion.evidence[idx];
        if (evidence?.start !== undefined) {
          controls.seek(evidence.start);
        }
      } else if (
        criterion.observedEvents &&
        criterion.observedEvents.length > 0
      ) {
        // For timing criteria, jump to the observed event
        controls.seek(criterion.observedEvents[0].at);
      }
    },
    [controls],
  );

  // Get verdict color for evidence markers
  const getVerdictColor = useCallback((verdict: string): string => {
    switch (verdict) {
      case "met":
        return "var(--review-green)";
      case "missed":
        return "var(--review-red)";
      case "partial":
        return "var(--review-amber)";
      default:
        return "var(--review-text-dim)";
    }
  }, []);

  // Mount state for portal - set up container and body scroll lock
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe portal mounting pattern
    setIsMounted(true);
    // Lock body scroll when mounted
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Auto-scroll to active segment
  useEffect(() => {
    if (!isUserScrolling && activeSegmentIndex >= 0 && transcriptRef.current) {
      const activeElement = transcriptRef.current.querySelector(
        `[data-segment-index="${activeSegmentIndex}"]`,
      );
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [activeSegmentIndex, isUserScrolling]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    setIsUserScrolling(true);
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 3000);
  }, []);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          controls.togglePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) {
            // Skip to previous segment
            if (activeSegmentIndex > 0) {
              controls.jumpToSegment(activeSegmentIndex - 1);
            }
          } else {
            controls.skipBackward(5);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) {
            // Skip to next segment
            if (activeSegmentIndex < segments.length - 1) {
              controls.jumpToSegment(activeSegmentIndex + 1);
            }
          } else {
            controls.skipForward(5);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose?.();
          break;
        case "m":
          e.preventDefault();
          controls.toggleMute();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [controls, activeSegmentIndex, segments.length, onClose]);

  // Skip to next/previous transmission
  const skipToNextTransmission = useCallback(() => {
    if (activeSegmentIndex < segments.length - 1) {
      controls.jumpToSegment(activeSegmentIndex + 1);
    }
  }, [activeSegmentIndex, segments.length, controls]);

  const skipToPrevTransmission = useCallback(() => {
    if (activeSegmentIndex > 0) {
      controls.jumpToSegment(activeSegmentIndex - 1);
    }
  }, [activeSegmentIndex, controls]);

  // Handle segment click
  const handleSegmentClick = useCallback(
    (index: number) => {
      controls.jumpToSegment(index);
    },
    [controls],
  );

  // Calculate timeline progress
  const progressPercent =
    effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  if (!isMounted) return null;

  const content = (
    <Box className="interactive-review-mode">
      {/* CSS Variables and Global Styles */}
      <style jsx global>{`
        .interactive-review-mode {
          --review-bg: #0a0a0b;
          --review-surface: #141416;
          --review-surface-elevated: #1c1c1f;
          --review-border: #2a2a2e;
          --review-text: #f5f5f4;
          --review-text-dim: #71717a;
          --review-amber: #f59e0b;
          --review-amber-glow: rgba(245, 158, 11, 0.15);
          --review-red: #ef4444;
          --review-green: #22c55e;
          --review-blue: #3b82f6;
          --review-teal: #14b8a6;
          --review-teal-dim: rgba(20, 184, 166, 0.15);

          position: fixed;
          inset: 0;
          z-index: 9999;
          background: var(--review-bg);
          color: var(--review-text);
          display: flex;
          flex-direction: column;
          font-family:
            "JetBrains Mono", "SF Mono", "Fira Code", ui-monospace, monospace;
          overflow: hidden;
        }

        .review-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: var(--review-surface);
          border-bottom: 1px solid var(--review-border);
        }

        .incident-clock {
          font-size: clamp(48px, 8vw, 96px);
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
          color: var(--review-amber);
          text-shadow: 0 0 40px var(--review-amber-glow);
          line-height: 1;
        }

        .incident-clock-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--review-text-dim);
          margin-bottom: 4px;
        }

        .duration-display {
          font-size: clamp(14px, 2vw, 20px);
          color: var(--review-text-dim);
          font-variant-numeric: tabular-nums;
        }

        .review-main {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 640px;
          gap: 0;
          overflow: hidden;
        }

        @media (max-width: 1024px) {
          .review-main {
            grid-template-columns: 1fr;
          }
          .review-sidebar {
            display: none;
          }
        }

        .transcript-panel {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-right: 1px solid var(--review-border);
        }

        .transcript-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 24px 32px;
          scroll-behavior: smooth;
        }

        .transcript-segment {
          padding: 16px 20px;
          margin-bottom: 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          border-left: 4px solid transparent;
          background: transparent;
        }

        .transcript-segment:hover {
          background: var(--review-surface);
        }

        .transcript-segment.active {
          background: var(--review-amber-glow);
          border-left-color: var(--review-amber);
        }

        .transcript-segment.active .segment-text {
          color: var(--review-text);
        }

        .segment-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .segment-timestamp {
          font-size: 13px;
          font-weight: 600;
          color: var(--review-amber);
          font-variant-numeric: tabular-nums;
        }

        .segment-speaker {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--review-text-dim);
          background: var(--review-surface);
          padding: 2px 8px;
          border-radius: 4px;
        }

        .segment-text {
          font-size: clamp(22px, 3vw, 27px);
          line-height: 1.6;
          color: var(--review-text-dim);
          font-family:
            "Inter",
            -apple-system,
            BlinkMacSystemFont,
            sans-serif;
        }

        .review-sidebar {
          background: var(--review-surface);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .sidebar-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--review-border);
        }

        .sidebar-title {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--review-text-dim);
        }

        .benchmarks-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .benchmark-item {
          padding: 12px 16px;
          margin-bottom: 8px;
          border-radius: 8px;
          background: var(--review-surface-elevated);
          border: 1px solid var(--review-border);
        }

        .benchmark-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .benchmark-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--review-text);
        }

        .benchmark-times {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 12px;
          font-variant-numeric: tabular-nums;
        }

        .benchmark-target {
          color: var(--review-text-dim);
        }

        .benchmark-actual {
          font-weight: 600;
        }

        .benchmark-delta {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .review-controls {
          padding: 20px 32px;
          background: var(--review-surface);
          border-top: 1px solid var(--review-border);
        }

        .controls-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .play-button {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: var(--review-amber);
          color: var(--review-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          box-shadow: 0 0 30px var(--review-amber-glow);
        }

        .play-button:hover {
          transform: scale(1.05);
          box-shadow: 0 0 50px var(--review-amber-glow);
        }

        .play-button:active {
          transform: scale(0.98);
        }

        .play-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .nav-button {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--review-surface-elevated);
          color: var(--review-text);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid var(--review-border);
          transition: all 0.2s ease;
        }

        .nav-button:hover {
          background: var(--review-border);
        }

        .speed-buttons {
          display: flex;
          gap: 4px;
          background: var(--review-surface-elevated);
          padding: 4px;
          border-radius: 8px;
          border: 1px solid var(--review-border);
        }

        .speed-button {
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          background: transparent;
          color: var(--review-text-dim);
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
          font-variant-numeric: tabular-nums;
        }

        .speed-button:hover {
          color: var(--review-text);
        }

        .speed-button.active {
          background: var(--review-amber);
          color: var(--review-bg);
        }

        .volume-control {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .close-button {
          position: absolute;
          top: 12px;
          right: 16px;
          width: 44px;
          height: 44px;
          border-radius: 8px;
          background: var(--review-surface-elevated);
          color: var(--review-text-dim);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid var(--review-border);
          transition: all 0.2s ease;
          z-index: 10;
        }

        .close-button:hover {
          background: var(--review-border);
          color: var(--review-text);
        }

        .timeline-bar {
          height: 4px;
          background: var(--review-border);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 16px;
        }

        .timeline-progress {
          height: 100%;
          background: var(--review-amber);
          transition: width 0.1s linear;
        }

        .timeline-markers {
          position: relative;
          height: 20px;
          margin-top: 8px;
        }

        .timeline-marker {
          position: absolute;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .marker-line {
          width: 2px;
          height: 8px;
          border-radius: 1px;
        }

        .marker-label {
          font-size: 10px;
          font-weight: 600;
          margin-top: 2px;
        }

        /* Scrollbar styling */
        .transcript-scroll::-webkit-scrollbar,
        .benchmarks-list::-webkit-scrollbar {
          width: 8px;
        }

        .transcript-scroll::-webkit-scrollbar-track,
        .benchmarks-list::-webkit-scrollbar-track {
          background: var(--review-surface);
        }

        .transcript-scroll::-webkit-scrollbar-thumb,
        .benchmarks-list::-webkit-scrollbar-thumb {
          background: var(--review-border);
          border-radius: 4px;
        }

        .transcript-scroll::-webkit-scrollbar-thumb:hover,
        .benchmarks-list::-webkit-scrollbar-thumb:hover {
          background: var(--review-text-dim);
        }
      `}</style>

      {/* Header with Clock */}
      <div className="review-header">
        <div>
          <div className="incident-clock-label">Incident Time</div>
          <div className="incident-clock">
            {formatIncidentClock(currentTime)}
          </div>
        </div>

        {/* Scorecard Selector + Overall Score */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {scorecards.length > 0 && (
            <ScorecardSelectorMenu
              scorecards={scorecards}
              selectedScorecardId={selectedScorecardId}
              onSelect={setSelectedScorecardId}
            />
          )}
          {/* Overall Score Display */}
          {selectedScorecard && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 16px",
                backgroundColor: "var(--review-surface-elevated)",
                borderRadius: 8,
                border: "1px solid var(--review-border)",
              }}
            >
              <span
                style={{
                  fontSize: "clamp(24px, 4vw, 36px)",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color:
                    selectedScorecard.overall.status === "pass"
                      ? "var(--review-green)"
                      : selectedScorecard.overall.status === "needs_improvement"
                        ? "var(--review-amber)"
                        : "var(--review-red)",
                  lineHeight: 1,
                }}
              >
                {Math.round(selectedScorecard.overall.score * 100)}%
              </span>
              <Badge
                size="sm"
                color={
                  selectedScorecard.overall.status === "pass"
                    ? "green"
                    : selectedScorecard.overall.status === "needs_improvement"
                      ? "yellow"
                      : "red"
                }
                variant="light"
              >
                {selectedScorecard.overall.status === "pass"
                  ? "Pass"
                  : selectedScorecard.overall.status === "needs_improvement"
                    ? "Needs Work"
                    : "Fail"}
              </Badge>
            </div>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="incident-clock-label">Total Duration</div>
          <div className="duration-display">
            {formatIncidentClock(effectiveDuration)}
          </div>
        </div>

        <button
          className="close-button"
          onClick={onClose}
          aria-label="Close review mode"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Content */}
      <div className="review-main">
        {/* Transcript Panel */}
        <div className="transcript-panel">
          <div
            className="transcript-scroll"
            ref={transcriptRef}
            onScroll={handleScroll}
          >
            {segments.map((segment, index) => {
              const segmentEvidence = getEvidenceForSegment(index, evidenceMap);
              const hasEvidence = segmentEvidence.length > 0;
              const annotations = annotationsBySegment?.get(index) ?? [];
              const hasAnnotations = annotations.length > 0;

              return (
                <div
                  key={segment.index}
                  data-segment-index={index}
                  className={`transcript-segment ${index === activeSegmentIndex ? "active" : ""} ${hasEvidence ? "has-evidence" : ""}`}
                  onClick={() => handleSegmentClick(index)}
                  style={{
                    borderRightWidth: hasEvidence ? "4px" : undefined,
                    borderRightStyle: hasEvidence ? "solid" : undefined,
                    borderRightColor: hasEvidence
                      ? getVerdictColor(segmentEvidence[0].verdict)
                      : undefined,
                    backgroundColor: hasAnnotations
                      ? "var(--review-teal-dim)"
                      : undefined,
                    borderLeftColor: hasAnnotations
                      ? "var(--review-teal)"
                      : undefined,
                  }}
                >
                  <div className="segment-meta">
                    <span className="segment-timestamp">
                      [{formatSegmentTime(segment.start)}]
                    </span>
                    {segment.speaker && (
                      <span className="segment-speaker">{segment.speaker}</span>
                    )}
                    {/* Annotation indicator */}
                    {hasAnnotations && (
                      <Tooltip
                        label={`${annotations.length} annotation${annotations.length > 1 ? "s" : ""}`}
                        withArrow
                      >
                        <Badge
                          size="xs"
                          variant="light"
                          color="teal"
                          style={{ cursor: "pointer" }}
                          leftSection={<StickyNote size={10} />}
                        >
                          {annotations.length}
                        </Badge>
                      </Tooltip>
                    )}
                    {/* Evidence markers */}
                    {hasEvidence && (
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          marginLeft: hasAnnotations ? 0 : "auto",
                        }}
                      >
                        {segmentEvidence.slice(0, 3).map((marker, idx) => (
                          <Tooltip
                            key={`${marker.criterionId}-${idx}`}
                            label={`${marker.criterionTitle}: ${marker.verdict}`}
                            withArrow
                          >
                            <Badge
                              size="xs"
                              variant="light"
                              color={
                                marker.verdict === "met"
                                  ? "green"
                                  : marker.verdict === "missed"
                                    ? "red"
                                    : marker.verdict === "partial"
                                      ? "yellow"
                                      : "gray"
                              }
                              style={{ cursor: "pointer" }}
                            >
                              {marker.verdict === "met" ? (
                                <CheckCircle2 size={10} />
                              ) : marker.verdict === "missed" ? (
                                <XCircle size={10} />
                              ) : marker.verdict === "partial" ? (
                                <AlertTriangle size={10} />
                              ) : (
                                <FileSearch size={10} />
                              )}
                            </Badge>
                          </Tooltip>
                        ))}
                        {segmentEvidence.length > 3 && (
                          <Badge size="xs" variant="outline" color="gray">
                            +{segmentEvidence.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="segment-text">{segment.text}</div>
                  {/* Annotation text display */}
                  {hasAnnotations && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: "1px dashed var(--review-teal)",
                      }}
                    >
                      {annotations.map((ann) => (
                        <div
                          key={ann.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <StickyNote
                            size={14}
                            style={{
                              color: "var(--review-teal)",
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          />
                          <Text
                            size="sm"
                            style={{
                              color: "var(--review-teal)",
                              fontStyle: "italic",
                              fontFamily: "inherit",
                            }}
                          >
                            {ann.text}
                          </Text>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scorecard Sidebar - shows full scorecard overlay when selected */}
        {showBenchmarks && selectedScorecard && (
          <div className="review-sidebar">
            <ScorecardOverlayPanel
              scorecard={selectedScorecard}
              onCriterionClick={handleCriterionClick}
              currentTime={currentTime}
            />
          </div>
        )}

        {/* Fallback: Timing Benchmarks (when no scorecard but rubric exists) */}
        {showBenchmarks && !selectedScorecard && benchmarks.length > 0 && (
          <div className="review-sidebar">
            <div className="sidebar-header">
              <div className="sidebar-title">Timing Benchmarks</div>
            </div>
            <div className="benchmarks-list">
              {benchmarks.map((benchmark) => (
                <div key={benchmark.id} className="benchmark-item">
                  <div className="benchmark-header">
                    <span className="benchmark-title">{benchmark.title}</span>
                    <span
                      style={{ color: getBenchmarkColor(benchmark.status) }}
                    >
                      {getBenchmarkIcon(benchmark.status)}
                    </span>
                  </div>
                  <div className="benchmark-times">
                    <span className="benchmark-target">
                      Target: {formatSegmentTime(benchmark.targetSeconds)}
                    </span>
                    {benchmark.actualSeconds !== undefined && (
                      <>
                        <span
                          className="benchmark-actual"
                          style={{ color: getBenchmarkColor(benchmark.status) }}
                        >
                          Actual: {formatSegmentTime(benchmark.actualSeconds)}
                        </span>
                        {benchmark.delta !== undefined && (
                          <span
                            className="benchmark-delta"
                            style={{
                              backgroundColor:
                                benchmark.status === "met"
                                  ? "rgba(34, 197, 94, 0.2)"
                                  : benchmark.status === "close"
                                    ? "rgba(245, 158, 11, 0.2)"
                                    : "rgba(239, 68, 68, 0.2)",
                              color: getBenchmarkColor(benchmark.status),
                            }}
                          >
                            {benchmark.delta > 0 ? "+" : ""}
                            {benchmark.delta}s
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="review-controls">
        {/* Timeline */}
        <div className="timeline-bar">
          <div
            className="timeline-progress"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Benchmark markers on timeline */}
        {showBenchmarks && benchmarks.length > 0 && effectiveDuration > 0 && (
          <div className="timeline-markers">
            {benchmarks.map((benchmark) => {
              const position =
                (benchmark.targetSeconds / effectiveDuration) * 100;
              if (position > 100) return null;
              return (
                <div
                  key={benchmark.id}
                  className="timeline-marker"
                  style={{ left: `${position}%` }}
                  title={`${benchmark.title}: ${formatSegmentTime(benchmark.targetSeconds)}`}
                >
                  <div
                    className="marker-line"
                    style={{
                      backgroundColor: getBenchmarkColor(benchmark.status),
                    }}
                  />
                  <span
                    className="marker-label"
                    style={{ color: getBenchmarkColor(benchmark.status) }}
                  >
                    {formatSegmentTime(benchmark.targetSeconds)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="controls-row" style={{ marginTop: 20 }}>
          {/* Previous transmission */}
          <Tooltip label="Previous transmission (Shift + Left)" withArrow>
            <button
              className="nav-button"
              onClick={skipToPrevTransmission}
              disabled={activeSegmentIndex <= 0}
              aria-label="Previous transmission"
            >
              <SkipBack size={20} />
            </button>
          </Tooltip>

          {/* Play/Pause */}
          <Tooltip
            label={isPlaying ? "Pause (Space)" : "Play (Space)"}
            withArrow
          >
            <button
              className="play-button"
              onClick={controls.togglePlayPause}
              disabled={isLoading}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause size={32} />
              ) : (
                <Play size={32} style={{ marginLeft: 4 }} />
              )}
            </button>
          </Tooltip>

          {/* Next transmission */}
          <Tooltip label="Next transmission (Shift + Right)" withArrow>
            <button
              className="nav-button"
              onClick={skipToNextTransmission}
              disabled={activeSegmentIndex >= segments.length - 1}
              aria-label="Next transmission"
            >
              <SkipForward size={20} />
            </button>
          </Tooltip>

          {/* Speed buttons */}
          <div className="speed-buttons">
            {SPEED_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`speed-button ${speed === option.value ? "active" : ""}`}
                onClick={() => controls.setSpeed(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Volume control */}
          <div className="volume-control">
            <Tooltip label={muted ? "Unmute (M)" : "Mute (M)"} withArrow>
              <button
                className="nav-button"
                onClick={controls.toggleMute}
                style={{ width: 44, height: 44 }}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </Tooltip>
            <Slider
              value={muted ? 0 : volume}
              onChange={controls.setVolume}
              max={1}
              step={0.01}
              style={{ width: 100 }}
              aria-label={`Volume: ${Math.round(volume * 100)}%`}
              styles={{
                track: { backgroundColor: "var(--review-border)" },
                bar: { backgroundColor: "var(--review-amber)" },
                thumb: {
                  backgroundColor: "var(--review-amber)",
                  borderColor: "var(--review-amber)",
                },
              }}
            />
          </div>

          {/* Settings button */}
          <Tooltip label="Audio settings" withArrow>
            <button
              className="nav-button"
              onClick={openAudioControls}
              style={{
                width: 44,
                height: 44,
                backgroundColor:
                  enhancement.highPassEnabled ||
                  enhancement.compressorEnabled ||
                  enhancement.volumeBoost > 1
                    ? "var(--review-amber)"
                    : undefined,
                color:
                  enhancement.highPassEnabled ||
                  enhancement.compressorEnabled ||
                  enhancement.volumeBoost > 1
                    ? "var(--review-bg)"
                    : undefined,
              }}
              aria-label="Audio settings"
            >
              <Settings size={18} />
            </button>
          </Tooltip>

          {/* Toggle scorecard/benchmarks panel (if available) */}
          {(selectedScorecard || benchmarks.length > 0) && (
            <Tooltip
              label={
                showBenchmarks ? "Hide scorecard panel" : "Show scorecard panel"
              }
              withArrow
            >
              <button
                className="nav-button"
                onClick={() => setShowBenchmarks(!showBenchmarks)}
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: showBenchmarks
                    ? "var(--review-amber)"
                    : undefined,
                  color: showBenchmarks ? "var(--review-bg)" : undefined,
                }}
                aria-label={
                  showBenchmarks
                    ? "Hide scorecard panel"
                    : "Show scorecard panel"
                }
              >
                <Target size={18} />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Keyboard shortcuts hint */}
        <Text
          size="xs"
          ta="center"
          mt="md"
          style={{ color: "var(--review-text-dim)", fontFamily: "inherit" }}
        >
          Space: play/pause | Arrows: skip 5s | Shift+Arrows: prev/next
          transmission | M: mute | Esc: close
        </Text>
      </div>

      {/* Hidden waveform player for audio sync */}
      <Box
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          height: 0,
        }}
      >
        <WaveformPlayer
          audioUrl={audioUrl}
          cacheKey={cacheKey}
          onReady={registerWaveSurfer}
          showZoomControls={false}
        />
      </Box>

      {/* Audio Controls Modal - needs higher z-index than the review overlay */}
      <AudioControlsModal
        opened={audioControlsOpened}
        onClose={closeAudioControls}
        enhancement={enhancement}
        controls={controls}
        zIndex={10000}
      />
    </Box>
  );

  return createPortal(content, document.body);
}

export default InteractiveReviewMode;
