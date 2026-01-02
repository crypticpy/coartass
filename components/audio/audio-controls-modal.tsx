/**
 * Audio Controls Modal
 *
 * Modal dialog for advanced audio processing controls including:
 * - Volume boost (up to 300%)
 * - High-pass filter for reducing low-frequency rumble
 * - Dynamic range compression for evening out loud/quiet sections
 */

'use client';

import React from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Slider,
  Switch,
  Paper,
  Divider,
  Badge,
  ThemeIcon,
} from '@mantine/core';
import {
  Volume2,
  Filter,
  Maximize2,
  Settings,
} from 'lucide-react';
import type { AudioEnhancementSettings, ExtendedAudioControls } from '@/hooks/use-audio-sync';

interface AudioControlsModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Current enhancement settings */
  enhancement: AudioEnhancementSettings;
  /** Audio controls for adjusting settings */
  controls: ExtendedAudioControls;
  /** Optional z-index for the modal (useful when opened from overlays) */
  zIndex?: number;
}

/**
 * Audio Controls Modal Component
 *
 * Provides advanced audio processing controls in a clean modal interface.
 * Changes are applied in real-time via Web Audio API.
 */
export function AudioControlsModal({
  opened,
  onClose,
  enhancement,
  controls,
  zIndex,
}: AudioControlsModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      zIndex={zIndex}
      title={
        <Group gap="xs">
          <ThemeIcon variant="light" color="blue" size="sm">
            <Settings size={14} />
          </ThemeIcon>
          <Text fw={600}>Audio Controls</Text>
        </Group>
      }
      size="md"
      centered
    >
      <Stack gap="lg">
        {/* Volume Boost Section */}
        <Paper p="md" withBorder radius="md">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Volume2 size={18} style={{ color: 'var(--mantine-color-blue-6)' }} />
                <Text fw={500} size="sm">Volume Boost</Text>
              </Group>
              <Badge
                variant="light"
                color={enhancement.volumeBoost > 1 ? 'blue' : 'gray'}
                size="sm"
              >
                {Math.round(enhancement.volumeBoost * 100)}%
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              Amplify audio beyond normal levels. Use with caution to avoid distortion.
            </Text>
            <Slider
              value={enhancement.volumeBoost}
              onChange={controls.setVolumeBoost}
              min={0.5}
              max={3}
              step={0.1}
              marks={[
                { value: 0.5, label: '50%' },
                { value: 1, label: '100%' },
                { value: 2, label: '200%' },
                { value: 3, label: '300%' },
              ]}
              label={(val) => `${Math.round(val * 100)}%`}
            />
          </Stack>
        </Paper>

        <Divider label="Filters" labelPosition="center" />

        {/* High-Pass Filter Section */}
        <Paper p="md" withBorder radius="md">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Filter size={18} style={{ color: 'var(--mantine-color-orange-6)' }} />
                <Text fw={500} size="sm">High-Pass Filter</Text>
              </Group>
              <Switch
                checked={enhancement.highPassEnabled}
                onChange={(e) => controls.toggleHighPass(e.currentTarget.checked)}
                size="sm"
              />
            </Group>
            <Text size="xs" c="dimmed">
              Removes low-frequency rumble and noise (AC hum, wind, traffic).
              Radio traffic often has low-frequency interference.
            </Text>
            {enhancement.highPassEnabled && (
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">Cutoff Frequency</Text>
                  <Badge variant="light" size="sm">{enhancement.highPassFreq} Hz</Badge>
                </Group>
                <Slider
                  value={enhancement.highPassFreq}
                  onChange={controls.setHighPassFreq}
                  min={20}
                  max={500}
                  step={10}
                  marks={[
                    { value: 80, label: '80Hz' },
                    { value: 200, label: '200Hz' },
                    { value: 400, label: '400Hz' },
                  ]}
                  label={(val) => `${val} Hz`}
                  disabled={!enhancement.highPassEnabled}
                />
              </Stack>
            )}
          </Stack>
        </Paper>

        {/* Compressor Section */}
        <Paper p="md" withBorder radius="md">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Maximize2 size={18} style={{ color: 'var(--mantine-color-green-6)' }} />
                <Text fw={500} size="sm">Dynamic Compression</Text>
              </Group>
              <Switch
                checked={enhancement.compressorEnabled}
                onChange={(e) => controls.toggleCompressor(e.currentTarget.checked)}
                size="sm"
              />
            </Group>
            <Text size="xs" c="dimmed">
              Evens out volume differences between loud and quiet transmissions.
              Makes soft speech easier to hear without blasting loud sections.
            </Text>
            {enhancement.compressorEnabled && (
              <Badge color="green" variant="light" size="sm">
                4:1 compression ratio, -24dB threshold
              </Badge>
            )}
          </Stack>
        </Paper>

        {/* Info footer */}
        <Text size="xs" c="dimmed" ta="center">
          Audio processing is applied in real-time using Web Audio API.
          Changes take effect immediately.
        </Text>
      </Stack>
    </Modal>
  );
}
