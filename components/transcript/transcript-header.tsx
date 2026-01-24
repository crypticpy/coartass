/**
 * Transcript Header Component
 *
 * Displays transcript metadata, status badges, and action buttons
 * for export, delete, and analysis operations.
 */

"use client";

import React, { memo, useState, useCallback } from "react";
import {
  FileText,
  Download,
  Trash2,
  Sparkles,
  Calendar,
  Clock,
  FileType,
  Share2,
  File,
} from "lucide-react";
import {
  Button,
  Badge,
  Menu,
  Group,
  ActionIcon,
  Text,
  Tooltip,
  Stack,
  Flex,
  Box,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  formatDateTime,
  formatDuration,
  calculateWordCount,
} from "@/lib/transcript-utils";
import {
  exportAndDownloadTranscript,
  exportMultipleAnalysesPackage,
  downloadPackage,
  generatePackageFilename,
} from "@/lib/package/export";
import type { Transcript } from "@/types/transcript";
import type { Analysis } from "@/types/analysis";

export interface TranscriptHeaderProps {
  /** The transcript data */
  transcript: Transcript;
  /** Analyses associated with this transcript (for package export) */
  analyses?: Analysis[];
  /** Callback when export is requested */
  onExport?: (format: "txt" | "srt" | "vtt" | "json") => void;
  /** Callback when delete is confirmed */
  onDelete?: () => void;
  /** Callback when analyze is clicked */
  onAnalyze?: () => void;
  /** Callback when documents button is clicked */
  onDocuments?: () => void;
  /** Number of attached documents */
  documentCount?: number;
  /** Whether delete action is loading */
  isDeleting?: boolean;
  /** Whether there are existing analyses for this transcript */
  hasExistingAnalyses?: boolean;
  /** Optional className for styling */
  className?: string;
}

/**
 * Transcript header component
 *
 * Displays:
 * - Transcript filename and creation date
 * - Metadata (duration, word count, file size)
 * - Status badges (language, model)
 * - Action buttons (Export, Delete, Analyze)
 */
