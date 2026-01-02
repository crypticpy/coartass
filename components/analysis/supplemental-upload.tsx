/**
 * Supplemental Upload Component
 *
 * Allows users to upload Word docs, PDFs, PowerPoint files, or paste text
 * to provide additional context for transcript analysis.
 *
 * Features:
 * - Checkbox toggle to enable/disable
 * - Multi-file drag-and-drop upload
 * - Plain text paste area
 * - Document list with token counts
 * - Token impact visualization
 * - Warning when approaching limits
 */

'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  Box,
  Checkbox,
  Stack,
  Text,
  Paper,
  Group,
  ActionIcon,
  Progress,
  Alert,
  Textarea,
  Collapse,
  Badge,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  Upload,
  FileText,
  FileType,
  Presentation,
  File,
  X,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Info,
} from 'lucide-react';
import type { SupplementalDocument } from '@/types/supplemental';
import { SUPPLEMENTAL_LIMITS, getDocumentTypeLabel } from '@/types/supplemental';
import { getTokenWarningLevel, formatTokenCount } from '@/hooks/use-supplemental-upload';

/**
 * Props for the SupplementalUpload component.
 */
export interface SupplementalUploadProps {
  /** Whether supplemental upload is enabled */
  enabled: boolean;
  /** Callback when enabled state changes */
  onEnabledChange: (enabled: boolean) => void;
  /** List of uploaded documents */
  documents: SupplementalDocument[];
  /** Pasted text content */
  pastedText: string;
  /** Token count for pasted text */
  pastedTextTokens: number;
  /** Combined token count */
  totalTokens: number;
  /** Whether parsing is in progress */
  isProcessing: boolean;
  /** Callback to add files */
  onAddFiles: (files: File[]) => Promise<void>;
  /** Callback to remove a document */
  onRemoveDocument: (id: string) => void;
  /** Callback to update pasted text */
  onPastedTextChange: (text: string) => void;
  /** Transcript token count (for context limit calculation) */
  transcriptTokens: number;
  /** Context limit (default: 256k for GPT-5) */
  contextLimit?: number;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * Render icon for document type.
 * Returns JSX element directly to avoid React's "Components created during render" warning.
 */
function renderDocTypeIcon(type: string, size: number = 14) {
  switch (type) {
    case 'docx':
      return <FileText size={size} />;
    case 'pdf':
      return <FileType size={size} />;
    case 'pptx':
      return <Presentation size={size} />;
    case 'txt':
    case 'pasted':
    default:
      return <File size={size} />;
  }
}

/**
 * Format file size for display.
 */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Supplemental Upload Component.
 */
export function SupplementalUpload({
  enabled,
  onEnabledChange,
  documents,
  pastedText,
  pastedTextTokens,
  totalTokens,
  isProcessing,
  onAddFiles,
  onRemoveDocument,
  onPastedTextChange,
  transcriptTokens,
  contextLimit = 256000,
  disabled = false,
}: SupplementalUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteExpanded, setPasteExpanded] = useState(false);

  // Calculate token usage
  const combinedTokens = transcriptTokens + totalTokens;
  const usagePercent = Math.min((combinedTokens / contextLimit) * 100, 100);
  const warningLevel = getTokenWarningLevel(totalTokens, transcriptTokens, contextLimit);

