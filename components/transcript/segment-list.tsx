/**
 * Segment List Component
 *
 * Displays transcript segments with timestamps in a virtualized,
 * scrollable list with search highlighting and navigation support.
 * Supports annotation badges and "Add Note" functionality.
 */

"use no memo";
"use client";

import React, { useRef, useEffect, useState, useCallback, memo } from "react";
import {
  Box,
  Text,
  Badge,
  Stack,
  ScrollArea,
  Center,
  ActionIcon,
  Tooltip,
  Group,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Plus } from "lucide-react";
import { formatTimestamp, highlightText } from "@/lib/transcript-utils";
import type { TranscriptSegment } from "@/types/transcript";
import type { TranscriptAnnotation } from "@/types/annotation";
import { AnnotationIndicator } from "./annotation-badge";

// Fixed notification ID to prevent stacking when rapidly clicking segments
const SEEK_NOTIFICATION_ID = "segment-seek";

export interface SegmentListProps {
  /** Array of transcript segments to display */
  segments: TranscriptSegment[];
  /** Optional search query for highlighting */
  searchQuery?: string;
  /** Index of currently highlighted segment */
  activeSegmentIndex?: number;
  /** Callback when a segment is clicked */
  onSegmentClick?: (index: number) => void;
  /** Optional className for styling */
  className?: string;
  /** Current match index for search highlighting */
  currentMatchIndex?: number;
  /** Map of segment index to annotations at that segment */
  annotationsBySegment?: Map<number, TranscriptAnnotation[]>;
  /** Callback when user wants to add an annotation at a segment */
  onAddAnnotation?: (segmentIndex: number, timestamp: number) => void;
  /** Callback when user clicks an annotation indicator */
  onAnnotationClick?: (segmentIndex: number) => void;
  /** Whether to show annotation UI (add button, indicators) */
  showAnnotations?: boolean;
}

/**
 * Individual segment item component
 */
interface SegmentItemProps {
  segment: TranscriptSegment;
  isActive?: boolean;
  searchQuery?: string;
  currentMatchIndex?: number;
  onClick?: () => void;
  /** Annotations for this segment */
  annotations?: TranscriptAnnotation[];
  /** Whether to show annotation UI */
  showAnnotations?: boolean;
  /** Callback when "Add Note" is clicked */
  onAddAnnotation?: () => void;
  /** Callback when annotation indicator is clicked */
  onAnnotationClick?: () => void;
}

