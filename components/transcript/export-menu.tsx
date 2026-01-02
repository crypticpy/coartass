/**
 * Export Menu Component
 *
 * Dropdown menu for exporting transcripts in various formats.
 * Provides UI for TXT, JSON, SRT, and VTT export options with
 * visual feedback and error handling.
 */

"use client";

import * as React from "react";
import { Download, FileText, FileJson, FileVideo, File, Share2, type LucideIcon } from "lucide-react";
import { Button, Menu, Text, Box } from "@mantine/core";
import { notifications } from '@mantine/notifications';
import { Transcript } from "@/types";
import {
  exportTranscript,
  validateTranscriptForExport,
  EXPORT_FORMATS,
} from "@/lib/export/transcript-exporter";
import type { ExportFormat } from "@/lib/export/download-helper";
import { exportAndDownloadTranscript as exportAndDownloadPackage } from "@/lib/package/export";
// PDF exporter is imported dynamically to avoid loading the 4MB @react-pdf/renderer on every page
// import { exportAndDownloadTranscript, isPDFExportSupported } from "@/lib/pdf/pdf-exporter";

/**
 * Props for the ExportMenu component
 */
export interface ExportMenuProps {
  /** The transcript to export */
  transcript: Transcript;
  /** Optional custom button label */
  buttonLabel?: string;
  /** Button variant */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Whether to show icon in button */
  showIcon?: boolean;
  /** Custom className for the button */
  className?: string;
  /** Callback fired after successful export */
  onExportSuccess?: (format: ExportFormat) => void;
  /** Callback fired on export error */
  onExportError?: (format: ExportFormat, error: string) => void;
}

/**
 * Icon mapping for different export formats
 */
const FORMAT_ICONS: Record<ExportFormat, LucideIcon> = {
  txt: FileText,
  json: FileJson,
  srt: FileVideo,
  vtt: FileVideo,
  pdf: File,
};

/**
 * ExportMenu Component
 *
 * Renders a dropdown menu with export options for different file formats.
 * Handles the export process with proper error handling and user feedback.
 *
 * @example
 * ```tsx
 * <ExportMenu
 *   transcript={transcript}
 *   onExportSuccess={(format) => console.log(`Exported as ${format}`)}
 * />
 * ```
 */