  // Handle file selection
  const handleFileSelect = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length > 0) {
        await onAddFiles(fileArray);
      }
    },
    [onAddFiles]
  );

  // Handle file input change
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
        handleFileSelect(event.target.files);
        // Reset input so the same file can be selected again
        event.target.value = '';
      }
    },
    [handleFileSelect]
  );

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files) {
        handleFileSelect(e.dataTransfer.files);
      }
    },
    [handleFileSelect]
  );

  // Open file picker
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Count ready documents
  const readyDocCount = documents.filter((d) => d.status === 'ready').length;
  const hasContent = readyDocCount > 0 || pastedText.trim().length > 0;

  return (
    <Paper p="md" withBorder radius="md">
      <Stack gap="md">
        {/* Enable checkbox */}
        <Checkbox
          label={
            <Group gap="xs">
              <Text size="sm" fw={500}>
                Add supplemental source material
              </Text>
              <Tooltip
                label="Upload Word docs, PDFs, PowerPoints, or paste text to provide additional context for analysis"
                multiline
                w={300}
              >
                <ThemeIcon size="xs" variant="subtle" color="gray">
                  <Info size={14} />
                </ThemeIcon>
              </Tooltip>
            </Group>
          }
          checked={enabled}
          onChange={(e) => onEnabledChange(e.currentTarget.checked)}
          disabled={disabled}
        />

        <Collapse in={enabled}>
          <Stack gap="md">
            {/* File drop zone */}
            <Paper
              p="lg"
              withBorder
              radius="md"
              style={{
                borderStyle: 'dashed',
                borderColor: isDragging
                  ? 'var(--mantine-color-blue-5)'
                  : 'var(--mantine-color-gray-4)',
                backgroundColor: isDragging
                  ? 'var(--mantine-color-blue-0)'
                  : 'var(--mantine-color-gray-0)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 150ms ease',
              }}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={disabled ? undefined : openFilePicker}
            >
              <Stack align="center" gap="xs">
                <ThemeIcon size="xl" variant="light" color="blue" radius="xl">
                  <Upload size={24} />
                </ThemeIcon>
                <Text size="sm" c="dimmed" ta="center">
                  {isDragging ? (
                    'Drop files here'
                  ) : (
                    <>
                      <Text component="span" fw={500} c="blue">
                        Click to upload
                      </Text>{' '}
                      or drag and drop
                    </>
                  )}
                </Text>
                <Text size="xs" c="dimmed">
                  Word (.docx), PDF, PowerPoint (.pptx), Text (.txt)
                </Text>
              </Stack>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={SUPPLEMENTAL_LIMITS.SUPPORTED_EXTENSIONS.join(',')}
                onChange={handleInputChange}
                style={{ display: 'none' }}
                disabled={disabled}
              />
            </Paper>

            {/* Paste text section */}
            <Box>
              <Group
                gap="xs"
                mb="xs"
                style={{ cursor: 'pointer' }}
                onClick={() => setPasteExpanded(!pasteExpanded)}
              >
                {pasteExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <ClipboardPaste size={16} />
                <Text size="sm" fw={500}>
                  Or paste text directly
                </Text>
                {pastedTextTokens > 0 && (
                  <Badge size="xs" variant="light">
                    ~{formatTokenCount(pastedTextTokens)} tokens
                  </Badge>
                )}
              </Group>
              <Collapse in={pasteExpanded}>
                <Textarea
                  placeholder="Paste meeting notes, agenda, or other reference text here..."
                  minRows={4}
                  maxRows={10}
                  autosize
                  value={pastedText}
                  onChange={(e) => onPastedTextChange(e.currentTarget.value)}
                  disabled={disabled}
                />
              </Collapse>
            </Box>

            {/* Document list */}
            {documents.length > 0 && (
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Uploaded Documents ({readyDocCount} ready)
                </Text>
                {documents.map((doc) => (
                  <DocumentItem
                    key={doc.id}
                    document={doc}
                    onRemove={() => onRemoveDocument(doc.id)}
                    disabled={disabled}
                  />
                ))}
              </Stack>
            )}

            {/* Token impact section */}
            {hasContent && (
              <Paper p="sm" withBorder radius="sm" bg="gray.0">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      Token Impact
                    </Text>
                    <Text
                      size="sm"
                      fw={600}
                      c={warningLevel === 'critical' ? 'red' : warningLevel === 'warning' ? 'orange' : 'dimmed'}
                    >
                      {usagePercent.toFixed(0)}% of context
                    </Text>
                  </Group>

                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        Transcript
                      </Text>
                      <Text size="xs" c="dimmed">
                        ~{formatTokenCount(transcriptTokens)} tokens
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        Supplemental
                      </Text>
                      <Text size="xs" c="dimmed">
                        ~{formatTokenCount(totalTokens)} tokens
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" fw={500}>
                        Total
                      </Text>
                      <Text size="xs" fw={500}>
                        ~{formatTokenCount(combinedTokens)} tokens
                      </Text>
                    </Group>
                  </Stack>

                  <Progress
                    value={usagePercent}
                    color={warningLevel === 'critical' ? 'red' : warningLevel === 'warning' ? 'orange' : 'blue'}
                    size="sm"
                    radius="xl"
                  />

                  {warningLevel !== 'none' && (
                    <Alert
                      variant="light"
                      color={warningLevel === 'critical' ? 'red' : 'orange'}
                      icon={<AlertTriangle size={16} />}
                      p="xs"
                    >
                      <Text size="xs">
                        {warningLevel === 'critical'
                          ? 'Context limit nearly exceeded. Remove some materials to ensure analysis completes.'
                          : 'High token usage. Analysis may be truncated if limit is exceeded.'}
                      </Text>
                    </Alert>
                  )}
                </Stack>
              </Paper>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <Group gap="xs" c="dimmed">
                <Loader2 size={16} className="animate-spin" />
                <Text size="sm">Processing documents...</Text>
              </Group>
            )}
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}

/**
 * Document item in the list.
 */
function DocumentItem({
  document: doc,
  onRemove,
  disabled,
}: {
  document: SupplementalDocument;
  onRemove: () => void;
  disabled: boolean;
}) {
  const isError = doc.status === 'error';
  const isParsing = doc.status === 'parsing';

  return (
    <Paper
      p="xs"
      withBorder
      radius="sm"
      style={{
        borderColor: isError ? 'var(--mantine-color-red-4)' : undefined,
        backgroundColor: isError ? 'var(--mantine-color-red-0)' : undefined,
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          <ThemeIcon
            size="sm"
            variant="light"
            color={isError ? 'red' : 'gray'}
            style={{ flexShrink: 0 }}
          >
            {isParsing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isError ? (
              <AlertCircle size={14} />
            ) : (
              renderDocTypeIcon(doc.type)
            )}
          </ThemeIcon>
          <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
            <Text size="sm" truncate>
              {doc.filename}
            </Text>
            {isError && doc.error && (
              <Text size="xs" c="red">
                {doc.error}
              </Text>
            )}
            {!isError && doc.warnings && doc.warnings.length > 0 && (
              <Text size="xs" c="orange">
                {doc.warnings[0]}
              </Text>
            )}
            {!isError && !isParsing && (
              <Group gap="xs">
                <Text size="xs" c="dimmed">
                  {getDocumentTypeLabel(doc.type)}
                </Text>
                {doc.fileSize && (
                  <Text size="xs" c="dimmed">
                    • {formatFileSize(doc.fileSize)}
                  </Text>
                )}
              </Group>
            )}
          </Stack>
        </Group>

        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          {!isError && !isParsing && (
            <Badge size="xs" variant="light" color="blue">
              ~{formatTokenCount(doc.tokenCount)} tokens
            </Badge>
          )}
          <Tooltip label="Remove">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={onRemove}
              disabled={disabled}
            >
              <X size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  );
}
