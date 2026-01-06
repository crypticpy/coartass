/**
 * Import Modal Component
 *
 * Modal for importing Austin RTASS shareable packages.
 * Handles file selection, validation, conflict resolution, and displays results.
 */

"use client";

import * as React from "react";
import {
  Modal,
  Stack,
  Group,
  Button,
  Text,
  Card,
  Box,
  Loader,
  Alert,
  TextInput,
  Badge,
  rem,
} from "@mantine/core";
import {
  Upload,
  FileJson,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  X,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { notifications } from "@mantine/notifications";
import {
  parsePackageFile,
  checkForConflict,
  importPackageToDatabase,
  type ConflictInfo,
  type ImportResult,
} from "@/lib/package/import";
import type { MeetingTranscriberPackage } from "@/lib/package/validation";
import { MAX_PACKAGE_SIZE } from "@/lib/package/validation";

// ============================================================================
// Types
// ============================================================================

/**
 * Props for ImportModal component
 */
export interface ImportModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when import succeeds */
  onImportSuccess?: (transcriptId: string, analysisId?: string) => void;
}

/**
 * Modal states
 */
type ModalState =
  | "idle"
  | "validating"
  | "conflict"
  | "importing"
  | "success"
  | "error";

// ============================================================================
// Constants
// ============================================================================

const MAX_SIZE_MB = MAX_PACKAGE_SIZE / (1024 * 1024);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format file size to human-readable string
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Import Modal Component
 *
 * A modal for importing Austin RTASS packages with:
 * - Drag-and-drop file selection
 * - Validation and conflict detection
 * - User-friendly conflict resolution
 * - Success/error feedback
 *
 * @example
 * ```tsx
 * const [opened, setOpened] = useState(false);
 *
 * <ImportModal
 *   opened={opened}
 *   onClose={() => setOpened(false)}
 *   onImportSuccess={(transcriptId) => {
 *     router.push(`/transcripts/${transcriptId}`);
 *   }}
 * />
 * ```
 */
