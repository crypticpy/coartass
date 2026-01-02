/**
 * Strategy Badge Component
 *
 * Small, reusable component that displays which analysis strategy was used.
 * Shows strategy name, icon, selection mode (auto/manual), and metadata on hover.
 *
 * Features:
 * - Color-coded by strategy type
 * - Icon representation
 * - Tooltip with detailed metadata
 * - Auto/Manual selection indicator
 * - Compact design for headers/cards
 */

"use client";

import React from "react";
import { Badge, Group, Tooltip, Text, Stack, Divider, Box } from "@mantine/core";
import { Sparkles, Clock, Activity, TrendingUp } from "lucide-react";
import type { AnalysisStrategy } from "@/lib/analysis-strategy";
import { getStrategyMetadata } from "@/lib/analysis-strategy";
import type { AnalysisExecutionResult } from "@/lib/analysis-strategies";
import {
  getStrategyIcon,
  getStrategyColor,
  getStrategyName,
} from "@/lib/strategy-ui-utils";

/**
 * Props for StrategyBadge component
 */
export interface StrategyBadgeProps {
  /** The strategy that was used */
  strategy: AnalysisStrategy;

  /** Whether the strategy was auto-selected or manually chosen */
  wasAutoSelected?: boolean;

  /** Optional: Additional metadata from execution */
  metadata?: AnalysisExecutionResult["metadata"];

  /** Optional: Size of the badge */
  size?: "xs" | "sm" | "md" | "lg" | "xl";

  /** Optional: Variant style */
  variant?: "filled" | "light" | "outline" | "dot";

  /** Optional: Show icon */
  showIcon?: boolean;

  /** Optional: Show auto/manual indicator */
  showSelection?: boolean;
}

/**
 * Strategy Badge Component
 *
 * Displays a compact badge showing the strategy used with tooltip details.
 */
export function StrategyBadge({
  strategy,
  wasAutoSelected = false,
  metadata,
  size = "sm",
  variant = "light",
  showIcon = true,
  showSelection = true,
}: StrategyBadgeProps) {
  const strategyMeta = getStrategyMetadata(strategy);
  const color = getStrategyColor(strategy);
  const name = getStrategyName(strategy);

  // Build tooltip content
  const tooltipContent = (
    <Stack gap="xs" style={{ maxWidth: 280 }}>
      {/* Header */}
      <Group gap="xs">
        {getStrategyIcon(strategy, 18)}
        <Text fw={600} size="sm">
          {strategyMeta.name}
        </Text>
      </Group>

      <Divider />

      {/* Metadata */}
      <Stack gap="xs">
        <Group gap="xs" wrap="nowrap">
          <Clock size={14} style={{ flexShrink: 0 }} />
          <Text size="xs" c="dimmed">
            Processing Time:
          </Text>
          <Text size="xs" fw={600}>
            {metadata?.estimatedDuration || strategyMeta.speed}
          </Text>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Activity size={14} style={{ flexShrink: 0 }} />
          <Text size="xs" c="dimmed">
            API Calls:
          </Text>
          <Text size="xs" fw={600}>
            {strategyMeta.apiCalls}
          </Text>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <TrendingUp size={14} style={{ flexShrink: 0 }} />
          <Text size="xs" c="dimmed">
            Quality:
          </Text>
          <Text size="xs" fw={600}>
            {metadata?.quality || strategyMeta.quality}
          </Text>
        </Group>

        {metadata?.actualTokens && (
          <Group gap="xs" wrap="nowrap">
            <Text size="xs" c="dimmed">
              Transcript Tokens:
            </Text>
            <Text size="xs" fw={600}>
              {metadata.actualTokens.toLocaleString()}
            </Text>
          </Group>
        )}
      </Stack>

      <Divider />

      {/* Selection Mode */}
      <Group gap="xs">
        {wasAutoSelected ? (
          <>
            <Sparkles size={14} style={{ color: "var(--mantine-color-aphBlue-6)" }} />
            <Text size="xs" c="dimmed">
              Auto-selected based on transcript length
            </Text>
          </>
        ) : (
          <>
            <Text size="xs" c="dimmed">
              Manually selected by user
            </Text>
          </>
        )}
      </Group>

      {/* Description */}
      <Text size="xs" c="dimmed" style={{ lineHeight: 1.5 }}>
        {strategy === "basic" &&
          "Fast single-pass analysis. All sections analyzed together in one API call."}
        {strategy === "hybrid" &&
          "Balanced batched analysis. Related sections grouped with contextual linking."}
        {strategy === "advanced" &&
          "Deep contextual cascading. Each section builds on previous results with full cross-references."}
      </Text>
    </Stack>
  );

  return (
    <Tooltip
      label={tooltipContent}
      withArrow
      position="bottom"
      multiline
      w={280}
      transitionProps={{ transition: "fade", duration: 200 }}
    >
      <Badge
        size={size}
        variant={variant}
        color={color}
        radius="sm"
        leftSection={showIcon ? getStrategyIcon(strategy, 12) : undefined}
        style={{ cursor: "help" }}
      >
        <Group gap={4} wrap="nowrap">
          <Text component="span" size={size}>
            {name}
          </Text>
          {showSelection && (
            <>
              <Text component="span" c="dimmed" size="xs">
                •
              </Text>
              <Text component="span" size="xs" c="dimmed">
                {wasAutoSelected ? "Auto" : "Manual"}
              </Text>
            </>
          )}
        </Group>
      </Badge>
    </Tooltip>
  );
}

/**
 * Compact Strategy Icon Badge
 *
 * Even smaller variant that just shows the icon with tooltip.
 */
export interface StrategyIconBadgeProps {
  strategy: AnalysisStrategy;
  wasAutoSelected?: boolean;
  metadata?: AnalysisExecutionResult["metadata"];
  size?: number;
}

export function StrategyIconBadge({
  strategy,
  wasAutoSelected = false,
  metadata,
  size = 20,
}: StrategyIconBadgeProps) {
  const strategyMeta = getStrategyMetadata(strategy);
  const color = getStrategyColor(strategy);

  const tooltipContent = (
    <Stack gap={4}>
      <Text fw={600} size="sm">
        {strategyMeta.name}
      </Text>
      <Text size="xs" c="dimmed">
        {wasAutoSelected ? "Auto-selected" : "Manual selection"}
      </Text>
      <Group gap="xs" mt={4}>
        <Badge size="xs" variant="dot" color={color}>
          {metadata?.estimatedDuration || strategyMeta.speed}
        </Badge>
        <Badge size="xs" variant="dot" color={color}>
          {metadata?.quality || strategyMeta.quality}
        </Badge>
      </Group>
    </Stack>
  );

  return (
    <Tooltip label={tooltipContent} withArrow position="bottom" transitionProps={{ transition: "fade", duration: 200 }}>
      <Box
        component="span"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: `var(--mantine-color-${color}-1)`,
          color: `var(--mantine-color-${color}-7)`,
          cursor: "help",
        }}
      >
        {getStrategyIcon(strategy, Math.round(size * 0.6))}
      </Box>
    </Tooltip>
  );
}
