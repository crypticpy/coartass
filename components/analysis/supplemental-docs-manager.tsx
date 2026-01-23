/**
 * Supplemental Documents Manager Component
 *
 * Manages persistent supplemental documents attached to a transcript.
 * Used on the incident detail page to add, view, and remove documents.
 */

"use client";

import { useCallback, useState } from "react";
import {
  Stack,
  Card,
  Text,
  Group,
  ActionIcon,
  Tooltip,
  Badge,
  ScrollArea,
  Center,
  Button,
  Collapse,
  Box,
  FileButton,
  Textarea,
  Loader,
} from "@mantine/core";
import {
  File,
  Trash2,
  Upload,
  ChevronDown,
  ChevronRight,
  FileText,
  StickyNote,
  AlertTriangle,
} from "lucide-react";
import { useSupplementalDocsPersistent } from "@/hooks/use-supplemental-docs-persistent";
import {
  getDocumentTypeLabel,
  SUPPLEMENTAL_LIMITS,
} from "@/types/supplemental";
import type { PersistedSupplementalDocument } from "@/types/supplemental";
import { formatTokenCount } from "@/hooks/use-supplemental-upload";

export interface SupplementalDocsManagerProps {
  /** The transcript ID to manage documents for */
  transcriptId: string;
  /** Whether the panel is collapsible */
  collapsible?: boolean;
  /** Whether to start collapsed */
  defaultCollapsed?: boolean;
  /** Maximum height for the document list */
  maxHeight?: number | string;
}

/**
 * Panel for managing supplemental documents attached to a transcript.
 */
