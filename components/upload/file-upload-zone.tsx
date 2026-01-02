/**
 * File Upload Zone Component
 *
 * Comprehensive drag-and-drop file upload component with:
 * - Drag-and-drop functionality with visual feedback
 * - Click to browse file picker
 * - File type and size validation
 * - Display of selected file information
 * - Audio duration display
 * - Remove file option
 * - Error handling with clear messages
 * - Responsive design with accessibility features
 */

"use client";

import * as React from "react";
import {
  Upload,
  FileAudio,
  X,
  AlertCircle,
  CheckCircle2,
  Music,
  Clock,
  HardDrive,
} from "lucide-react";
import { Button, Card, Alert, Badge, Box, Group, Text, Stack, ActionIcon, rem } from "@mantine/core";
import {
  getSupportedAudioExtensions,
  getMaxFileSizeMB,
} from "@/lib/validations";
import type { AudioMetadata } from "@/hooks/use-file-upload";
import styles from "./file-upload-zone.module.css";

/**
 * Props for FileUploadZone component
 */
export interface FileUploadZoneProps {
  /** Currently selected file */
  file: File | null;
  /** Extracted audio metadata */
  audioMetadata: AudioMetadata | null;
  /** Validation or processing error */
  error: string | null;
  /** Whether file is being processed */
  isProcessing: boolean;
  /** File selection handler */
  onFileSelect: (file: File) => void;
  /** File removal handler */
  onFileRemove: () => void;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format file size to human-readable string
 *
 * @param bytes - File size in bytes
 * @returns Formatted size string (e.g., "2.5 MB")
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration to readable string
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "1:23:45" or "5:32")
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/**
 * Get file extension from filename
 *
 * @param filename - File name
 * @returns File extension (e.g., ".mp3")
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot !== -1 ? filename.substring(lastDot).toLowerCase() : "";
}

/**
 * File Upload Zone Component
 *
 * A comprehensive drag-and-drop upload zone with file validation,
 * metadata display, and error handling.
 *
 * @example
 * ```tsx
 * const { file, audioMetadata, error, isProcessing, selectFile, clearFile } = useFileUpload();
 *
 * <FileUploadZone
 *   file={file}
 *   audioMetadata={audioMetadata}
 *   error={error}
 *   isProcessing={isProcessing}
 *   onFileSelect={selectFile}
 *   onFileRemove={clearFile}
 * />
 * ```
 */