const SegmentItem = memo(
  function SegmentItem({
    segment,
    isActive,
    searchQuery,
    currentMatchIndex,
    onClick,
    annotations,
    showAnnotations = false,
    onAddAnnotation,
    onAnnotationClick,
  }: SegmentItemProps) {
    const itemRef = useRef<HTMLDivElement>(null);
    const [isClicked, setIsClicked] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const hasAnnotations = annotations && annotations.length > 0;

    // Scroll into view when active
    useEffect(() => {
      if (isActive && itemRef.current) {
        itemRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }, [isActive]);

    // Cleanup click animation timeout on unmount
    useEffect(() => {
      return () => {
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
        }
      };
    }, []);

    const timestamp = formatTimestamp(segment.start);
    const hasSearchQuery = searchQuery && searchQuery.length > 0;

    const handleClick = () => {
      if (onClick) {
        // Trigger click animation with cleanup
        setIsClicked(true);
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
        }
        clickTimeoutRef.current = setTimeout(() => setIsClicked(false), 300);
        onClick();
      }
    };

    return (
      <Box
        ref={itemRef}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="listitem"
        tabIndex={0}
        aria-label={`${segment.speaker ? `${segment.speaker}, ` : ""}Jump to ${timestamp}${isActive ? ", currently playing" : ""}${hasAnnotations ? ", has notes" : ""}`}
        aria-current={isActive ? "true" : undefined}
        p="md"
        className="segment-item"
        style={{
          display: "flex",
          gap: "var(--mantine-spacing-md)",
          borderRadius: "var(--mantine-radius-md)",
          border: isActive
            ? "1px solid var(--mantine-color-default-border)"
            : hasAnnotations
              ? "1px solid var(--mantine-color-cyan-3)"
              : "1px solid transparent",
          backgroundColor: isActive
            ? "var(--mantine-color-default-hover)"
            : "var(--mantine-color-default)",
          cursor: onClick ? "pointer" : "default",
          transition: "all 150ms ease",
          minHeight: 60,
          position: "relative",
          overflow: "hidden",
          touchAction: "manipulation",
          ...(isClicked && {
            animation: "pulse 300ms ease-in-out",
          }),
        }}
      >
        {/* Ripple effect overlay */}
        {isClicked && (
          <Box
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "var(--aph-blue)",
              opacity: 0.1,
              animation: "fade-in 300ms ease-in-out",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Timestamp and Annotation Controls */}
        <Box
          style={{
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 4,
            paddingTop: 2,
          }}
        >
          <Text
            component="time"
            size="sm"
            fw={500}
            c={isActive ? "blue" : "dimmed"}
            dateTime={`PT${segment.start}S`}
            style={{
              fontFamily: "var(--mantine-font-family-monospace)",
              fontVariantNumeric: "tabular-nums",
              minWidth: 55,
            }}
          >
            {timestamp}
          </Text>

          {/* Annotation indicator and Add Note button */}
          {showAnnotations && (
            <Group gap={4} wrap="nowrap">
              {hasAnnotations && (
                <AnnotationIndicator
                  annotations={annotations}
                  onClick={onAnnotationClick}
                />
              )}
              {(isHovered || isActive) && onAddAnnotation && (
                <Tooltip label="Add note">
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="cyan"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddAnnotation();
                    }}
                    aria-label="Add annotation"
                  >
                    <Plus size={12} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          )}
        </Box>

        {/* Text Content */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text
            size="sm"
            style={{
              lineHeight: 1.6,
              color: "var(--mantine-color-text)",
              fontWeight: isActive ? 500 : 400,
            }}
          >
            {hasSearchQuery
              ? highlightText(segment.text, searchQuery, currentMatchIndex)
              : segment.text}
          </Text>

          {/* Speaker Info (if available) */}
          {segment.speaker && (
            <Badge
              variant="light"
              color="blue"
              size="sm"
              mt="xs"
              aria-label={`Speaker: ${segment.speaker}`}
            >
              {segment.speaker}
            </Badge>
          )}
        </Box>
      </Box>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if segment data or active state changes
    return (
      prevProps.segment.index === nextProps.segment.index &&
      prevProps.segment.text === nextProps.segment.text &&
      prevProps.segment.start === nextProps.segment.start &&
      prevProps.isActive === nextProps.isActive &&
      prevProps.searchQuery === nextProps.searchQuery &&
      prevProps.currentMatchIndex === nextProps.currentMatchIndex &&
      prevProps.onClick === nextProps.onClick &&
      prevProps.annotations === nextProps.annotations &&
      prevProps.showAnnotations === nextProps.showAnnotations &&
      prevProps.onAddAnnotation === nextProps.onAddAnnotation &&
      prevProps.onAnnotationClick === nextProps.onAnnotationClick
    );
  },
);

/**
 * Virtualized segment list component for large segment arrays
 * Uses @tanstack/react-virtual for efficient rendering
 */
const VirtualizedSegmentList = memo(
  function VirtualizedSegmentList({
    segments,
    searchQuery,
    activeSegmentIndex,
    onSegmentClick,
    className,
    currentMatchIndex,
    annotationsBySegment,
    onAddAnnotation,
    onAnnotationClick,
    showAnnotations = false,
  }: SegmentListProps) {
    const parentRef = useRef<HTMLDivElement>(null);

    // Initialize virtualizer
    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is incompatible with React Compiler; file uses 'use no memo'
    const rowVirtualizer = useVirtualizer({
      count: segments.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 80, // Estimated height of each segment item
      overscan: 10, // Render 10 extra items above/below viewport for smooth scrolling
    });

    // Handle segment click
    const handleSegmentClick = useCallback(
      (index: number) => {
        if (onSegmentClick) {
          const segment = segments.find((s) => s.index === index);
          if (segment) {
            const timestamp = formatTimestamp(segment.start);
            notifications.show({
              id: SEEK_NOTIFICATION_ID,
              title: `Seeking to ${timestamp}`,
              message:
                segment.text.slice(0, 60) +
                (segment.text.length > 60 ? "..." : ""),
              autoClose: 1500,
              color: "blue",
            });
          }
          onSegmentClick(index);
        }
      },
      [onSegmentClick, segments],
    );

    // Auto-scroll to active segment
    useEffect(() => {
      if (activeSegmentIndex !== undefined && activeSegmentIndex !== null) {
        const segmentArrayIndex = segments.findIndex(
          (s) => s.index === activeSegmentIndex,
        );
        if (segmentArrayIndex !== -1) {
          // Check if this is a distant jump (more than 20 segments away from visible area)
          const virtualItems = rowVirtualizer.getVirtualItems();
          const firstVisibleIndex = virtualItems[0]?.index ?? 0;
          const isDistantJump =
            Math.abs(segmentArrayIndex - firstVisibleIndex) > 20;

          // Use instant scroll for distant jumps - smooth scroll fails for unrendered items
          rowVirtualizer.scrollToIndex(segmentArrayIndex, {
            align: "center",
            behavior: isDistantJump ? "auto" : "smooth",
          });
        }
      }
    }, [activeSegmentIndex, segments, rowVirtualizer]);

    // Keyboard navigation with j/k keys
    useEffect(() => {
      if (!onSegmentClick || segments.length === 0) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        // Don't handle if user is typing in an input
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) {
          return;
        }

        const currentIndex = activeSegmentIndex ?? -1;

        if (e.key === "j" || e.key === "J") {
          // Next segment
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, segments.length - 1);
          if (nextIndex !== currentIndex) {
            handleSegmentClick(segments[nextIndex].index);
          }
        } else if (e.key === "k" || e.key === "K") {
          // Previous segment
          e.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          if (prevIndex !== currentIndex) {
            handleSegmentClick(segments[prevIndex].index);
          }
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [segments, activeSegmentIndex, handleSegmentClick, onSegmentClick]);

    return (
      <div
        ref={parentRef}
        className={className}
        role="list"
        aria-label="Transcript segments"
        style={{
          height: "600px",
          overflow: "auto",
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const segment = segments[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: "8px", // Gap between segments
                }}
              >
                <SegmentItem
                  segment={segment}
                  isActive={activeSegmentIndex === segment.index}
                  searchQuery={searchQuery}
                  currentMatchIndex={currentMatchIndex}
                  onClick={
                    onSegmentClick
                      ? () => handleSegmentClick(segment.index)
                      : undefined
                  }
                  annotations={annotationsBySegment?.get(segment.index)}
                  showAnnotations={showAnnotations}
                  onAddAnnotation={
                    onAddAnnotation
                      ? () => onAddAnnotation(segment.index, segment.start)
                      : undefined
                  }
                  onAnnotationClick={
                    onAnnotationClick
                      ? () => onAnnotationClick(segment.index)
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.segments === nextProps.segments &&
      prevProps.searchQuery === nextProps.searchQuery &&
      prevProps.activeSegmentIndex === nextProps.activeSegmentIndex &&
      prevProps.currentMatchIndex === nextProps.currentMatchIndex &&
      prevProps.onSegmentClick === nextProps.onSegmentClick &&
      prevProps.annotationsBySegment === nextProps.annotationsBySegment &&
      prevProps.showAnnotations === nextProps.showAnnotations &&
      prevProps.onAddAnnotation === nextProps.onAddAnnotation &&
      prevProps.onAnnotationClick === nextProps.onAnnotationClick
    );
  },
);

/**
 * Segment list component with virtualization support
 *
 * Displays all transcript segments in a scrollable list with:
 * - Timestamp formatting
 * - Search highlighting
 * - Click to navigate
 * - Smooth scrolling to active segment
 * - Keyboard navigation support
 * - Automatic virtualization for lists with >50 segments
 *
 * @example
 * ```tsx
 * <SegmentList
 *   segments={transcript.segments}
 *   searchQuery={search.searchQuery}
 *   activeSegmentIndex={currentSegment}
 *   onSegmentClick={handleSegmentClick}
 * />
 * ```
 */
export const SegmentList = memo(
  function SegmentList({
    segments,
    searchQuery,
    activeSegmentIndex,
    onSegmentClick,
    className,
    currentMatchIndex,
    annotationsBySegment,
    onAddAnnotation,
    onAnnotationClick,
    showAnnotations = false,
  }: SegmentListProps) {
    const handleSegmentClick = useCallback(
      (index: number) => {
        if (onSegmentClick) {
          const segment = segments.find((s) => s.index === index);
          if (segment) {
            const timestamp = formatTimestamp(segment.start);
            notifications.show({
              id: SEEK_NOTIFICATION_ID,
              title: `Seeking to ${timestamp}`,
              message:
                segment.text.slice(0, 60) +
                (segment.text.length > 60 ? "..." : ""),
              autoClose: 1500,
              color: "blue",
            });
          }
          onSegmentClick(index);
        }
      },
      [onSegmentClick, segments],
    );

    // Keyboard navigation with j/k keys
    useEffect(() => {
      if (!onSegmentClick || segments.length === 0) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        // Don't handle if user is typing in an input
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) {
          return;
        }

        const currentIndex = activeSegmentIndex ?? -1;

        if (e.key === "j" || e.key === "J") {
          // Next segment
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, segments.length - 1);
          if (nextIndex !== currentIndex) {
            handleSegmentClick(segments[nextIndex].index);
          }
        } else if (e.key === "k" || e.key === "K") {
          // Previous segment
          e.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          if (prevIndex !== currentIndex) {
            handleSegmentClick(segments[prevIndex].index);
          }
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [segments, activeSegmentIndex, handleSegmentClick, onSegmentClick]);

    if (!segments || segments.length === 0) {
      return (
        <Center className={className} py="xl">
          <Text size="sm" c="dimmed">
            No transcript segments available
          </Text>
        </Center>
      );
    }

    // Use virtualization for large lists (>50 segments)
    if (segments.length > 50) {
      return (
        <VirtualizedSegmentList
          segments={segments}
          searchQuery={searchQuery}
          activeSegmentIndex={activeSegmentIndex}
          currentMatchIndex={currentMatchIndex}
          onSegmentClick={onSegmentClick}
          className={className}
          annotationsBySegment={annotationsBySegment}
          onAddAnnotation={onAddAnnotation}
          onAnnotationClick={onAnnotationClick}
          showAnnotations={showAnnotations}
        />
      );
    }

    // Use regular rendering for small lists (<=50 segments)
    return (
      <ScrollArea
        className={className}
        type="auto"
        offsetScrollbars
        role="list"
        aria-label="Transcript segments"
      >
        <Stack gap="sm">
          {segments.map((segment) => (
            <SegmentItem
              key={segment.index}
              segment={segment}
              isActive={activeSegmentIndex === segment.index}
              searchQuery={searchQuery}
              currentMatchIndex={currentMatchIndex}
              onClick={
                onSegmentClick
                  ? () => handleSegmentClick(segment.index)
                  : undefined
              }
              annotations={annotationsBySegment?.get(segment.index)}
              showAnnotations={showAnnotations}
              onAddAnnotation={
                onAddAnnotation
                  ? () => onAddAnnotation(segment.index, segment.start)
                  : undefined
              }
              onAnnotationClick={
                onAnnotationClick
                  ? () => onAnnotationClick(segment.index)
                  : undefined
              }
            />
          ))}
        </Stack>
      </ScrollArea>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if segments array or search changes
    return (
      prevProps.segments === nextProps.segments &&
      prevProps.searchQuery === nextProps.searchQuery &&
      prevProps.activeSegmentIndex === nextProps.activeSegmentIndex &&
      prevProps.currentMatchIndex === nextProps.currentMatchIndex &&
      prevProps.onSegmentClick === nextProps.onSegmentClick &&
      prevProps.annotationsBySegment === nextProps.annotationsBySegment &&
      prevProps.showAnnotations === nextProps.showAnnotations &&
      prevProps.onAddAnnotation === nextProps.onAddAnnotation &&
      prevProps.onAnnotationClick === nextProps.onAnnotationClick
    );
  },
);

/**
 * Virtualized compact segment list for mobile or sidebars with large segment counts
 */
const VirtualizedCompactSegmentList = memo(
  function VirtualizedCompactSegmentList({
    segments,
    searchQuery,
    activeSegmentIndex,
    onSegmentClick,
    className,
  }: SegmentListProps) {
    const parentRef = useRef<HTMLDivElement>(null);

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is incompatible with React Compiler; file uses 'use no memo'
    const rowVirtualizer = useVirtualizer({
      count: segments.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 60, // Compact segments are smaller
      overscan: 10,
    });

    // Auto-scroll to active segment
    useEffect(() => {
      if (activeSegmentIndex !== undefined && activeSegmentIndex !== null) {
        const segmentArrayIndex = segments.findIndex(
          (s) => s.index === activeSegmentIndex,
        );
        if (segmentArrayIndex !== -1) {
          // Check if this is a distant jump (more than 20 segments away from visible area)
          const virtualItems = rowVirtualizer.getVirtualItems();
          const firstVisibleIndex = virtualItems[0]?.index ?? 0;
          const isDistantJump =
            Math.abs(segmentArrayIndex - firstVisibleIndex) > 20;

          // Use instant scroll for distant jumps - smooth scroll fails for unrendered items
          rowVirtualizer.scrollToIndex(segmentArrayIndex, {
            align: "center",
            behavior: isDistantJump ? "auto" : "smooth",
          });
        }
      }
    }, [activeSegmentIndex, segments, rowVirtualizer]);

    return (
      <div
        ref={parentRef}
        className={className}
        role="list"
        aria-label="Transcript segments"
        style={{
          height: "400px",
          overflow: "auto",
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const segment = segments[virtualRow.index];
            const isActive = activeSegmentIndex === segment.index;
            const timestamp = formatTimestamp(segment.start);

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: "4px",
                }}
              >
                <Box
                  onClick={() => onSegmentClick?.(segment.index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSegmentClick?.(segment.index);
                    }
                  }}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`Segment at ${timestamp}`}
                  aria-current={isActive ? "true" : undefined}
                  p="sm"
                  className="compact-segment-item"
                  style={{
                    borderRadius: "var(--mantine-radius-sm)",
                    cursor: "pointer",
                    transition: "background-color 150ms ease",
                    backgroundColor: isActive
                      ? "var(--mantine-color-default-hover)"
                      : "transparent",
                    borderLeft: isActive ? "2px solid var(--aph-blue)" : "none",
                    paddingLeft: isActive
                      ? "calc(var(--mantine-spacing-sm) - 2px)"
                      : "var(--mantine-spacing-sm)",
                  }}
                >
                  <Text
                    component="time"
                    size="xs"
                    c="dimmed"
                    mb={4}
                    style={{
                      fontFamily: "var(--mantine-font-family-monospace)",
                      display: "block",
                    }}
                  >
                    {timestamp}
                  </Text>
                  <Text size="xs" lineClamp={2}>
                    {searchQuery
                      ? highlightText(segment.text, searchQuery)
                      : segment.text}
                  </Text>
                </Box>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.segments === nextProps.segments &&
      prevProps.searchQuery === nextProps.searchQuery &&
      prevProps.activeSegmentIndex === nextProps.activeSegmentIndex &&
      prevProps.onSegmentClick === nextProps.onSegmentClick
    );
  },
);

/**
 * Compact segment list variant for mobile or sidebars
 */
export const CompactSegmentList = memo(
  function CompactSegmentList({
    segments,
    searchQuery,
    activeSegmentIndex,
    onSegmentClick,
    className,
  }: SegmentListProps) {
    if (segments.length === 0) {
      return (
        <Box p="md" style={{ textAlign: "center" }}>
          <Text size="sm" c="dimmed">
            No segments
          </Text>
        </Box>
      );
    }

    // Use virtualization for large lists (>50 segments)
    if (segments.length > 50) {
      return (
        <VirtualizedCompactSegmentList
          segments={segments}
          searchQuery={searchQuery}
          activeSegmentIndex={activeSegmentIndex}
          onSegmentClick={onSegmentClick}
          className={className}
        />
      );
    }

    return (
      <ScrollArea
        className={className}
        type="auto"
        role="list"
        aria-label="Transcript segments"
      >
        <Stack gap="xs">
          {segments.map((segment) => {
            const isActive = activeSegmentIndex === segment.index;
            const timestamp = formatTimestamp(segment.start);

            return (
              <Box
                key={segment.index}
                onClick={() => onSegmentClick?.(segment.index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSegmentClick?.(segment.index);
                  }
                }}
                role="listitem"
                tabIndex={0}
                aria-label={`Segment at ${timestamp}`}
                aria-current={isActive ? "true" : undefined}
                p="sm"
                className="compact-segment-item"
                style={{
                  borderRadius: "var(--mantine-radius-sm)",
                  cursor: "pointer",
                  transition: "background-color 150ms ease",
                  backgroundColor: isActive
                    ? "var(--mantine-color-default-hover)"
                    : "transparent",
                  borderLeft: isActive ? "2px solid var(--aph-blue)" : "none",
                  paddingLeft: isActive
                    ? "calc(var(--mantine-spacing-sm) - 2px)"
                    : "var(--mantine-spacing-sm)",
                }}
              >
                <Text
                  component="time"
                  size="xs"
                  c="dimmed"
                  mb={4}
                  style={{
                    fontFamily: "var(--mantine-font-family-monospace)",
                    display: "block",
                  }}
                >
                  {timestamp}
                </Text>
                <Text size="xs" lineClamp={2}>
                  {searchQuery
                    ? highlightText(segment.text, searchQuery)
                    : segment.text}
                </Text>
              </Box>
            );
          })}
        </Stack>
      </ScrollArea>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if segments or search changes
    return (
      prevProps.segments === nextProps.segments &&
      prevProps.searchQuery === nextProps.searchQuery &&
      prevProps.activeSegmentIndex === nextProps.activeSegmentIndex &&
      prevProps.onSegmentClick === nextProps.onSegmentClick
    );
  },
);

/**
 * Segment list with grouping by time intervals (e.g., every 5 minutes)
 */
export interface GroupedSegmentListProps extends SegmentListProps {
  /** Group interval in seconds (default: 300 = 5 minutes) */
  groupInterval?: number;
}

export const GroupedSegmentList = memo(
  function GroupedSegmentList({
    segments,
    searchQuery,
    activeSegmentIndex,
    onSegmentClick,
    groupInterval = 300,
    className,
  }: GroupedSegmentListProps) {
    // Group segments by time intervals
    const groupedSegments = React.useMemo(() => {
      const groups: Map<number, TranscriptSegment[]> = new Map();

      segments.forEach((segment) => {
        const groupKey = Math.floor(segment.start / groupInterval);
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(segment);
      });

      return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
    }, [segments, groupInterval]);

    if (segments.length === 0) {
      return (
        <Box p="xl" style={{ textAlign: "center" }}>
          <Text size="sm" c="dimmed">
            No segments available
          </Text>
        </Box>
      );
    }

    return (
      <ScrollArea
        className={className}
        type="auto"
        role="list"
        aria-label="Transcript segments grouped by time"
      >
        <Stack gap="xl">
          {groupedSegments.map(([groupKey, groupSegments]) => {
            const groupStartTime = groupKey * groupInterval;
            const groupLabel = formatTimestamp(groupStartTime);

            return (
              <Box key={groupKey}>
                {/* Group Header */}
                <Box
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    backgroundColor: "var(--mantine-color-body)",
                    backdropFilter: "blur(8px)",
                    paddingTop: "var(--mantine-spacing-sm)",
                    paddingBottom: "var(--mantine-spacing-sm)",
                    borderBottom:
                      "1px solid var(--mantine-color-default-border)",
                  }}
                >
                  <Text
                    size="xs"
                    fw={600}
                    c="dimmed"
                    tt="uppercase"
                    style={{ letterSpacing: "0.05em" }}
                  >
                    {groupLabel}
                  </Text>
                </Box>

                {/* Group Segments */}
                <Stack gap="sm" mt="sm">
                  {groupSegments.map((segment) => (
                    <SegmentItem
                      key={segment.index}
                      segment={segment}
                      isActive={activeSegmentIndex === segment.index}
                      searchQuery={searchQuery}
                      onClick={
                        onSegmentClick
                          ? () => onSegmentClick(segment.index)
                          : undefined
                      }
                    />
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </ScrollArea>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if segments, search, or groupInterval changes
    return (
      prevProps.segments === nextProps.segments &&
      prevProps.searchQuery === nextProps.searchQuery &&
      prevProps.activeSegmentIndex === nextProps.activeSegmentIndex &&
      prevProps.onSegmentClick === nextProps.onSegmentClick &&
      prevProps.groupInterval === nextProps.groupInterval
    );
  },
);
