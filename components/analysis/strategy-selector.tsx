/**
 * Strategy Selector Component
 *
 * Allows users to select an analysis strategy (auto, basic, hybrid, advanced)
 * with information about each strategy and the option to enable self-evaluation.
 *
 * Features:
 * - Two layout modes: full (default) and compact
 * - Full mode: Radio buttons with detailed cards for strategy selection
 * - Compact mode: Select dropdown with inline checkbox (~80-120px height)
 * - Info badges with tooltips showing time, API calls, quality
 * - Automatic recommendation display
 * - Self-evaluation toggle
 * - Optional accordion for strategy details in compact mode
 * - Responsive design
 * - Austin Public Health theme colors
 */

"use client";

import React from "react";
import {
  Paper,
  Stack,
  Radio,
  Group,
  Text,
  Badge,
  Checkbox,
  Alert,
  Tooltip,
  Box,
  Title,
  Divider,
  Select,
  Accordion,
} from "@mantine/core";
import {
  Clock,
  Activity,
  TrendingUp,
  AlertCircle,
  Info,
  Sparkles,
} from "lucide-react";
import type { AnalysisStrategy } from "@/lib/analysis-strategy";
import {
  getStrategyMetadata,
  validateStrategy,
} from "@/lib/analysis-strategy";
import {
  getStrategyIcon,
  getStrategyColor,
} from "@/lib/strategy-ui-utils";
import { getStrategyRecommendation } from "@/lib/analysis-strategies";

/**
 * Props for StrategySelector component
 */
export interface StrategySelectorProps {
  /** Full transcript text for recommendation */
  transcriptText: string;

  /** Currently selected strategy */
  value: AnalysisStrategy | "auto";

  /** Callback when strategy changes */
  onChange: (strategy: AnalysisStrategy | "auto") => void;

  /** Whether self-evaluation is enabled */
  runEvaluation: boolean;

  /** Callback when evaluation setting changes */
  onEvaluationChange: (value: boolean) => void;

  /** Optional: Disable all controls */
  disabled?: boolean;

  /** Optional: Use compact inline layout instead of full layout */
  compact?: boolean;

  /** Optional: data-tour-id for interactive tours */
  'data-tour-id'?: string;
}

/**
 * Strategy Selector Component
 *
 * Displays strategy options with metadata and recommendations.
 */