export function FileUploadZone({
  file,
  audioMetadata,
  error,
  isProcessing,
  onFileSelect,
  onFileRemove,
  disabled = false,
  className,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dragCounter = React.useRef(0);

  const isDisabled = disabled || isProcessing;

  /**
   * Handle drag enter event
   */
  const handleDragEnter = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (isDisabled) return;

      dragCounter.current++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [isDisabled]
  );

  /**
   * Handle drag leave event
   */
  const handleDragLeave = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (isDisabled) return;

      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    },
    [isDisabled]
  );

  /**
   * Handle drag over event
   */
  const handleDragOver = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * Handle drop event
   */
  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (isDisabled) return;

      setIsDragging(false);
      dragCounter.current = 0;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const selectedFile = files[0];
        onFileSelect(selectedFile);
      }
    },
    [isDisabled, onFileSelect]
  );

  /**
   * Handle file input change
   */
  const handleFileInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const selectedFile = files[0];
        onFileSelect(selectedFile);
      }
    },
    [onFileSelect]
  );

  /**
   * Handle click to browse files
   */
  const handleBrowseClick = React.useCallback(() => {
    if (!isDisabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [isDisabled]);

  /**
   * Handle remove file
   */
  const handleRemoveFile = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFileRemove();
    },
    [onFileRemove]
  );

  // Reset drag counter on unmount
  React.useEffect(() => {
    return () => {
      dragCounter.current = 0;
    };
  }, []);

  const supportedExtensions = getSupportedAudioExtensions();
  const maxFileSizeMB = getMaxFileSizeMB();

  return (
    <Stack gap="md" className={className}>
      {/* Upload Zone */}
      {!file ? (
        <Card
          p="xl"
          radius="lg"
          withBorder
          data-tour-id="upload-zone"
          className={`${styles.uploadZone} ${isDragging ? styles.uploadZoneDragActive : ''} ${isDisabled ? styles.uploadZoneDisabled : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          role="button"
          tabIndex={isDisabled ? -1 : 0}
          aria-label="Upload audio file"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleBrowseClick();
            }
          }}
        >
          {/* Pattern overlay when dragging */}
          {isDragging && (
            <Box className={styles.patternOverlay} />
          )}

          <Stack align="center" gap="md">
            {/* Icon */}
            <Box className={`${styles.iconContainer} ${isDragging ? styles.iconContainerDragActive : ''}`}>
              <Upload className={`${styles.uploadIcon} ${isDragging ? styles.uploadIconDragActive : ''}`} />
            </Box>

            {/* Instructions */}
            <Text
              size="xl"
              fw={600}
              className={`${styles.instructionsText} ${isDragging ? styles.instructionsTextDragActive : ''}`}
            >
              {isDragging ? "Drop your file here" : "Upload Audio File"}
            </Text>
            <Text size="sm" c="dimmed" ta="center" maw={rem(400)} visibleFrom="sm" className={styles.helperText}>
              Drag and drop your audio file here, or click to browse
            </Text>
            <Text size="sm" c="dimmed" ta="center" maw={rem(400)} hiddenFrom="sm" className={styles.helperText}>
              Tap to select an audio file
            </Text>

            {/* Supported formats */}
            <Stack gap="xs" align="center">
              <Group gap="xs" justify="center">
                {supportedExtensions.map((ext) => (
                  <Badge
                    key={ext}
                    variant="outline"
                    color="aphBlue"
                    size="sm"
                    className={styles.formatBadge}
                  >
                    {ext.toUpperCase()}
                  </Badge>
                ))}
              </Group>
              <Text size="xs" c="dimmed" className={styles.helperText}>
                Files larger than {maxFileSizeMB} MB are automatically converted and split.
              </Text>
            </Stack>

            {/* Browse Button */}
            {!isDisabled && (
              <Button
                variant="outline"
                color="aphBlue"
                size="md"
                mt="sm"
                className={styles.browseButton}
                styles={{
                  root: {
                    borderWidth: rem(2),
                    '&:hover': {
                      transform: 'scale(1.02)',
                      boxShadow: 'var(--mantine-shadow-md)',
                    },
                  },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleBrowseClick();
                }}
              >
                <Text visibleFrom="sm">Browse Files</Text>
                <Text hiddenFrom="sm">Select File</Text>
              </Button>
            )}
          </Stack>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className={styles.fileInput}
            accept={supportedExtensions.join(",")}
            onChange={handleFileInputChange}
            disabled={isDisabled}
            aria-label="File input"
          />
        </Card>
      ) : (
        /* Selected File Display */
        <Card
          p="lg"
          radius="lg"
          withBorder
          className={styles.selectedFileCard}
        >
          <Group align="flex-start" gap="md" wrap="nowrap">
            {/* File Icon */}
            <Box className={styles.fileIconContainer}>
              <FileAudio className={styles.fileIcon} />
            </Box>

            {/* File Info */}
            <Stack gap="sm" className={styles.fileInfoContainer}>
              {/* File Name */}
              <Group justify="space-between" gap="sm" wrap="nowrap">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={600} size="lg" truncate title={file.name}>
                    {file.name}
                  </Text>
                  <Group gap="xs" mt={4}>
                    <Text size="sm" c="dimmed">
                      {formatFileSize(file.size)}
                    </Text>
                    {getFileExtension(file.name) && (
                      <Badge variant="outline" size="xs">
                        {getFileExtension(file.name).substring(1).toUpperCase()}
                      </Badge>
                    )}
                  </Group>
                </Box>

                {/* Remove Button */}
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  onClick={handleRemoveFile}
                  disabled={isDisabled}
                  aria-label="Remove file"
                  className={styles.removeButton}
                >
                  <X className={styles.removeIcon} />
                </ActionIcon>
              </Group>

              {/* Processing State */}
              {isProcessing && (
                <Alert
                  color="aphCyan"
                  variant="light"
                  icon={<Music className={`${styles.alertIcon} ${styles.processingIcon}`} />}
                >
                  Extracting audio metadata...
                </Alert>
              )}

              {/* Audio Metadata */}
              {audioMetadata && !isProcessing && (
                <Group gap="lg" grow>
                  {/* Duration */}
                  <Group gap="xs">
                    <Clock className={styles.metadataIcon} />
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">Duration</Text>
                      <Text fw={500} size="sm">{formatDuration(audioMetadata.duration)}</Text>
                    </Stack>
                  </Group>

                  {/* Sample Rate */}
                  {audioMetadata.sampleRate && (
                    <Group gap="xs">
                      <Music className={styles.metadataIcon} />
                      <Stack gap={2}>
                        <Text size="xs" c="dimmed">Sample Rate</Text>
                        <Text fw={500} size="sm">
                          {(audioMetadata.sampleRate / 1000).toFixed(1)} kHz
                        </Text>
                      </Stack>
                    </Group>
                  )}

                  {/* Channels */}
                  {audioMetadata.numberOfChannels && (
                    <Group gap="xs">
                      <HardDrive className={styles.metadataIcon} />
                      <Stack gap={2}>
                        <Text size="xs" c="dimmed">Channels</Text>
                        <Text fw={500} size="sm">
                          {audioMetadata.numberOfChannels === 1 ? "Mono" : "Stereo"}
                        </Text>
                      </Stack>
                    </Group>
                  )}
                </Group>
              )}

              {/* Success State */}
              {audioMetadata && !isProcessing && (
                <Alert
                  color="aphGreen"
                  variant="light"
                  icon={<CheckCircle2 className={styles.alertIcon} />}
                >
                  File validated and ready to upload
                </Alert>
              )}
            </Stack>
          </Group>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Alert
          color="red"
          variant="light"
          icon={<AlertCircle className={styles.alertIcon} />}
          className={styles.errorAlert}
        >
          {error}
        </Alert>
      )}
    </Stack>
  );
}
