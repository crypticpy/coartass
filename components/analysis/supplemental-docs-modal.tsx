/**
 * Supplemental Documents Modal
 *
 * Modal interface for managing supplemental documents attached to a transcript.
 * Provides file upload, paste text, view/delete functionality.
 */

"use client";

import { useCallback, useState } from "react";
import {
  Modal,
  Stack,
  Text,
  Group,
  ActionIcon,
  Badge,
  ScrollArea,
  Button,
  FileButton,
  Textarea,
  Loader,
  Box,
  Paper,
  Divider,
  Collapse,
} from "@mantine/core";
import {
  File,
  Trash2,
  Upload,
  FileText,
  StickyNote,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { useSupplementalDocsPersistent } from "@/hooks/use-supplemental-docs-persistent";
import {
  getDocumentTypeLabel,
  getCategoryLabel,
  SUPPLEMENTAL_LIMITS,
} from "@/types/supplemental";
import type { PersistedSupplementalDocument } from "@/types/supplemental";
import { formatTokenCount } from "@/hooks/use-supplemental-upload";

export interface SupplementalDocsModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** The transcript ID to manage documents for */
  transcriptId: string;
}

/**
 * Modal for managing supplemental documents attached to a transcript.
 */
export function SupplementalDocsModal({
  opened,
  onClose,
  transcriptId,
}: SupplementalDocsModalProps) {
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [viewingDoc, setViewingDoc] =
    useState<PersistedSupplementalDocument | null>(null);

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
    toggleIncludeInAnalysis,
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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <File size={20} />
          <Text fw={600}>Supplemental Document Manager</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* Explainer */}
        <Text size="sm" c="dimmed">
          Upload extra incident documentation like Visinet Reports, training
          feedback, or other relevant materials to be included in the analysis
          context.
        </Text>

        {/* Token summary */}
        {totalTokens > 0 && (
          <Badge variant="light" color="blue" size="lg">
            {formatTokenCount(totalTokens)} tokens total
          </Badge>
        )}

        {/* Error message */}
        {error && (
          <Paper
            p="sm"
            radius="sm"
            withBorder
            style={{ borderColor: "var(--mantine-color-red-5)" }}
          >
            <Group gap="xs" justify="space-between">
              <Group gap="xs">
                <AlertTriangle size={16} color="var(--mantine-color-red-6)" />
                <Text size="sm" c="red">
                  {error}
                </Text>
              </Group>
              <ActionIcon size="xs" variant="subtle" onClick={clearError}>
                <X size={12} />
              </ActionIcon>
            </Group>
          </Paper>
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
                leftSection={<Upload size={16} />}
                disabled={isProcessing}
                {...props}
              >
                Upload File
              </Button>
            )}
          </FileButton>

          <Button
            variant="subtle"
            leftSection={<StickyNote size={16} />}
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
              minRows={4}
              maxRows={8}
              autosize
            />
            <Group gap="xs" justify="flex-end">
              <Button
                size="sm"
                variant="subtle"
                onClick={() => {
                  setShowPasteInput(false);
                  setPasteText("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handlePastedTextSave}
                disabled={!pasteText.trim() || isProcessing}
                loading={isProcessing}
              >
                Add Text
              </Button>
            </Group>
          </Stack>
        </Collapse>

        <Divider />

        {/* Document list */}
        {isLoading ? (
          <Box py="xl" style={{ textAlign: "center" }}>
            <Loader size="sm" />
          </Box>
        ) : readyDocs.length === 0 &&
          parsingDocs.length === 0 &&
          errorDocs.length === 0 ? (
          <Box py="xl" style={{ textAlign: "center" }}>
            <Stack align="center" gap="xs">
              <FileText
                size={40}
                strokeWidth={1.5}
                color="var(--mantine-color-dimmed)"
              />
              <Text size="sm" c="dimmed">
                No documents attached yet.
              </Text>
            </Stack>
          </Box>
        ) : (
          <ScrollArea.Autosize mah={300} offsetScrollbars>
            <Stack gap="xs">
              {/* Parsing documents */}
              {parsingDocs.map((doc) => (
                <Paper key={doc.id} p="sm" radius="sm" withBorder>
                  <Group gap="xs">
                    <Loader size="xs" />
                    <Text size="sm">{doc.filename}</Text>
                    <Text size="xs" c="dimmed">
                      Parsing...
                    </Text>
                  </Group>
                </Paper>
              ))}

              {/* Error documents */}
              {errorDocs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onRemove={() => removeDocument(doc.id)}
                  onView={() => setViewingDoc(doc)}
                  isError
                  isProcessing={isProcessing}
                />
              ))}

              {/* Ready documents */}
              {readyDocs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onRemove={() => removeDocument(doc.id)}
                  onView={() => setViewingDoc(doc)}
                  onToggleInclude={() => toggleIncludeInAnalysis(doc.id)}
                  isProcessing={isProcessing}
                />
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}

        {/* View document panel */}
        {viewingDoc && (
          <>
            <Divider />
            <DocumentViewer
              document={viewingDoc}
              onClose={() => setViewingDoc(null)}
            />
          </>
        )}
      </Stack>
    </Modal>
  );
}

/**
 * Single document row in the list.
 */
interface DocumentRowProps {
  document: PersistedSupplementalDocument;
  onRemove: () => void;
  onView: () => void;
  onToggleInclude?: () => void;
  isError?: boolean;
  isProcessing?: boolean;
}

function DocumentRow({
  document,
  onRemove,
  onView,
  onToggleInclude,
  isError = false,
  isProcessing = false,
}: DocumentRowProps) {
  const typeLabel = getDocumentTypeLabel(document.type);
  const categoryLabel =
    document.category && document.category !== "other"
      ? getCategoryLabel(document.category)
      : null;
  const dateAdded = document.addedAt.toLocaleDateString();
  const isIncluded = document.includeInAnalysis !== false;

  // Category-specific colors
  const categoryColor = (() => {
    switch (document.category) {
      case "visinet":
        return "cyan";
      case "sop":
        return "grape";
      case "policy":
        return "indigo";
      case "training":
        return "teal";
      case "report":
        return "orange";
      default:
        return "gray";
    }
  })();

  return (
    <Paper
      p="sm"
      radius="sm"
      withBorder
      style={{
        borderColor: isError
          ? "var(--mantine-color-red-5)"
          : document.warnings?.length
            ? "var(--mantine-color-yellow-5)"
            : undefined,
        opacity: isIncluded ? 1 : 0.6,
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" style={{ minWidth: 0, flex: 1 }}>
          <File
            size={18}
            color={isError ? "var(--mantine-color-red-6)" : undefined}
          />
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" truncate fw={500}>
                {document.filename}
              </Text>
              {categoryLabel && (
                <Badge size="xs" color={categoryColor} variant="filled">
                  {categoryLabel}
                </Badge>
              )}
            </Group>
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
              {!isIncluded && (
                <Badge size="xs" variant="light" color="gray">
                  Excluded
                </Badge>
              )}
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

        <Group gap="xs">
          {!isError && onToggleInclude && (
            <Button
              size="compact-xs"
              variant={isIncluded ? "light" : "subtle"}
              color={isIncluded ? "blue" : "gray"}
              onClick={onToggleInclude}
              disabled={isProcessing}
            >
              {isIncluded ? "Included" : "Include"}
            </Button>
          )}
          {!isError && (
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={onView}
              disabled={isProcessing}
            >
              <Eye size={16} />
            </ActionIcon>
          )}
          <ActionIcon
            size="sm"
            variant="subtle"
            color="red"
            onClick={onRemove}
            disabled={isProcessing}
          >
            <Trash2 size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
}

/**
 * Document content viewer panel.
 */
interface DocumentViewerProps {
  document: PersistedSupplementalDocument;
  onClose: () => void;
}

function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<"raw" | "formatted">("formatted");

  const isVisinet =
    document.category === "visinet" && document.visinetData != null;

  return (
    <Paper p="sm" radius="sm" withBorder>
      <Stack gap="sm">
        <Group
          justify="space-between"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ cursor: "pointer" }}
        >
          <Group gap="xs">
            {isExpanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
            <Text size="sm" fw={500}>
              {document.filename}
            </Text>
            {document.category && document.category !== "other" && (
              <Badge size="xs" variant="light">
                {getCategoryLabel(document.category)}
              </Badge>
            )}
          </Group>
          <Group gap="xs">
            {isVisinet && (
              <Button.Group>
                <Button
                  size="compact-xs"
                  variant={viewMode === "formatted" ? "filled" : "light"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewMode("formatted");
                  }}
                >
                  Formatted
                </Button>
                <Button
                  size="compact-xs"
                  variant={viewMode === "raw" ? "filled" : "light"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewMode("raw");
                  }}
                >
                  Raw
                </Button>
              </Button.Group>
            )}
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X size={14} />
            </ActionIcon>
          </Group>
        </Group>

        <Collapse in={isExpanded}>
          <ScrollArea.Autosize mah={300} offsetScrollbars>
            {isVisinet && viewMode === "formatted" ? (
              <VisinetSummary document={document} />
            ) : (
              <Text
                size="xs"
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--mantine-font-family-monospace)",
                  backgroundColor: "var(--mantine-color-default)",
                  padding: "var(--mantine-spacing-sm)",
                  borderRadius: "var(--mantine-radius-sm)",
                }}
              >
                {document.text || "(No content)"}
              </Text>
            )}
          </ScrollArea.Autosize>
        </Collapse>
      </Stack>
    </Paper>
  );
}