export function StrategySelector({
  transcriptText,
  value,
  onChange,
  runEvaluation,
  onEvaluationChange,
  disabled = false,
  compact = false,
  'data-tour-id': dataTourId,
}: StrategySelectorProps) {
  // Get recommendation based on transcript
  const recommendation = React.useMemo(
    () => getStrategyRecommendation(transcriptText),
    [transcriptText]
  );

  // Validate current selection
  const validation = React.useMemo(() => {
    if (value === "auto") return null;
    return validateStrategy(transcriptText, value);
  }, [transcriptText, value]);

  // Strategy options configuration
  const strategies: Array<{
    value: AnalysisStrategy | "auto";
    label: string;
    description: string;
  }> = [
    {
      value: "auto",
      label: "Auto-Select (Recommended)",
      description: `System will choose the best strategy based on transcript length. Currently recommends: ${recommendation.metadata.name}.`,
    },
    {
      value: "basic",
      label: "Basic Analysis",
      description:
        "Fast single-pass analysis. All sections analyzed together in one API call. Best for short meetings and quick overviews.",
    },
    {
      value: "hybrid",
      label: "Hybrid Analysis",
      description:
        "Balanced batched analysis. Related sections grouped with contextual linking. Best for medium meetings with good quality/speed balance.",
    },
    {
      value: "advanced",
      label: "Advanced Analysis",
      description:
        "Deep contextual cascading. Each section builds on previous results with full cross-references. Best for long, complex meetings.",
    },
  ];

  // Select dropdown options for compact mode
  // Time estimates updated for GPT-5.2 model upgrade
  const strategyOptions = [
    { value: "auto", label: "⚡ Auto-Select (Recommended)" },
    { value: "basic", label: "⚡ Basic - Fast (2-4 min)" },
    { value: "hybrid", label: "🔄 Hybrid - Balanced (4-6 min)" },
    { value: "advanced", label: "🎯 Advanced - Deep (6-8 min)" },
  ];

  // Compact mode: inline layout with Select dropdown
  if (compact) {
    return (
      <Stack gap="sm" data-tour-id={dataTourId}>
        <Group align="flex-start" gap="md" wrap="wrap">
          <Select
            label="Analysis Strategy"
            description="Choose analysis depth and speed"
            value={value}
            onChange={(val) => onChange(val as AnalysisStrategy | "auto")}
            data={strategyOptions}
            style={{ flex: 1, minWidth: 250 }}
            allowDeselect={false}
            disabled={disabled}
          />
          <Checkbox
            label="Run self-evaluation"
            description="Review and improve results (+1-1.5 min)"
            checked={runEvaluation}
            onChange={(e) => onEvaluationChange(e.currentTarget.checked)}
            disabled={disabled}
            mt="xl"
          />
        </Group>

        {/* Optional: Accordion for advanced details */}
        <Accordion variant="subtle">
          <Accordion.Item value="details">
            <Accordion.Control>Show strategy details</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                {/* Recommendation Info */}
                {value === "auto" && (
                  <Alert
                    icon={<Info size={16} />}
                    color="aphBlue"
                    variant="light"
                    title="Automatic Recommendation"
                  >
                    <Text size="sm">{recommendation.reason}</Text>
                  </Alert>
                )}

                {/* Validation Warning */}
                {validation?.warning && (
                  <Alert
                    icon={<AlertCircle size={16} />}
                    color="aphOrange"
                    variant="light"
                    title="Strategy Override Warning"
                  >
                    <Text size="sm">{validation.warning}</Text>
                  </Alert>
                )}

                {/* Strategy Details */}
                {strategies.map((strategy) => {
                  const metadata =
                    strategy.value !== "auto"
                      ? getStrategyMetadata(strategy.value)
                      : null;

                  return (
                    <Box key={strategy.value}>
                      <Group gap="xs" mb="xs">
                        {getStrategyIcon(strategy.value, 18)}
                        <Text fw={600} size="md">
                          {strategy.label}
                        </Text>
                      </Group>
                      <Text size="sm" c="dimmed" mb="xs">
                        {strategy.description}
                      </Text>
                      {metadata && (
                        <Group gap="xs">
                          <Badge
                            size="sm"
                            variant="outline"
                            color={getStrategyColor(strategy.value)}
                            leftSection={<Clock size={12} />}
                          >
                            {metadata.speed}
                          </Badge>
                          <Badge
                            size="sm"
                            variant="outline"
                            color={getStrategyColor(strategy.value)}
                            leftSection={<Activity size={12} />}
                          >
                            {metadata.apiCalls}
                          </Badge>
                          <Badge
                            size="sm"
                            variant="outline"
                            color={getStrategyColor(strategy.value)}
                            leftSection={<TrendingUp size={12} />}
                          >
                            {metadata.quality}
                          </Badge>
                        </Group>
                      )}
                    </Box>
                  );
                })}

                {/* Self-Evaluation Info */}
                <Box>
                  <Group gap="xs" mb="xs">
                    <Sparkles size={16} style={{ color: "var(--mantine-color-aphGreen-6)" }} />
                    <Text fw={600} size="md">
                      Self-Evaluation Details
                    </Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Review and improve the analysis with a quality-check pass. Adds 1-1.5 minutes but
                    improves accuracy by 10-20%. Provides quality score and shows before/after
                    comparison.
                  </Text>
                </Box>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Stack>
    );
  }

  // Full mode: original layout
  return (
    <Paper p="lg" radius="md" withBorder shadow="sm">
      <Stack gap="lg">
        {/* Header */}
        <Box>
          <Group gap="xs" mb="xs">
            <Activity size={20} style={{ color: "var(--mantine-color-aphBlue-6)" }} />
            <Title order={3} size="lg">
              Analysis Strategy
            </Title>
          </Group>
          <Text size="sm" c="dimmed">
            Choose how the AI should analyze your transcript. Each strategy balances speed and
            quality differently.
          </Text>
        </Box>

        <Divider />

        {/* Recommendation Alert */}
        {value === "auto" && (
          <Alert
            icon={<Info size={16} />}
            color="aphBlue"
            variant="light"
            title="Automatic Recommendation"
          >
            <Text size="sm">{recommendation.reason}</Text>
          </Alert>
        )}

        {/* Validation Warning */}
        {validation?.warning && (
          <Alert
            icon={<AlertCircle size={16} />}
            color="aphOrange"
            variant="light"
            title="Strategy Override Warning"
          >
            <Text size="sm">{validation.warning}</Text>
          </Alert>
        )}

        {/* Strategy Radio Group */}
        <Radio.Group
          value={value}
          onChange={(val) => onChange(val as AnalysisStrategy | "auto")}
          aria-label="Analysis strategy selection"
        >
          <Stack gap="md">
            {strategies.map((strategy) => {
              const isRecommended = strategy.value === "auto" ||
                (value !== "auto" && strategy.value === recommendation.strategy);
              const metadata =
                strategy.value !== "auto"
                  ? getStrategyMetadata(strategy.value)
                  : null;

              return (
                <Paper
                  key={strategy.value}
                  p="md"
                  radius="md"
                  withBorder
                  component="button"
                  type="button"
                  disabled={disabled}
                  style={{
                    cursor: disabled ? "not-allowed" : "pointer",
                    transition: "all 150ms",
                    backgroundColor:
                      value === strategy.value
                        ? `var(--mantine-color-${getStrategyColor(strategy.value)}-0)`
                        : "transparent",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor:
                      value === strategy.value
                        ? `var(--mantine-color-${getStrategyColor(strategy.value)}-3)`
                        : "var(--mantine-color-gray-3)",
                    opacity: disabled ? 0.6 : 1,
                    width: "100%",
                    textAlign: "left",
                  }}
                  onClick={() => !disabled && onChange(strategy.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !disabled) {
                      e.preventDefault();
                      onChange(strategy.value);
                    }
                  }}
                >
                  <Radio
                    value={strategy.value}
                    disabled={disabled}
                    label={
                      <Stack gap="xs" ml="sm">
                        {/* Strategy Name with Icon */}
                        <Group gap="xs">
                          {getStrategyIcon(strategy.value, 18)}
                          <Text fw={600} size="md">
                            {strategy.label}
                          </Text>
                          {isRecommended && strategy.value === "auto" && (
                            <Badge size="xs" variant="light" color="aphGreen" radius="sm">
                              Recommended
                            </Badge>
                          )}
                        </Group>

                        {/* Description */}
                        <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
                          {strategy.description}
                        </Text>

                        {/* Metadata Badges */}
                        {metadata && (
                          <Group gap="xs" mt="xs">
                            {/* Processing Time */}
                            <Tooltip
                              label="Estimated processing time"
                              withArrow
                              position="bottom"
                            >
                              <Badge
                                size="sm"
                                variant="outline"
                                color={getStrategyColor(strategy.value)}
                                leftSection={<Clock size={12} />}
                              >
                                {metadata.speed}
                              </Badge>
                            </Tooltip>

                            {/* API Calls */}
                            <Tooltip
                              label="Number of API calls required"
                              withArrow
                              position="bottom"
                            >
                              <Badge
                                size="sm"
                                variant="outline"
                                color={getStrategyColor(strategy.value)}
                                leftSection={<Activity size={12} />}
                              >
                                {metadata.apiCalls}
                              </Badge>
                            </Tooltip>

                            {/* Quality Level */}
                            <Tooltip label="Quality level" withArrow position="bottom">
                              <Badge
                                size="sm"
                                variant="outline"
                                color={getStrategyColor(strategy.value)}
                                leftSection={<TrendingUp size={12} />}
                              >
                                {metadata.quality}
                              </Badge>
                            </Tooltip>
                          </Group>
                        )}

                        {/* Auto-select shows current recommendation details */}
                        {strategy.value === "auto" && (
                          <Box
                            mt="xs"
                            p="sm"
                            style={{
                              backgroundColor: "var(--mantine-color-gray-0)",
                              borderRadius: "var(--mantine-radius-sm)",
                              borderLeft: `3px solid var(--mantine-color-${getStrategyColor(recommendation.strategy)}-5)`,
                            }}
                          >
                            <Group gap="xs" mb="xs">
                              {getStrategyIcon(recommendation.strategy, 14)}
                              <Text size="xs" fw={600} c="dimmed">
                                Will use: {recommendation.metadata.name}
                              </Text>
                            </Group>
                            <Group gap="xs">
                              <Badge size="xs" variant="dot" color={getStrategyColor(recommendation.strategy)}>
                                {recommendation.metadata.speed}
                              </Badge>
                              <Text size="xs" c="dimmed">•</Text>
                              <Badge size="xs" variant="dot" color={getStrategyColor(recommendation.strategy)}>
                                {recommendation.metadata.quality} quality
                              </Badge>
                            </Group>
                          </Box>
                        )}
                      </Stack>
                    }
                    styles={{
                      root: {
                        width: "100%",
                      },
                      body: {
                        width: "100%",
                      },
                    }}
                  />
                </Paper>
              );
            })}
          </Stack>
        </Radio.Group>

        <Divider />

        {/* Self-Evaluation Toggle */}
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{
            backgroundColor: runEvaluation
              ? "var(--mantine-color-aphGreen-0)"
              : "transparent",
            borderColor: runEvaluation
              ? "var(--mantine-color-aphGreen-3)"
              : "var(--mantine-color-gray-3)",
          }}
        >
          <Checkbox
            checked={runEvaluation}
            onChange={(event) => onEvaluationChange(event.currentTarget.checked)}
            disabled={disabled}
            label={
              <Stack gap="xs" ml="xs">
                <Group gap="xs">
                  <Sparkles size={16} style={{ color: "var(--mantine-color-aphGreen-6)" }} />
                  <Text fw={600} size="md">
                    Run Self-Evaluation
                  </Text>
                  <Badge size="xs" variant="light" color="aphGreen" radius="sm">
                    Recommended
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
                  Review and improve the analysis with a quality-check pass. Adds 1-1.5 minutes but
                  improves accuracy by 10-20%. Provides quality score and shows before/after
                  comparison.
                </Text>
              </Stack>
            }
            styles={{
              body: {
                alignItems: "flex-start",
              },
            }}
          />
        </Paper>

        {/* Additional Info - GPT-5.2 Upgrade Notice */}
        <Alert icon={<Info size={16} />} color="blue" variant="light">
          <Text size="xs" c="dimmed">
            <strong>Model Upgrade:</strong> Analysis models have been upgraded to GPT-5.2, which may take
            longer to process but produces better results. All strategies produce high-quality output.
            Choose based on your time constraints and meeting complexity.
          </Text>
        </Alert>
      </Stack>
    </Paper>
  );
}
