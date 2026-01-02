/**
 * Analysis Export Menu Component
 *
 * Dropdown menu for exporting analysis results to various formats.
 * Provides quick export with default options or opens customization modal.
 */

"use client";

import * as React from "react";
import {
  Menu,
  Button,
  Text,
  Group,
  Divider,
  Loader,
  rem,
} from "@mantine/core";
import {
  Download,
  FileText,
  FileType,
  FileCode,
  Braces,
  Settings,
  ChevronDown,
  Share2,
} from "lucide-react";
import { notifications } from "@mantine/notifications";
import type { Analysis, Transcript, Template } from "@/types";
import {
  exportAnalysis,
  downloadExport,
  type ExportFormat,
} from "@/lib/export/analysis-exporter";
import { exportAndDownloadAnalysis } from "@/lib/package/export";

/**
 * Props for AnalysisExportMenu
 */
export interface AnalysisExportMenuProps {
  /** The analysis to export */
  analysis: Analysis;
  /** The source transcript */
  transcript: Transcript;
  /** The template used for analysis */
  template: Template;
  /** Callback to open the options modal */
  onOpenOptions?: () => void;
  /** Whether the menu is disabled */
  disabled?: boolean;
  /** Button variant */
  variant?: "filled" | "outline" | "light" | "subtle";
  /** Button size */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

/**
 * Format icons mapping
 */
const FORMAT_ICONS: Record<ExportFormat, React.FC<{ style?: React.CSSProperties }>> = {
  pdf: FileText,
  docx: FileType,
  txt: FileCode,
  json: Braces,
};

/**
 * Format labels and descriptions
 */
const FORMAT_INFO: Record<ExportFormat, { label: string; description: string }> = {
  pdf: { label: "PDF Document", description: "Professional report for printing" },
  docx: { label: "Word Document", description: "Editable in Microsoft Word" },
  txt: { label: "Plain Text", description: "Universal text format" },
  json: { label: "JSON Data", description: "Structured data for integrations" },
};

/**
 * Analysis Export Menu Component
 */
export function AnalysisExportMenu({
  analysis,
  transcript,
  template,
  onOpenOptions,
  disabled = false,
  variant = "outline",
  size = "md",
}: AnalysisExportMenuProps) {
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportingFormat, setExportingFormat] = React.useState<ExportFormat | null>(
    null
  );
  const [isExportingPackage, setIsExportingPackage] = React.useState(false);

  /**
   * Handle exporting as shareable package (includes transcript)
   */
  const handleExportPackage = React.useCallback(async () => {
    setIsExportingPackage(true);

    try {
      await exportAndDownloadAnalysis(analysis, transcript, template);
      notifications.show({
        title: "Package Created",
        message: "Analysis and transcript exported as shareable package.",
        color: "green",
      });
    } catch (error) {
      console.error("Package export failed:", error);
      notifications.show({
        title: "Export Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create package. Please try again.",
        color: "red",
      });
    } finally {
      setIsExportingPackage(false);
    }
  }, [analysis, transcript, template]);

  /**
   * Handle quick export with default options
   */
  const handleQuickExport = React.useCallback(
    async (format: ExportFormat) => {
      setIsExporting(true);
      setExportingFormat(format);

      try {
        const result = await exportAnalysis(
          analysis,
          transcript,
          template,
          format
        );

        downloadExport(result);

        notifications.show({
          title: "Export Successful",
          message: `Analysis exported as ${FORMAT_INFO[format].label}`,
          color: "green",
        });
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
        setExportingFormat(null);
      }
    },
    [analysis, transcript, template]
  );

  /**
   * Render format menu item
   */
  const renderFormatItem = (format: ExportFormat) => {
    const Icon = FORMAT_ICONS[format];
    const info = FORMAT_INFO[format];
    const isCurrentlyExporting = exportingFormat === format;

    return (
      <Menu.Item
        key={format}
        leftSection={
          isCurrentlyExporting ? (
            <Loader size={16} />
          ) : (
            <Icon style={{ width: rem(16), height: rem(16) }} />
          )
        }
        onClick={() => handleQuickExport(format)}
        disabled={isExporting}
      >
        <Group gap={4}>
          <Text size="sm" fw={500}>
            {info.label}
          </Text>
          <Text size="xs" c="dimmed">
            (.{format})
          </Text>
        </Group>
      </Menu.Item>
    );
  };

  return (
    <Menu
      shadow="md"
      width={280}
      position="bottom-end"
      withArrow
      arrowPosition="center"
    >
      <Menu.Target>
        <Button
          variant={variant}
          size={size}
          leftSection={
            isExporting ? (
              <Loader size={16} />
            ) : (
              <Download style={{ width: rem(18), height: rem(18) }} />
            )
          }
          rightSection={
            <ChevronDown style={{ width: rem(14), height: rem(14) }} />
          }
          disabled={disabled || isExporting}
          loading={isExporting}
        >
          Export
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Quick Export</Menu.Label>
        {renderFormatItem("pdf")}
        {renderFormatItem("docx")}

        <Divider my="xs" />

        <Menu.Label>Other Formats</Menu.Label>
        {renderFormatItem("txt")}
        {renderFormatItem("json")}

        {onOpenOptions && (
          <>
            <Divider my="xs" />
            <Menu.Item
              leftSection={
                <Settings style={{ width: rem(16), height: rem(16) }} />
              }
              onClick={onOpenOptions}
              disabled={isExporting}
            >
              <Text size="sm" fw={500}>
                Export with Options...
              </Text>
            </Menu.Item>
          </>
        )}

        <Divider my="xs" />

        <Menu.Label>Share</Menu.Label>
        <Menu.Item
          leftSection={
            isExportingPackage ? (
              <Loader size={16} />
            ) : (
              <Share2 style={{ width: rem(16), height: rem(16) }} />
            )
          }
          onClick={handleExportPackage}
          disabled={isExporting || isExportingPackage}
        >
          <Group gap={4}>
            <Text size="sm" fw={500}>
              Share as Package
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            Includes transcript for another user to import
          </Text>
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export default AnalysisExportMenu;