export const TranscriptHeader = memo(
  function TranscriptHeader({
    transcript,
    analyses = [],
    onExport,
    onDelete,
    onAnalyze,
    onDocuments,
    documentCount = 0,
    isDeleting = false,
    hasExistingAnalyses = false,
    className,
  }: TranscriptHeaderProps) {
    const [isExportingPackage, setIsExportingPackage] = useState(false);
    const wordCount = calculateWordCount(transcript.text);
    const formattedDate = formatDateTime(transcript.createdAt);
    const duration = formatDuration(transcript.metadata.duration);

    const handleDeleteClick = () => {
      modals.openConfirmModal({
        title: "Delete Transcript",
        children: (
          <div>
            Are you sure you want to delete &quot;{transcript.filename}&quot;?
            This action cannot be undone and will also delete all associated
            analyses.
          </div>
        ),
        labels: { confirm: "Delete", cancel: "Cancel" },
        confirmProps: { color: "red" },
        onConfirm: () => onDelete?.(),
      });
    };

    const handleExportPackage = useCallback(async () => {
      setIsExportingPackage(true);
      try {
        // If there are analyses, export them with the transcript
        if (analyses.length > 0) {
          const pkg = await exportMultipleAnalysesPackage(transcript, analyses);
          const filename = generatePackageFilename(transcript, "analysis");
          downloadPackage(pkg, filename);
          notifications.show({
            title: "Package Created",
            message: `Transcript and ${analyses.length} ${analyses.length === 1 ? "analysis" : "analyses"} exported as shareable package.`,
            color: "green",
          });
        } else {
          // No analyses, just export transcript
          await exportAndDownloadTranscript(transcript);
          notifications.show({
            title: "Package Created",
            message:
              "Transcript exported as shareable package. Share this file with others to import.",
            color: "green",
          });
        }
      } catch (error) {
        notifications.show({
          title: "Export Failed",
          message:
            error instanceof Error ? error.message : "Failed to create package",
          color: "red",
        });
      } finally {
        setIsExportingPackage(false);
      }
    }, [transcript, analyses]);

    return (
      <Stack gap="xl" className={className}>
        {/* Hero Header Section */}
        <Box
          pb="xl"
          style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}
        >
          {/* Title Section */}
          <Box mb="lg">
            <Title
              order={1}
              size="h1"
              fw={600}
              lh={1.2}
              mb="xs"
              style={{
                fontSize: "clamp(1.5rem, 3vw, 2rem)",
              }}
            >
              {transcript.filename}
            </Title>
            <Group gap="xs" c="dimmed">
              <Calendar size={16} />
              <Text size="sm">
                <time dateTime={transcript.createdAt.toISOString()}>
                  {formattedDate}
                </time>
              </Text>
            </Group>
          </Box>

          {/* Action Buttons */}
          <Flex wrap="wrap" gap="md" align="center">
            {onAnalyze && (
              <Button
                onClick={onAnalyze}
                variant="filled"
                leftSection={<Sparkles size={18} />}
                size="lg"
                style={{ minHeight: 44 }}
                data-tour-id="analyze-button"
              >
                {hasExistingAnalyses
                  ? "Re-Analyze Transcript"
                  : "Analyze Transcript"}
              </Button>
            )}

            {onDocuments && (
              <Button
                onClick={onDocuments}
                variant="light"
                leftSection={<File size={18} />}
                size="lg"
                style={{ minHeight: 44 }}
              >
                Documents
                {documentCount > 0 && (
                  <Badge size="sm" variant="filled" ml="xs">
                    {documentCount}
                  </Badge>
                )}
              </Button>
            )}

            {onExport && (
              <Menu position="bottom-end" shadow="md" width={200}>
                <Menu.Target>
                  <Button
                    variant="light"
                    size="lg"
                    leftSection={<Download size={18} />}
                    style={{ minHeight: 44 }}
                    data-tour-id="transcript-export"
                  >
                    Export
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Text Formats</Menu.Label>
                  <Menu.Item
                    leftSection={<FileText size={14} />}
                    onClick={() => onExport("txt")}
                  >
                    Plain Text (.txt)
                  </Menu.Item>

                  <Menu.Divider />
                  <Menu.Label>Subtitles</Menu.Label>
                  <Menu.Item
                    leftSection={<FileType size={14} />}
                    onClick={() => onExport("srt")}
                  >
                    SubRip (.srt)
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<FileType size={14} />}
                    onClick={() => onExport("vtt")}
                  >
                    WebVTT (.vtt)
                  </Menu.Item>

                  <Menu.Divider />
                  <Menu.Label>Share</Menu.Label>
                  <Menu.Item
                    leftSection={<Share2 size={14} />}
                    onClick={handleExportPackage}
                    disabled={isExportingPackage}
                  >
                    {isExportingPackage ? "Creating..." : "Share as Package"}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}

            {onDelete && (
              <Tooltip label="Delete Transcript" withArrow>
                <ActionIcon
                  variant="light"
                  size="lg"
                  color="red"
                  onClick={handleDeleteClick}
                  loading={isDeleting}
                  style={{ minWidth: 44, minHeight: 44 }}
                >
                  <Trash2 size={20} />
                </ActionIcon>
              </Tooltip>
            )}
          </Flex>
        </Box>

        {/* Compact Metadata - Duration and Word Count only (other info shown in playback area) */}
        <Group gap="lg" c="dimmed">
          <Group gap={6}>
            <Clock size={14} />
            <Text size="sm">{duration}</Text>
          </Group>
          <Group gap={6}>
            <FileText size={14} />
            <Text size="sm">{wordCount.toLocaleString()} words</Text>
          </Group>
        </Group>
      </Stack>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if transcript data or callbacks change
    return (
      prevProps.transcript.id === nextProps.transcript.id &&
      prevProps.transcript.filename === nextProps.transcript.filename &&
      prevProps.transcript.text === nextProps.transcript.text &&
      prevProps.transcript.createdAt === nextProps.transcript.createdAt &&
      prevProps.transcript.metadata === nextProps.transcript.metadata &&
      prevProps.analyses?.length === nextProps.analyses?.length &&
      prevProps.isDeleting === nextProps.isDeleting &&
      prevProps.hasExistingAnalyses === nextProps.hasExistingAnalyses &&
      prevProps.documentCount === nextProps.documentCount &&
      prevProps.onExport === nextProps.onExport &&
      prevProps.onDelete === nextProps.onDelete &&
      prevProps.onAnalyze === nextProps.onAnalyze &&
      prevProps.onDocuments === nextProps.onDocuments
    );
  },
);

