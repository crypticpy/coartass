/**
 * Annotation Badge Component
 *
 * A small indicator showing that a transcript segment has annotations.
 * Displays a note icon with tooltip preview on hover.
 */

"use client";

import { Badge, Tooltip, Group } from "@mantine/core";
import { StickyNote } from "lucide-react";
import type { TranscriptAnnotation } from "@/types/annotation";
import { formatAnnotationTimestamp } from "@/types/annotation";

export interface AnnotationBadgeProps {
  /** The annotation(s) to display */
  annotations: TranscriptAnnotation[];
  /** Callback when the badge is clicked */
  onClick?: () => void;
  /** Size variant */
  size?: "xs" | "sm" | "md";
}

/**
 * A badge indicator for segments with annotations.
 *
 * Shows a note icon with a count (if multiple annotations) and
 * displays a tooltip with the annotation text(s) on hover.
 */
export function AnnotationBadge({
  annotations,
  onClick,
  size = "xs",
}: AnnotationBadgeProps) {
  if (!annotations || annotations.length === 0) {
    return null;
  }

  const count = annotations.length;
  const hasMultiple = count > 1;

  // Build tooltip content
  const tooltipContent = annotations
    .map((ann) => {
      const time = formatAnnotationTimestamp(ann.timestamp);
      const preview =
        ann.text.length > 100 ? `${ann.text.slice(0, 100)}...` : ann.text;
      return `[${time}] ${preview}`;
    })
    .join("\n\n");

  return (
    <Tooltip
      label={tooltipContent}
      multiline
      maw={300}
      withArrow
      position="top"
      style={{ whiteSpace: "pre-wrap" }}
    >
      <Badge
        size={size}
        variant="light"
        color="cyan"
        leftSection={<StickyNote size={12} />}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        style={{ cursor: onClick ? "pointer" : "default" }}
        aria-label={`${count} annotation${hasMultiple ? "s" : ""}`}
      >
        {hasMultiple ? count : "Note"}
      </Badge>
    </Tooltip>
  );
}

/**
 * Compact annotation indicator for tight spaces.
 * Shows just the icon without text.
 */
export function AnnotationIndicator({
  annotations,
  onClick,
}: Pick<AnnotationBadgeProps, "annotations" | "onClick">) {
  if (!annotations || annotations.length === 0) {
    return null;
  }

  const count = annotations.length;
  const hasMultiple = count > 1;

  const tooltipContent = annotations
    .map((ann) => {
      const time = formatAnnotationTimestamp(ann.timestamp);
      const preview =
        ann.text.length > 80 ? `${ann.text.slice(0, 80)}...` : ann.text;
      return `[${time}] ${preview}`;
    })
    .join("\n\n");

  return (
    <Tooltip
      label={tooltipContent}
      multiline
      maw={280}
      withArrow
      position="top"
      style={{ whiteSpace: "pre-wrap" }}
    >
      <Group
        gap={2}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        style={{
          cursor: onClick ? "pointer" : "default",
          color: "var(--mantine-color-cyan-6)",
        }}
        aria-label={`${count} annotation${hasMultiple ? "s" : ""}`}
      >
        <StickyNote size={14} />
        {hasMultiple && (
          <span style={{ fontSize: 10, fontWeight: 600 }}>{count}</span>
        )}
      </Group>
    </Tooltip>
  );
}