export function ImportModal({
  opened,
  onClose,
  onImportSuccess,
}: ImportModalProps) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // State
  const [state, setState] = React.useState<ModalState>("idle");
  const [isDragging, setIsDragging] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [parsedPackage, setParsedPackage] =
    React.useState<MeetingTranscriberPackage | null>(null);
  const [conflict, setConflict] = React.useState<ConflictInfo | null>(null);
  const [customFilename, setCustomFilename] = React.useState("");
  const [importResult, setImportResult] = React.useState<ImportResult | null>(
    null
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Drag counter for proper drag state tracking
  const dragCounter = React.useRef(0);

  /**
   * Reset all state to initial values
   */
  const resetState = React.useCallback(() => {
    setState("idle");
    setIsDragging(false);
    setSelectedFile(null);
    setParsedPackage(null);
    setConflict(null);
    setCustomFilename("");
    setImportResult(null);
    setErrorMessage(null);
    dragCounter.current = 0;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  /**
   * Handle modal close
   */
  const handleClose = React.useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  /**
   * Perform the actual import
   */
  const performImport = React.useCallback(
    async (
      pkg: MeetingTranscriberPackage,
      filename?: string
    ): Promise<void> => {
      setState("importing");

      try {
        const result = await importPackageToDatabase(pkg, {
          conflictAction: "rename",
          customFilename: filename,
        });

        if (result.success) {
          setImportResult(result);
          setState("success");

          // Show warnings if any
          if (result.warnings && result.warnings.length > 0) {
            result.warnings.forEach((warning) => {
              notifications.show({
                title: "Import Warning",
                message: warning,
                color: "yellow",
              });
            });
          }
        } else {
          setState("error");
          setErrorMessage(result.error || "Failed to import package");
        }
      } catch (error) {
        setState("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during import"
        );
      }
    },
    []
  );

  /**
   * Process selected file
   */
  const processFile = React.useCallback(async (file: File) => {
    setSelectedFile(file);
    setState("validating");
    setErrorMessage(null);

    try {
      // Parse and validate the package
      const parseResult = await parsePackageFile(file);

      if (!parseResult.success || !parseResult.data) {
        setState("error");
        setErrorMessage(parseResult.error || "Failed to parse package file");
        return;
      }

      const pkg = parseResult.data;
      setParsedPackage(pkg);

      // Check for conflicts
      const conflictInfo = await checkForConflict(pkg);

      if (conflictInfo) {
        setConflict(conflictInfo);
        setCustomFilename(conflictInfo.suggestedNewName);
        setState("conflict");
      } else {
        // No conflict, proceed to import
        await performImport(pkg);
      }
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while processing the file"
      );
    }
  }, [performImport]);

  /**
   * Handle conflict resolution - import with new name
   */
  const handleImportWithNewName = React.useCallback(async () => {
    if (!parsedPackage) return;

    const filenameToUse = customFilename.trim() || conflict?.suggestedNewName;
    await performImport(parsedPackage, filenameToUse);
  }, [parsedPackage, customFilename, conflict, performImport]);

  /**
   * Handle viewing the imported transcript
   */
  const handleViewTranscript = React.useCallback(() => {
    if (importResult?.transcriptId) {
      onImportSuccess?.(importResult.transcriptId, importResult.analysisId);
      handleClose();
      router.push(`/transcripts/${importResult.transcriptId}`);
    }
  }, [importResult, onImportSuccess, handleClose, router]);

  // ============================================================================
  // Drag and Drop Handlers
  // ============================================================================

  const handleDragEnter = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (state !== "idle") return;
      dragCounter.current++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [state]
  );

  const handleDragLeave = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (state !== "idle") return;
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    },
    [state]
  );

  const handleDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (state !== "idle") return;

      setIsDragging(false);
      dragCounter.current = 0;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type === "application/json" || file.name.endsWith(".json")) {
          processFile(file);
        } else {
          setState("error");
          setErrorMessage("Please select a JSON file (.json)");
        }
      }
    },
    [state, processFile]
  );

  /**
   * Handle file input change
   */
  const handleFileInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  /**
   * Handle browse button click
   */
  const handleBrowseClick = React.useCallback(() => {
    if (state === "idle" && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [state]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * Render idle state - file picker
   */
  const renderIdleState = () => (
    <Card
      p="xl"
      radius="lg"
      withBorder
      style={{
        cursor: "pointer",
        borderStyle: isDragging ? "solid" : "dashed",
        borderColor: isDragging
          ? "var(--mantine-color-aphBlue-6)"
          : "var(--mantine-color-gray-4)",
        backgroundColor: isDragging
          ? "var(--mantine-color-aphBlue-0)"
          : undefined,
        transition: "all 0.2s ease",
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleBrowseClick}
      role="button"
      tabIndex={0}
      aria-label="Upload package file"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleBrowseClick();
        }
      }}
    >
      <Stack align="center" gap="md">
        <Box
          style={{
            width: rem(64),
            height: rem(64),
            borderRadius: "50%",
            backgroundColor: isDragging
              ? "var(--mantine-color-aphBlue-1)"
              : "var(--mantine-color-gray-1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
          }}
        >
          {isDragging ? (
            <FileJson
              style={{
                width: rem(28),
                height: rem(28),
                color: "var(--mantine-color-aphBlue-6)",
              }}
            />
          ) : (
            <Upload
              style={{
                width: rem(28),
                height: rem(28),
                color: "var(--mantine-color-gray-6)",
              }}
            />
          )}
        </Box>

        <Text
          size="lg"
          fw={600}
          c={isDragging ? "aphBlue" : undefined}
          ta="center"
        >
          {isDragging ? "Drop your file here" : "Import Package"}
        </Text>

        <Text size="sm" c="dimmed" ta="center" maw={rem(300)}>
          Drag and drop a .json package file, or click to browse
        </Text>

        <Group gap="xs" justify="center">
          <Badge variant="outline" color="aphBlue" size="sm">
            JSON
          </Badge>
          <Text size="xs" c="dimmed">
            Max {MAX_SIZE_MB}MB
          </Text>
        </Group>

        <Button variant="outline" color="aphBlue" size="md" mt="sm">
          Choose File
        </Button>
      </Stack>

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        accept=".json,application/json"
        onChange={handleFileInputChange}
        aria-label="File input"
      />
    </Card>
  );

  /**
   * Render validating state
   */
  const renderValidatingState = () => (
    <Stack align="center" gap="md" py="xl">
      <Loader size="lg" color="aphBlue" />
      <Text size="lg" fw={500}>
        Validating package...
      </Text>
      {selectedFile && (
        <Text size="sm" c="dimmed">
          {selectedFile.name} ({formatFileSize(selectedFile.size)})
        </Text>
      )}
    </Stack>
  );

  /**
   * Render conflict state
   */
  const renderConflictState = () => (
    <Stack gap="md">
      <Alert
        color="yellow"
        variant="light"
        icon={<AlertTriangle style={{ width: rem(20), height: rem(20) }} />}
      >
        <Text fw={500}>A transcript with this name already exists</Text>
      </Alert>

      <Card withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Existing:
            </Text>
            <Text size="sm" fw={500}>
              {conflict?.existingFilename}
            </Text>
          </Group>
          <Group gap="xs" align="center">
            <Text size="sm" c="dimmed">
              Suggested:
            </Text>
            <ArrowRight
              style={{
                width: rem(14),
                height: rem(14),
                color: "var(--mantine-color-gray-5)",
              }}
            />
          </Group>
        </Stack>
      </Card>

      <TextInput
        label="Import as"
        description="Enter a new name for the imported transcript"
        value={customFilename}
        onChange={(e) => setCustomFilename(e.currentTarget.value)}
        placeholder={conflict?.suggestedNewName}
        required
      />

      <Group justify="flex-end" gap="sm" mt="sm">
        <Button variant="subtle" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleImportWithNewName}
          disabled={!customFilename.trim()}
        >
          Import with New Name
        </Button>
      </Group>
    </Stack>
  );

  /**
   * Render importing state
   */
  const renderImportingState = () => (
    <Stack align="center" gap="md" py="xl">
      <Loader size="lg" color="aphBlue" />
      <Text size="lg" fw={500}>
        Importing...
      </Text>
      <Text size="sm" c="dimmed">
        Saving transcript to your library
      </Text>
    </Stack>
  );

  /**
   * Render success state
   */
  const renderSuccessState = () => (
    <Stack align="center" gap="md" py="md">
      <Box
        style={{
          width: rem(64),
          height: rem(64),
          borderRadius: "50%",
          backgroundColor: "var(--mantine-color-green-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CheckCircle2
          style={{
            width: rem(32),
            height: rem(32),
            color: "var(--mantine-color-green-6)",
          }}
        />
      </Box>

      <Text size="lg" fw={600}>
        Successfully imported!
      </Text>

      <Card withBorder p="md" radius="md" w="100%">
        <Stack gap="xs">
          <Group gap="xs">
            <FileJson
              style={{
                width: rem(16),
                height: rem(16),
                color: "var(--mantine-color-gray-6)",
              }}
            />
            <Text size="sm" fw={500}>
              {parsedPackage?.transcript.filename}
            </Text>
          </Group>
          {importResult?.wasRenamed && (
            <Text size="xs" c="dimmed">
              (Renamed to avoid conflict)
            </Text>
          )}
          {importResult?.analysisId && (
            <Badge size="sm" variant="light" color="aphCyan">
              Analysis included
            </Badge>
          )}
        </Stack>
      </Card>

      <Group justify="center" gap="sm" mt="sm" w="100%">
        <Button variant="subtle" onClick={handleClose}>
          Close
        </Button>
        <Button onClick={handleViewTranscript}>View Transcript</Button>
      </Group>
    </Stack>
  );

  /**
   * Render error state
   */
  const renderErrorState = () => (
    <Stack align="center" gap="md" py="md">
      <Box
        style={{
          width: rem(64),
          height: rem(64),
          borderRadius: "50%",
          backgroundColor: "var(--mantine-color-red-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AlertCircle
          style={{
            width: rem(32),
            height: rem(32),
            color: "var(--mantine-color-red-6)",
          }}
        />
      </Box>

      <Text size="lg" fw={600}>
        Import Failed
      </Text>

      <Alert color="red" variant="light" w="100%">
        {errorMessage || "An unexpected error occurred"}
      </Alert>

      <Group justify="center" gap="sm" mt="sm">
        <Button
          variant="subtle"
          onClick={handleClose}
          leftSection={<X style={{ width: rem(16), height: rem(16) }} />}
        >
          Close
        </Button>
        <Button
          onClick={resetState}
          leftSection={
            <RefreshCw style={{ width: rem(16), height: rem(16) }} />
          }
        >
          Try Again
        </Button>
      </Group>
    </Stack>
  );

  /**
   * Render content based on state
   */
  const renderContent = () => {
    switch (state) {
      case "idle":
        return renderIdleState();
      case "validating":
        return renderValidatingState();
      case "conflict":
        return renderConflictState();
      case "importing":
        return renderImportingState();
      case "success":
        return renderSuccessState();
      case "error":
        return renderErrorState();
      default:
        return renderIdleState();
    }
  };

  // Reset state when modal opens
  React.useEffect(() => {
    if (opened) {
      resetState();
    }
  }, [opened, resetState]);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Text size="lg" fw={600}>
          Import Package
        </Text>
      }
      size="md"
      centered
      closeOnClickOutside={state === "idle" || state === "error"}
      closeOnEscape={state === "idle" || state === "error"}
    >
      {renderContent()}
    </Modal>
  );
}

export default ImportModal;