/**
 * Compact transcript header for mobile views
 */
export const CompactTranscriptHeader = memo(
  function CompactTranscriptHeader({
    transcript,
    analyses = [],
    onExport,
    onDelete,
    onAnalyze,
    hasExistingAnalyses = false,
    className,
  }: TranscriptHeaderProps) {
    const [isExportingPackage, setIsExportingPackage] = useState(false);
    const wordCount = calculateWordCount(transcript.text);
    const duration = formatDuration(transcript.metadata.duration);

    const handleDeleteClick = () => {
      modals.openConfirmModal({
        title: "Delete Transcript",
        children: `Are you sure you want to delete "${transcript.filename}"?`,
        labels: { confirm: "Delete", cancel: "Cancel" },
        confirmProps: { color: "red" },
        onConfirm: () => onDelete?.(),
      });
    };

    const handleExportPackage = useCallback(async () => {
      setIsExportingPackage(true);
      try {
        if (analyses.length > 0) {
          const pkg = await exportMultipleAnalysesPackage(transcript, analyses);
          const filename = generatePackageFilename(transcript, "analysis");
          downloadPackage(pkg, filename);
          notifications.show({
            title: "Package Created",
            message: `Transcript and ${analyses.length} ${analyses.length === 1 ? "analysis" : "analyses"} exported.`,
            color: "green",
          });
        } else {
          await exportAndDownloadTranscript(transcript);
          notifications.show({
            title: "Package Created",
            message: "Transcript exported as shareable package.",
            color: "green",
          });
        }
      } catch (error) {
        notifications.show({
          title: "Export Failed",
          message:
            error instanceof Error ? error.message : "Failed to create package",
          color: "red",
        });
      } finally {
        setIsExportingPackage(false);
      }
    }, [transcript, analyses]);

    return (
      <Stack gap="sm" className={className}>
        <Flex align="flex-start" justify="space-between" gap="xs">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Title order={1} size="h3" fw={700} lineClamp={1}>
              {transcript.filename}
            </Title>
            <Group gap="xs" mt={4}>
              <Text size="xs" c="dimmed">
                {duration}
              </Text>
              <Text size="xs" c="dimmed">
                •
              </Text>
              <Text size="xs" c="dimmed">
                {wordCount} words
              </Text>
            </Group>
          </Box>

          <Group gap={4} wrap="nowrap">
            {onAnalyze && (
              <Button
                size="sm"
                variant="filled"
                onClick={onAnalyze}
                title={
                  hasExistingAnalyses
                    ? "Re-Analyze Transcript"
                    : "Analyze Transcript"
                }
                aria-label={
                  hasExistingAnalyses
                    ? "Re-Analyze Transcript"
                    : "Analyze Transcript"
                }
              >
                <Sparkles size={16} />
              </Button>
            )}
            {onExport && (
              <Menu position="bottom-end">
                <Menu.Target>
                  <Button size="sm" variant="default">
                    <Download size={16} />
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => onExport("txt")}>Text</Menu.Item>
                  <Menu.Item onClick={() => onExport("srt")}>SRT</Menu.Item>
                  <Menu.Item onClick={() => onExport("vtt")}>VTT</Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    onClick={handleExportPackage}
                    disabled={isExportingPackage}
                    leftSection={<Share2 size={14} />}
                  >
                    {isExportingPackage ? "Creating..." : "Share as Package"}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="default"
                onClick={handleDeleteClick}
                c="red"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </Group>
        </Flex>

        <Group gap="xs" wrap="wrap">
          {transcript.metadata.language && (
            <Badge variant="light" size="sm">
              {transcript.metadata.language.toUpperCase()}
            </Badge>
          )}
          <Badge variant="light" size="sm">
            {transcript.metadata.model}
          </Badge>
        </Group>
      </Stack>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if transcript data or callbacks change
    return (
      prevProps.transcript.id === nextProps.transcript.id &&
      prevProps.transcript.filename === nextProps.transcript.filename &&
      prevProps.transcript.metadata?.duration ===
        nextProps.transcript.metadata?.duration &&
      prevProps.hasExistingAnalyses === nextProps.hasExistingAnalyses &&
      prevProps.onExport === nextProps.onExport &&
      prevProps.onDelete === nextProps.onDelete &&
      prevProps.onAnalyze === nextProps.onAnalyze
    );
  },
);