/**
 * Formatted Visinet report summary display.
 */
function VisinetSummary({
  document,
}: {
  document: PersistedSupplementalDocument;
}) {
  const report = document.visinetData;
  if (!report) return null;

  return (
    <Stack gap="sm" p="xs">
      {/* Incident Header */}
      <Box>
        <Text size="sm" fw={600} mb="xs">
          Incident Information
        </Text>
        <Group gap="lg">
          <Box>
            <Text size="xs" c="dimmed">
              Incident #
            </Text>
            <Text size="sm" fw={500}>
              {report.header.incidentNumber || "N/A"}
            </Text>
          </Box>
          <Box>
            <Text size="xs" c="dimmed">
              Date
            </Text>
            <Text size="sm">
              {report.header.incidentDate?.toLocaleDateString() || "N/A"}
            </Text>
          </Box>
          <Box>
            <Text size="xs" c="dimmed">
              Type
            </Text>
            <Text size="sm">{report.incidentInfo.problem || "N/A"}</Text>
          </Box>
          <Box>
            <Text size="xs" c="dimmed">
              Alarm Level
            </Text>
            <Text size="sm">{report.incidentInfo.alarmLevel || "N/A"}</Text>
          </Box>
        </Group>
      </Box>

      <Divider />

      {/* Location */}
      <Box>
        <Text size="sm" fw={600} mb="xs">
          Location
        </Text>
        <Stack gap={4}>
          {report.location.locationName && (
            <Text size="sm" fw={500}>
              {report.location.locationName}
            </Text>
          )}
          <Text size="sm">{report.location.address}</Text>
          <Text size="sm" c="dimmed">
            {report.location.city}, {report.location.state}{" "}
            {report.location.zip}
          </Text>
        </Stack>
      </Box>

      <Divider />

      {/* Response Times */}
      <Box>
        <Text size="sm" fw={600} mb="xs">
          Response Timeline
        </Text>
        <Group gap="lg">
          {report.timeStamps.phonePickup && (
            <Box>
              <Text size="xs" c="dimmed">
                Call Received
              </Text>
              <Text size="sm">
                {report.timeStamps.phonePickup.toLocaleTimeString()}
              </Text>
            </Box>
          )}
          {report.timeStamps.firstUnitArrived && (
            <Box>
              <Text size="xs" c="dimmed">
                1st Arrival
              </Text>
              <Text size="sm">
                {report.timeStamps.firstUnitArrived.toLocaleTimeString()}
              </Text>
            </Box>
          )}
          {report.elapsedTimes.enrouteToFirstArrived && (
            <Box>
              <Text size="xs" c="dimmed">
                Travel Time
              </Text>
              <Text size="sm">{report.elapsedTimes.enrouteToFirstArrived}</Text>
            </Box>
          )}
        </Group>
      </Box>

      {/* Units */}
      {report.unitsAssigned.length > 0 && (
        <>
          <Divider />
          <Box>
            <Text size="sm" fw={600} mb="xs">
              Units ({report.unitsAssigned.length})
            </Text>
            <Group gap="xs">
              {report.unitsAssigned.map((unit) => (
                <Badge
                  key={unit.unit}
                  size="sm"
                  variant={unit.isPrimary ? "filled" : "light"}
                  color={unit.isPrimary ? "blue" : "gray"}
                >
                  {unit.unit}
                </Badge>
              ))}
            </Group>
          </Box>
        </>
      )}

      {/* Custom Time Stamps */}
      {report.customTimeStamps.length > 0 && (
        <>
          <Divider />
          <Box>
            <Text size="sm" fw={600} mb="xs">
              Milestones
            </Text>
            <Stack gap={4}>
              {report.customTimeStamps.map((stamp, i) => (
                <Group key={i} gap="xs">
                  <Text size="xs" c="dimmed" style={{ minWidth: 60 }}>
                    {stamp.time}
                  </Text>
                  <Text size="sm">{stamp.description}</Text>
                </Group>
              ))}
            </Stack>
          </Box>
        </>
      )}

      {/* Parse warnings */}
      {report.parseWarnings.length > 0 && (
        <>
          <Divider />
          <Box>
            <Text size="xs" c="yellow">
              {report.parseWarnings.join("; ")}
            </Text>
          </Box>
        </>
      )}
    </Stack>
  );
}