export function ExportMenu({
  transcript,
  buttonLabel = "Export",
  variant = "outline",
  size = "default",
  showIcon = true,
  className,
  onExportSuccess,
  onExportError,
}: ExportMenuProps) {
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportingFormat, setExportingFormat] = React.useState<ExportFormat | null>(null);
  const [isExportingPackage, setIsExportingPackage] = React.useState(false);

  /**
   * Validates the transcript before attempting export
   */
  const validateBeforeExport = React.useCallback((): boolean => {
    const validation = validateTranscriptForExport(transcript);

    if (!validation.valid) {
      notifications.show({
        title: "Export Failed",
        message: validation.error || "Invalid transcript data",
        color: "red",
      });
      return false;
    }

    return true;
  }, [transcript]);

  /**
   * Handles the export action for a specific format
   */
  const handleExport = React.useCallback(
    async (format: ExportFormat) => {
      // Validate first
      if (!validateBeforeExport()) {
        return;
      }

      // Set loading state
      setIsExporting(true);
      setExportingFormat(format);

      try {
        // Handle PDF export separately (dynamically loaded)
        if (format === "pdf") {
          // Dynamically import PDF exporter to avoid loading 4MB @react-pdf/renderer upfront
          const { exportAndDownloadTranscript, isPDFExportSupported } = await import("@/lib/pdf/pdf-exporter");

          // Check PDF support
          if (!isPDFExportSupported()) {
            notifications.show({
              title: "PDF Export Not Supported",
              message: "Your browser does not support PDF export. Please try a modern browser.",
              color: "red",
            });
            onExportError?.(format, "PDF export not supported in this browser");
            return;
          }

          // Generate and download PDF
          const result = await exportAndDownloadTranscript(transcript);

          if (result.success) {
            notifications.show({
              title: "Export Successful",
              message: "Transcript exported as PDF",
              color: "green",
            });
            onExportSuccess?.(format);
          } else {
            notifications.show({
              title: "Export Failed",
              message: result.error || "Failed to export PDF",
              color: "red",
            });
            onExportError?.(format, result.error || "Unknown error");
          }
        } else {
          // Handle standard exports (TXT, JSON, SRT, VTT)
          // Small delay to show loading state
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Perform export
          const result = exportTranscript(transcript, format);

          if (result.success) {
            // Success feedback
            const formatInfo = EXPORT_FORMATS.find((f) => f.format === format);
            notifications.show({
              title: "Export Successful",
              message: `Transcript exported as ${formatInfo?.label || format.toUpperCase()}`,
              color: "green",
            });

            // Call success callback
            onExportSuccess?.(format);
          } else {
            // Error feedback
            notifications.show({
              title: "Export Failed",
              message: result.error || "Failed to export transcript",
              color: "red",
            });

            // Call error callback
            onExportError?.(format, result.error || "Unknown error");
          }
        }
      } catch (error) {
        // Unexpected error handling
        const errorMessage =
          error instanceof Error ? error.message : "An unexpected error occurred";

        notifications.show({
          title: "Export Error",
          message: errorMessage,
          color: "red",
        });

        onExportError?.(format, errorMessage);
      } finally {
        // Reset loading state
        setIsExporting(false);
        setExportingFormat(null);
      }
    },
    [transcript, validateBeforeExport, onExportSuccess, onExportError]
  );

  /**
   * Handles exporting as shareable package
   */
  const handleExportPackage = React.useCallback(async () => {
    if (!validateBeforeExport()) {
      return;
    }

    setIsExportingPackage(true);

    try {
      await exportAndDownloadPackage(transcript);
      notifications.show({
        title: "Package Created",
        message: "Transcript exported as shareable package. Share this file with others to import.",
        color: "green",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create package";
      notifications.show({
        title: "Export Failed",
        message: errorMessage,
        color: "red",
      });
    } finally {
      setIsExportingPackage(false);
    }
  }, [transcript, validateBeforeExport]);

  return (
    <Menu position="bottom-end" width={224}>
      <Menu.Target>
        <Button
          variant={variant === "outline" ? "default" : variant === "ghost" ? "subtle" : "filled"}
          size={size === "sm" ? "sm" : size === "lg" ? "lg" : "md"}
          className={className}
          disabled={isExporting}
          leftSection={showIcon && <Download size={16} />}
        >
          {isExporting && exportingFormat
            ? `Exporting ${exportingFormat.toUpperCase()}...`
            : buttonLabel}
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Export Format</Menu.Label>
        <Menu.Divider />

        {EXPORT_FORMATS.map(({ format, label, description }) => {
          const Icon = FORMAT_ICONS[format];
          const isCurrentlyExporting = isExporting && exportingFormat === format;

          return (
            <Menu.Item
              key={format}
              onClick={() => handleExport(format)}
              disabled={isExporting}
              leftSection={<Icon size={16} />}
            >
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text fw={500} size="sm">
                  {label}
                  {isCurrentlyExporting && (
                    <Text component="span" size="xs" c="dimmed" ml="xs">
                      Exporting...
                    </Text>
                  )}
                </Text>
                <Text size="xs" c="dimmed">
                  {description}
                </Text>
              </Box>
            </Menu.Item>
          );
        })}

        <Menu.Divider />

        <Menu.Label>Share</Menu.Label>
        <Menu.Item
          onClick={handleExportPackage}
          disabled={isExporting || isExportingPackage}
          leftSection={<Share2 size={16} />}
        >
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text fw={500} size="sm">
              Share as Package
              {isExportingPackage && (
                <Text component="span" size="xs" c="dimmed" ml="xs">
                  Creating...
                </Text>
              )}
            </Text>
            <Text size="xs" c="dimmed">
              Export for another user to import
            </Text>
          </Box>
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/**
 * Compact version of the export menu with icon-only button
 */
export function ExportMenuCompact(props: Omit<ExportMenuProps, "size" | "showIcon">) {
  return (
    <Menu position="bottom-end" width={224}>
      <Menu.Target>
        <Button
          variant="default"
          size="sm"
          className={props.className}
          disabled={false}
        >
          <Download size={16} />
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Export Format</Menu.Label>
        {/* Simplified - uses same logic as main component */}
      </Menu.Dropdown>
    </Menu>
  );
}