export function SupplementalDocsManager({
  transcriptId,
  collapsible = true,
  defaultCollapsed = false,
  maxHeight = 400,
}: SupplementalDocsManagerProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const {
    documents,
    isLoading,
    isProcessing,
    error,
    totalTokens,
    addFiles,
    addPastedText,
    removeDocument,
    clearError,
  } = useSupplementalDocsPersistent(transcriptId);

  const handleFileSelect = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        await addFiles(files);
      }
    },
    [addFiles],
  );

  const handlePastedTextSave = useCallback(async () => {
    if (pasteText.trim()) {
      await addPastedText(pasteText.trim());
      setPasteText("");
      setShowPasteInput(false);
    }
  }, [pasteText, addPastedText]);

  const readyDocs = documents.filter((doc) => doc.status === "ready");
  const errorDocs = documents.filter((doc) => doc.status === "error");
  const parsingDocs = documents.filter((doc) => doc.status === "parsing");

  const header = (
    <Group
      justify="space-between"
      onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
      style={{ cursor: collapsible ? "pointer" : "default" }}
    >
      <Group gap="xs">
        {collapsible &&
          (isCollapsed ? (
            <ChevronRight size={18} />
          ) : (
            <ChevronDown size={18} />
          ))}
        <File size={18} />
        <Text size="sm" fw={600}>
          Supplemental Documents
        </Text>
        {documents.length > 0 && (
          <Badge size="sm" variant="light">
            {documents.length}
          </Badge>
        )}
        {totalTokens > 0 && (
          <Badge size="xs" variant="outline" color="gray">
            {formatTokenCount(totalTokens)} tokens
          </Badge>
        )}
      </Group>

      {!collapsible && (
        <FileButton
          onChange={(files) => handleFileSelect(files ? [files] : [])}
          accept={SUPPLEMENTAL_LIMITS.SUPPORTED_EXTENSIONS.join(",")}
        >
          {(props) => (
            <Tooltip label="Upload document">
              <ActionIcon variant="subtle" {...props} disabled={isProcessing}>
                <Upload size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </FileButton>
      )}
    </Group>
  );

  const content = (
    <Stack gap="md">
      {/* Error message */}
      {error && (
        <Card
          padding="xs"
          radius="sm"
          withBorder
          style={{ borderColor: "var(--mantine-color-red-5)" }}
        >
          <Group gap="xs">
            <AlertTriangle size={16} color="var(--mantine-color-red-6)" />
            <Text size="sm" c="red">
              {error}
            </Text>
            <ActionIcon size="xs" variant="subtle" onClick={clearError}>
              <Trash2 size={12} />
            </ActionIcon>
          </Group>
        </Card>
      )}

      {/* Upload actions */}
      <Group gap="sm">
        <FileButton
          onChange={(files) => handleFileSelect(files ? [files] : [])}
          accept={SUPPLEMENTAL_LIMITS.SUPPORTED_EXTENSIONS.join(",")}
        >
          {(props) => (
            <Button
              variant="light"
              size="xs"
              leftSection={<Upload size={14} />}
              disabled={isProcessing}
              {...props}
            >
              Upload File
            </Button>
          )}
        </FileButton>

        <Button
          variant="subtle"
          size="xs"
          leftSection={<StickyNote size={14} />}
          onClick={() => setShowPasteInput(!showPasteInput)}
          disabled={isProcessing}
        >
          Paste Text
        </Button>
      </Group>

      {/* Paste text input */}
      <Collapse in={showPasteInput}>
        <Stack gap="xs">
          <Textarea
            placeholder="Paste notes or text content here..."
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            minRows={3}
            maxRows={6}
            autosize
          />
          <Group gap="xs" justify="flex-end">
            <Button
              size="xs"
              variant="subtle"
              onClick={() => {
                setShowPasteInput(false);
                setPasteText("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              onClick={handlePastedTextSave}
              disabled={!pasteText.trim() || isProcessing}
              loading={isProcessing}
            >
              Add
            </Button>
          </Group>
        </Stack>
      </Collapse>

      {/* Loading state */}
      {isLoading && (
        <Center py="md">
          <Loader size="sm" />
        </Center>
      )}

      {/* Parsing documents */}
      {parsingDocs.length > 0 && (
        <Stack gap="xs">
          {parsingDocs.map((doc) => (
            <Card key={doc.id} padding="xs" radius="sm" withBorder>
              <Group gap="xs">
                <Loader size="xs" />
                <Text size="sm">{doc.filename}</Text>
                <Text size="xs" c="dimmed">
                  Parsing...
                </Text>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {/* Error documents */}
      {errorDocs.length > 0 && (
        <Stack gap="xs">
          {errorDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onRemove={() => removeDocument(doc.id)}
              isError
            />
          ))}
        </Stack>
      )}

      {/* Ready documents */}
      {readyDocs.length === 0 && !isLoading && parsingDocs.length === 0 ? (
        <Center py="md">
          <Stack align="center" gap="xs">
            <FileText
              size={32}
              strokeWidth={1.5}
              color="var(--mantine-color-dimmed)"
            />
            <Text size="sm" c="dimmed" ta="center">
              No documents attached.
              <br />
              Upload files or paste text to include in analyses.
            </Text>
          </Stack>
        </Center>
      ) : (
        <ScrollArea.Autosize mah={maxHeight} offsetScrollbars>
          <Stack gap="xs">
            {readyDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onRemove={() => removeDocument(doc.id)}
                isProcessing={isProcessing}
              />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}

      {/* Token usage info */}
      {totalTokens > 0 && (
        <Text size="xs" c="dimmed">
          These documents will be included when you analyze or score this
          incident.
        </Text>
      )}
    </Stack>
  );

  if (collapsible) {
    return (
      <Card padding="sm" radius="sm" withBorder>
        <Stack gap="sm">
          {header}
          <Collapse in={!isCollapsed}>{content}</Collapse>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack gap="sm">
      {header}
      {content}
    </Stack>
  );
}

/**
 * Props for document card.
 */
interface DocumentCardProps {
  document: PersistedSupplementalDocument;
  onRemove: () => void;
  isError?: boolean;
  isProcessing?: boolean;
}

/**
 * Card displaying a single document.
 */
function DocumentCard({
  document,
  onRemove,
  isError = false,
  isProcessing = false,
}: DocumentCardProps) {
  const typeLabel = getDocumentTypeLabel(document.type);
  const dateAdded = document.addedAt.toLocaleDateString();

  return (
    <Card
      padding="xs"
      radius="sm"
      withBorder
      style={{
        borderColor: isError
          ? "var(--mantine-color-red-5)"
          : document.warnings?.length
            ? "var(--mantine-color-yellow-5)"
            : undefined,
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" style={{ minWidth: 0 }}>
          <File
            size={16}
            color={isError ? "var(--mantine-color-red-6)" : undefined}
          />
          <Box style={{ minWidth: 0 }}>
            <Text size="sm" truncate>
              {document.filename}
            </Text>
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {typeLabel}
              </Text>
              {!isError && (
                <Badge size="xs" variant="light">
                  {formatTokenCount(document.tokenCount)} tokens
                </Badge>
              )}
              <Text size="xs" c="dimmed">
                {dateAdded}
              </Text>
            </Group>
            {isError && document.error && (
              <Text size="xs" c="red">
                {document.error}
              </Text>
            )}
            {document.warnings?.map((warning, i) => (
              <Text key={i} size="xs" c="yellow">
                {warning}
              </Text>
            ))}
          </Box>
        </Group>

        <Tooltip label="Remove">
          <ActionIcon
            size="sm"
            variant="subtle"
            color="red"
            onClick={onRemove}
            disabled={isProcessing}
          >
            <Trash2 size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Card>
  );
}

/**
 * Compact document list for sidebars.
 */
export function CompactDocumentList({
  transcriptId,
  maxHeight = 200,
}: Pick<SupplementalDocsManagerProps, "transcriptId" | "maxHeight">) {
  const { documents, isLoading } = useSupplementalDocsPersistent(transcriptId);

  const readyDocs = documents.filter((doc) => doc.status === "ready");

  if (isLoading) {
    return (
      <Center py="sm">
        <Loader size="xs" />
      </Center>
    );
  }

  if (readyDocs.length === 0) {
    return (
      <Text size="xs" c="dimmed" ta="center" py="sm">
        No documents
      </Text>
    );
  }

  return (
    <ScrollArea.Autosize mah={maxHeight} offsetScrollbars>
      <Stack gap="xs">
        {readyDocs.map((doc) => (
          <Group key={doc.id} gap="xs" wrap="nowrap">
            <File size={14} />
            <Text size="xs" truncate style={{ flex: 1 }}>
              {doc.filename}
            </Text>
            <Badge size="xs" variant="light">
              {formatTokenCount(doc.tokenCount)}
            </Badge>
          </Group>
        ))}
      </Stack>
    </ScrollArea.Autosize>
  );
}
