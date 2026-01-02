/**
 * Export Options Modal Component
 *
 * Modal for customizing analysis export settings before generation.
 * Allows selecting format and which sections to include.
 */

"use client";

import * as React from "react";
import {
  Modal,
  Stack,
  Group,
  Button,
  Text,
  Checkbox,
  SegmentedControl,
  Paper,
  Divider,
  Badge,
  Loader,
  rem,
} from "@mantine/core";
import {
  FileText,
  FileType,
  FileCode,
  Braces,
  Download,
} from "lucide-react";
import { notifications } from "@mantine/notifications";
import type { Analysis, Transcript, Template } from "@/types";
import {
  exportAnalysis,
  downloadExport,
  estimateExportSize,
  type ExportFormat,
  type ExportOptions,
  DEFAULT_EXPORT_OPTIONS,
} from "@/lib/export/analysis-exporter";

/**
 * Props for ExportOptionsModal
 */
export interface ExportOptionsModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** The analysis to export */
  analysis: Analysis;
  /** The source transcript */
  transcript: Transcript;
  /** The template used for analysis */
  template: Template;
}

/**
 * Format data for the segmented control
 */
const FORMAT_DATA = [
  {
    value: "pdf",
    label: (
      <Group gap={4} wrap="nowrap">
        <FileText style={{ width: rem(14), height: rem(14) }} />
        <Text size="xs">PDF</Text>
      </Group>
    ),
  },
  {
    value: "docx",
    label: (
      <Group gap={4} wrap="nowrap">
        <FileType style={{ width: rem(14), height: rem(14) }} />
        <Text size="xs">Word</Text>
      </Group>
    ),
  },
  {
    value: "txt",
    label: (
      <Group gap={4} wrap="nowrap">
        <FileCode style={{ width: rem(14), height: rem(14) }} />
        <Text size="xs">Text</Text>
      </Group>
    ),
  },
  {
    value: "json",
    label: (
      <Group gap={4} wrap="nowrap">
        <Braces style={{ width: rem(14), height: rem(14) }} />
        <Text size="xs">JSON</Text>
      </Group>
    ),
  },
];

/**
 * Local storage key for persisting preferences
 */
const STORAGE_KEY = "analysis-export-options";

/**
 * Load saved options from localStorage
 */
