"use client";

import * as React from "react";
import { Paper, Stack, Group, Text, ThemeIcon, Tooltip } from "@mantine/core";
import { Mic, Monitor, Users } from "lucide-react";
import { getRecordingModeConfigs } from "@/lib/browser-capabilities";
import type { RecordingMode } from "@/types/recording";

interface ModeSelectorProps {
  selectedMode: RecordingMode | null;
  onSelectMode: (mode: RecordingMode) => void;
}

/**
 * ModeSelector Component
 *
 * Displays three cards for selecting recording mode: Microphone, System Audio, and Commentary.
 * Each card shows an icon, title, description, and handles browser support detection.
 * Unsupported modes are visually disabled with explanatory tooltips.
 */
export function ModeSelector({ selectedMode, onSelectMode }: ModeSelectorProps) {
  const modeConfigs = getRecordingModeConfigs();

  // Map icon names to Lucide components
  const iconMap = {
    Mic: Mic,
    Monitor: Monitor,
    Users: Users,
  };

  // Map color names to Mantine theme colors
  const colorMap = {
    blue: "blue",
    green: "green",
    violet: "violet",
  };

  return (
    <Stack gap="md" data-tour-id="record-mode-selector">
      {modeConfigs.map((config) => {
        const IconComponent = iconMap[config.icon as keyof typeof iconMap];
        const color = colorMap[config.color as keyof typeof colorMap];
        const isSelected = selectedMode === config.id;
        const isDisabled = !config.supported;

        const handleKeyDown = (e: React.KeyboardEvent) => {
          if (!isDisabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onSelectMode(config.id);
          }
        };

        const card = (
          <Paper
            key={config.id}
            p="lg"
            radius="md"
            withBorder
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            aria-label={`${config.label}: ${config.description}${isDisabled ? ` (Not available: ${config.disabledReason})` : ""}${isSelected ? " (Selected)" : ""}`}
            aria-pressed={isSelected}
            aria-disabled={isDisabled}
            style={{
              cursor: isDisabled ? "not-allowed" : "pointer",
              opacity: isDisabled ? 0.5 : 1,
              borderColor: isSelected
                ? `var(--mantine-color-${color}-6)`
                : undefined,
              borderWidth: isSelected ? 2 : 1,
              backgroundColor: isSelected
                ? `var(--mantine-color-${color}-0)`
                : undefined,
              transition: "all 0.2s ease",
              pointerEvents: isDisabled ? "none" : "auto",
            }}
            onClick={() => {
              if (!isDisabled) {
                onSelectMode(config.id);
              }
            }}
            onKeyDown={handleKeyDown}
            onMouseEnter={(e) => {
              if (!isDisabled && !isSelected) {
                e.currentTarget.style.borderColor = `var(--mantine-color-${color}-3)`;
                e.currentTarget.style.backgroundColor = `var(--mantine-color-${color}-0)`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isDisabled && !isSelected) {
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.backgroundColor = "";
              }
            }}
          >
            <Group gap="md" wrap="nowrap" align="flex-start">
              <ThemeIcon
                size="xl"
                radius="md"
                variant={isSelected ? "filled" : "light"}
                color={color}
              >
                <IconComponent size={24} />
              </ThemeIcon>

              <Stack gap="xs" style={{ flex: 1 }}>
                <Text size="lg" fw={600} c={isDisabled ? "dimmed" : undefined}>
                  {config.label}
                </Text>
                <Text size="sm" c="dimmed" style={{ lineHeight: 1.5 }}>
                  {config.description}
                </Text>
              </Stack>
            </Group>
          </Paper>
        );

        // Wrap disabled cards in a tooltip
        if (isDisabled && config.disabledReason) {
          return (
            <Tooltip
              key={config.id}
              label={
                <Stack gap={4}>
                  <Text size="sm" fw={500}>
                    Not Supported
                  </Text>
                  <Text size="xs">{config.disabledReason}</Text>
                </Stack>
              }
              multiline
              maw={300}
              position="top"
              withArrow
            >
              <div>{card}</div>
            </Tooltip>
          );
        }

        return card;
      })}
    </Stack>
  );
}
