/**
 * Strategy UI Utilities
 *
 * Shared helper functions for displaying analysis strategy information
 * across UI components. Centralizes icon selection, color mapping, and
 * naming conventions to ensure consistency.
 */

import React from "react";
import { Zap, Scale, Target, Sparkles } from "lucide-react";
import type { AnalysisStrategy } from "@/lib/analysis-strategy";

/**
 * Get icon component for a strategy
 *
 * @param strategy - Analysis strategy type
 * @param size - Icon size in pixels (default: 16)
 * @returns React icon component
 *
 * @example
 * ```tsx
 * <div>{getStrategyIcon("basic", 20)}</div>
 * ```
 */
export function getStrategyIcon(
  strategy: AnalysisStrategy | "auto",
  size = 16
): React.ReactNode {
  switch (strategy) {
    case "basic":
      return (
        <Zap
          size={size}
          style={{ color: "var(--mantine-color-aphYellow-6)" }}
        />
      );
    case "hybrid":
      return (
        <Scale
          size={size}
          style={{ color: "var(--mantine-color-aphCyan-6)" }}
        />
      );
    case "advanced":
      return (
        <Target
          size={size}
          style={{ color: "var(--mantine-color-aphPurple-6)" }}
        />
      );
    case "auto":
      return (
        <Sparkles
          size={size}
          style={{ color: "var(--mantine-color-aphBlue-6)" }}
        />
      );
  }
}

/**
 * Get Mantine color scheme for a strategy
 *
 * @param strategy - Analysis strategy type
 * @returns Mantine color name
 *
 * @example
 * ```tsx
 * <Badge color={getStrategyColor("hybrid")}>Hybrid</Badge>
 * ```
 */
export function getStrategyColor(strategy: AnalysisStrategy | "auto"): string {
  switch (strategy) {
    case "basic":
      return "aphYellow";
    case "hybrid":
      return "aphCyan";
    case "advanced":
      return "aphPurple";
    case "auto":
      return "aphBlue";
  }
}

/**
 * Get display name for a strategy
 *
 * @param strategy - Analysis strategy type
 * @returns Human-readable strategy name
 *
 * @example
 * ```tsx
 * <Text>{getStrategyName("advanced")}</Text> // "Advanced"
 * ```
 */
export function getStrategyName(strategy: AnalysisStrategy | "auto"): string {
  switch (strategy) {
    case "basic":
      return "Basic";
    case "hybrid":
      return "Hybrid";
    case "advanced":
      return "Advanced";
    case "auto":
      return "Auto";
  }
}