function loadSavedOptions(): Partial<ExportOptions> & { format?: ExportFormat } {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

/**
 * Save options to localStorage
 */
function saveOptions(
  options: ExportOptions & { format: ExportFormat }
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Export Options Modal Component
 */
export function ExportOptionsModal({
  opened,
  onClose,
  analysis,
  transcript,
  template,
}: ExportOptionsModalProps) {
  // Load initial state from localStorage
  const savedOptions = React.useMemo(() => loadSavedOptions(), []);

  const [format, setFormat] = React.useState<ExportFormat>(
    savedOptions.format || "pdf"
  );
  const [options, setOptions] = React.useState<ExportOptions>({
    ...DEFAULT_EXPORT_OPTIONS,
    ...savedOptions,
  });
  const [isExporting, setIsExporting] = React.useState(false);

  // Calculate counts for display
  const sectionCount = analysis.results.sections.length;
  const benchmarkCount = analysis.results.benchmarks?.length || 0;
  const radioReportCount = analysis.results.radioReports?.length || 0;
  const safetyEventCount = analysis.results.safetyEvents?.length || 0;

  // Estimate file size
  const estimatedSize = React.useMemo(
    () => estimateExportSize(analysis, format, options),
    [analysis, format, options]
  );

  /**
   * Update a single option
   */
  const updateOption = React.useCallback(
    (key: keyof ExportOptions, value: boolean) => {
      setOptions((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  /**
   * Handle export
   */
  const handleExport = React.useCallback(async () => {
    setIsExporting(true);

    try {
      // Save preferences
      saveOptions({ ...options, format });

      // Generate export
      const result = await exportAnalysis(
        analysis,
        transcript,
        template,
        format,
        options
      );

      // Download
      downloadExport(result);

      notifications.show({
        title: "Export Successful",
        message: `Analysis exported as ${result.filename}`,
        color: "green",
      });

      onClose();
    } catch (error) {
      console.error("Export failed:", error);
      notifications.show({
        title: "Export Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to export analysis. Please try again.",
        color: "red",
      });
    } finally {
      setIsExporting(false);
    }
  }, [analysis, transcript, template, format, options, onClose]);

  /**
   * Get format-specific label for the export button
   */
  const getExportButtonLabel = () => {
    const labels: Record<ExportFormat, string> = {
      pdf: "Export PDF",
      docx: "Export Word",
      txt: "Export Text",
      json: "Export JSON",
    };
    return labels[format];
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text size="lg" fw={600}>
          Export Analysis
        </Text>
      }
      size="md"
      centered
    >
      <Stack gap="md">
        {/* Format Selection */}
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Format
          </Text>
          <SegmentedControl
            value={format}
            onChange={(value) => setFormat(value as ExportFormat)}
            data={FORMAT_DATA}
            fullWidth
          />
        </Stack>

        <Divider />

        {/* Content Options */}
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Include Sections
          </Text>

          <Paper withBorder p="sm" radius="md">
            <Stack gap="xs">
              {analysis.results.summary && (
                <Checkbox
                  label="Executive Summary"
                  checked={options.includeSummary}
                  onChange={(e) =>
                    updateOption("includeSummary", e.currentTarget.checked)
                  }
                />
              )}

              <Checkbox
                label={
                  <Group gap="xs">
                    <Text size="sm">Analysis Sections</Text>
                    <Badge size="xs" variant="light">
                      {sectionCount}
                    </Badge>
                  </Group>
                }
                checked={options.includeSections}
                onChange={(e) =>
                  updateOption("includeSections", e.currentTarget.checked)
                }
              />

              {options.includeSections && (
                <Checkbox
                  label="Include evidence citations"
                  checked={options.includeEvidence}
                  onChange={(e) =>
                    updateOption("includeEvidence", e.currentTarget.checked)
                  }
                  ml="md"
                  size="xs"
                />
              )}

              {benchmarkCount > 0 && (
                <Checkbox
                  label={
                    <Group gap="xs">
                      <Text size="sm">Benchmarks</Text>
                      <Badge size="xs" variant="light" color="teal">
                        {benchmarkCount}
                      </Badge>
                    </Group>
                  }
                  checked={options.includeBenchmarks}
                  onChange={(e) =>
                    updateOption("includeBenchmarks", e.currentTarget.checked)
                  }
                />
              )}

              {radioReportCount > 0 && (
                <Checkbox
                  label={
                    <Group gap="xs">
                      <Text size="sm">Radio Reports</Text>
                      <Badge size="xs" variant="light" color="indigo">
                        {radioReportCount}
                      </Badge>
                    </Group>
                  }
                  checked={options.includeRadioReports}
                  onChange={(e) =>
                    updateOption("includeRadioReports", e.currentTarget.checked)
                  }
                />
              )}

              {safetyEventCount > 0 && (
                <Checkbox
                  label={
                    <Group gap="xs">
                      <Text size="sm">Safety Events</Text>
                      <Badge size="xs" variant="light" color="red">
                        {safetyEventCount}
                      </Badge>
                    </Group>
                  }
                  checked={options.includeSafetyEvents}
                  onChange={(e) =>
                    updateOption("includeSafetyEvents", e.currentTarget.checked)
                  }
                />
              )}

              <Checkbox
                label="Document Metadata"
                checked={options.includeMetadata}
                onChange={(e) =>
                  updateOption("includeMetadata", e.currentTarget.checked)
                }
              />

              {(format === "pdf" || format === "docx") && (
                <Checkbox
                  label="Table of Contents"
                  checked={options.includeTOC}
                  onChange={(e) =>
                    updateOption("includeTOC", e.currentTarget.checked)
                  }
                />
              )}
            </Stack>
          </Paper>
        </Stack>

        {/* Preview Info */}
        <Group justify="space-between" px="xs">
          <Text size="xs" c="dimmed">
            Estimated size: {estimatedSize}
          </Text>
        </Group>

        <Divider />

        {/* Actions */}
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            leftSection={
              isExporting ? (
                <Loader size={16} color="white" />
              ) : (
                <Download style={{ width: rem(16), height: rem(16) }} />
              )
            }
            onClick={handleExport}
            loading={isExporting}
          >
            {getExportButtonLabel()}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ExportOptionsModal;
