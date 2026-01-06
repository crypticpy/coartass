/**
 * Upload Page
 *
 * Single-purpose page for uploading audio files for transcription:
 * - File upload with drag-and-drop
 * - File validation and metadata extraction
 * - Optional language and model selection
 * - Upload progress tracking
 * - Automatic save to IndexedDB
 * - Redirect to transcript detail on completion
 *
 * Note: For recording audio, use the dedicated /record page.
 */

"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Upload, Settings2, FileAudio, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Button,
  Select,
  Divider,
  Alert,
  Group,
  Box,
  Switch,
  Skeleton,
  Loader,
  Overlay,
  Center,
} from "@mantine/core";
import { useFileUpload } from "@/hooks/use-file-upload";
import { notifications } from "@mantine/notifications";
import {
  saveTranscript,
  findTranscriptByFingerprint,
  countTranscriptVersions,
  getRecording,
  updateRecordingStatus,
} from "@/lib/db";
import { loadAndStoreAudioFile } from "@/lib/audio-storage";
import { computeTranscriptFingerprint } from "@/lib/transcript-fingerprint";
import type { Transcript } from "@/types/transcript";

// Code-split heavy upload components for better performance
const FileUploadZone = dynamic(
  () => import("@/components/upload/file-upload-zone").then((m) => ({
    default: m.FileUploadZone,
  })),
  {
    loading: () => (
      <Card withBorder shadow="sm" radius="md" p="xl">
        <Stack align="center" gap="md">
          <Skeleton height={80} width={80} circle />
          <Skeleton height={24} width="60%" />
          <Skeleton height={16} width="80%" />
          <Group gap="xs">
            <Skeleton height={24} width={60} />
            <Skeleton height={24} width={60} />
            <Skeleton height={24} width={60} />
            <Skeleton height={24} width={60} />
          </Group>
        </Stack>
      </Card>
    ),
    ssr: false,
  }
);

const DepartmentSelector = dynamic(
  () => import("@/components/upload/department-selector").then((m) => ({
    default: m.DepartmentSelector,
  })),
  {
    loading: () => <Skeleton height={56} />,
  }
);

const UploadProgress = dynamic(
  () => import("@/components/upload/upload-progress").then((m) => ({
    default: m.UploadProgress,
  })),
  {
    loading: () => (
      <Stack gap="md">
        <Skeleton height={8} />
        <Skeleton height={16} width="40%" />
      </Stack>
    ),
  }
);

/**
 * Supported languages for transcription
 */
const SUPPORTED_LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "nl", label: "Dutch" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
  { value: "ko", label: "Korean" },
  { value: "ru", label: "Russian" },
] as const;

/**
 * Transcription model options
 */
const TRANSCRIPTION_MODELS = [
  {
    value: "gpt-4o-transcribe",
    label: "GPT-4o Transcribe",
    description: "High-quality transcription with timestamps",
  },
  {
    value: "gpt-4o-transcribe-diarize",
    label: "GPT-4o Transcribe with Diarization (Beta)",
    description: "Transcription with speaker labels (experimental)",
  },
] as const;

/**
 * Upload Page Component
 *
 * Manages the complete file upload and transcription workflow.
 * Provides file selection, validation, upload, and progress tracking.
 */
export default function UploadPage() {
  const router = useRouter();

  // File upload state
  const {
    file,
    fileData,
    audioMetadata,
    progress,
    error,
    isProcessing,
    selectFile,
    clearFile,
    uploadFile,
    cancelUpload,
  } = useFileUpload();

  // Upload settings
  const [language, setLanguage] = React.useState<string>("auto");
  const [model, setModel] = React.useState<string>("gpt-4o-transcribe-diarize");
  const [department, setDepartment] = React.useState<string>("");
  const [isUploading, setIsUploading] = React.useState(false);

  const enableSpeakerDetection = model === "gpt-4o-transcribe-diarize";

  // Source recording ID (when coming from recordings page)
  const [sourceRecordingId, setSourceRecordingId] = React.useState<number | null>(null);

  // Loading state for recording retrieval (when coming from recordings page)
  const [isLoadingRecording, setIsLoadingRecording] = React.useState(false);
  const [loadingRecordingStatus, setLoadingRecordingStatus] = React.useState<string>("");

  /**
   * Check if coming from recordings page with a recording to transcribe
   */
  React.useEffect(() => {
    const checkForRecording = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("from") === "recordings") {
        const recordingId = sessionStorage.getItem("transcribe-recording-id");
        if (recordingId) {
          sessionStorage.removeItem("transcribe-recording-id");

          // Show loading state immediately
          setIsLoadingRecording(true);
          setLoadingRecordingStatus("Loading recording...");

          try {
            // Load recording from IndexedDB
            setLoadingRecordingStatus("Retrieving recording from storage...");
            const recording = await getRecording(Number(recordingId));
            if (recording) {
              // Normalize MIME type - strip codec suffix (e.g., "audio/webm;codecs=opus" -> "audio/webm")
              const normalizedMimeType = recording.metadata.mimeType.split(";")[0];

              // Determine file extension from MIME type
              const extMap: Record<string, string> = {
                "audio/webm": ".webm",
                "audio/mp4": ".m4a",
                "audio/mpeg": ".mp3",
                "audio/wav": ".wav",
                "audio/ogg": ".ogg",
                "audio/flac": ".flac",
              };
              const ext = extMap[normalizedMimeType] || ".webm";

              // Create filename with proper extension
              const filename = recording.name
                ? (recording.name.includes(".") ? recording.name : `${recording.name}${ext}`)
                : `recording-${recordingId}${ext}`;

              // Convert blob to File with normalized MIME type
              const recordingFile = new File(
                [recording.blob],
                filename,
                { type: normalizedMimeType }
              );

              // Update status to show we're now processing the file
              // This is especially important for WebM files that need conversion
              const isWebM = normalizedMimeType === "audio/webm" || ext === ".webm";
              if (isWebM) {
                setLoadingRecordingStatus("Processing audio file for transcription...");
              } else {
                setLoadingRecordingStatus("Validating audio file...");
              }

              // Pre-fill the upload form with known duration from recording metadata
              await selectFile(recordingFile, recording.metadata.duration);

              // Store recording ID for later status update
              setSourceRecordingId(Number(recordingId));

              notifications.show({
                title: "Recording loaded",
                message: "Your recording is ready to transcribe.",
                color: "green",
              });
            } else {
              throw new Error("Recording not found in storage");
            }
          } catch (error) {
            console.error("Failed to load recording:", error);
            notifications.show({
              title: "Error",
              message: error instanceof Error ? error.message : "Failed to load recording. Please try again.",
              color: "red",
            });
          } finally {
            // Clear loading state
            setIsLoadingRecording(false);
            setLoadingRecordingStatus("");
          }
        }
      }
    };
    checkForRecording();
  }, [selectFile]);

  /**
   * Handle file selection
   */
  const handleFileSelect = React.useCallback(
    async (selectedFile: File) => {
      try {
        await selectFile(selectedFile);
        notifications.show({
          title: "File validated",
          message: "Your audio file is ready to upload.",
          color: "green",
        });
      } catch (error) {
        notifications.show({
          title: "File validation failed",
          message:
            error instanceof Error
              ? error.message
              : "Please select a valid audio file.",
          color: "red",
        });
      }
    },
    [selectFile]
  );

  /**
   * Handle upload and transcription
   */
  const handleUpload = React.useCallback(async () => {
    if (!file || !fileData) {
      notifications.show({
        title: "No file selected",
        message: "Please select an audio file to upload.",
        color: "red",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Compute fingerprint for duplicate detection
      const fingerprint = await computeTranscriptFingerprint(file, {
        duration: audioMetadata?.duration,
      });

      // Upload file and start transcription
      const result = await uploadFile({
        language: language !== "auto" ? language : undefined,
        model,
        enableSpeakerDetection,
      });

      if (!result.success || !result.transcript) {
        throw new Error(result.error || "Upload failed");
      }

      // Parse transcript response
      const transcript: Transcript = {
        ...result.transcript,
        // Ensure createdAt is a Date object
        createdAt: new Date(result.transcript.createdAt),
        // Add department if selected
        department: department || undefined,
        fingerprint,
      };

      // Store audio file locally (IndexedDB)
      try {
        // Use the original file for storage
        const audioStorage = await loadAndStoreAudioFile(transcript.id, file);

        // Update transcript with local audio URL
        transcript.audioUrl = audioStorage.audioUrl;
      } catch (audioError) {
        console.error("Failed to store audio file:", audioError);
        // Show warning but continue saving transcript
        notifications.show({
          title: "Audio storage warning",
          message:
            "Transcript saved, but audio file could not be stored locally for playback.",
          color: "yellow",
        });
      }

      // Save to IndexedDB and handle duplicates
      let transcriptIdToNavigate = transcript.id;

      try {
        const existingTranscript = await findTranscriptByFingerprint(
          fingerprint.fileHash
        );

        let transcriptToSave = transcript;

        if (existingTranscript) {
          const versionCount = await countTranscriptVersions(
            fingerprint.fileHash
          );
          const nextVersion = versionCount + 1;

          transcriptToSave = {
            ...transcript,
            filename: `${existingTranscript.filename} (v${nextVersion})`,
          };

          notifications.show({
            title: "Duplicate detected",
            message: `Detected a matching recording. Saved as version ${nextVersion}.`,
            color: "yellow",
          });
        }

        await saveTranscript(transcriptToSave);
        transcriptIdToNavigate = transcriptToSave.id;
      } catch (dbError) {
        console.error("Failed to save transcript to IndexedDB:", dbError);
        // Show warning but don't fail the upload
        notifications.show({
          title: "Warning",
          message:
            "Transcript uploaded but could not be saved locally. You can still view it.",
          color: "yellow",
        });
      }

      // Update source recording status if this came from recordings page
      if (sourceRecordingId) {
        try {
          await updateRecordingStatus(sourceRecordingId, "transcribed", transcriptIdToNavigate);
          setSourceRecordingId(null);
        } catch (recordingError) {
          console.error("Failed to update recording status:", recordingError);
          // Non-critical error, continue with redirect
        }
      }

      // Show success message
      notifications.show({
        title: "Transcription complete!",
        message: `Successfully transcribed "${transcript.filename}".`,
        color: "green",
      });

      // Redirect to transcript detail page
      setTimeout(() => {
        router.push(`/transcripts/${transcriptIdToNavigate}/analyze`);
      }, 1000);
    } catch (error) {
      // Error already logged to console in catch block
      notifications.show({
        title: "Upload failed",
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
        color: "red",
      });
    } finally {
      setIsUploading(false);
    }
  }, [
    file,
    fileData,
    audioMetadata,
    language,
    model,
    department,
    enableSpeakerDetection,
    uploadFile,
    router,
    sourceRecordingId,
  ]);

  /**
   * Handle cancel upload
   * Aborts the ongoing upload request and resets state
   */
  const handleCancel = React.useCallback(() => {
    // Abort the fetch request
    cancelUpload();

    // Reset upload state
    setIsUploading(false);

    // Show cancellation notification
    notifications.show({
      title: "Upload cancelled",
      message: "The upload has been cancelled.",
      color: "blue",
    });
  }, [cancelUpload]);

  // Calculate if upload button should be enabled
  const canUpload =
    file && fileData && audioMetadata && !isProcessing && !isUploading;

  // Check if upload is in progress
  const uploadInProgress =
    isUploading &&
    (progress.status === "uploading" ||
      progress.status === "processing" ||
      progress.status === "transcribing");

  return (
    <Container size="lg" py={{ base: "md", md: "xl" }} pos="relative">
      {/* Loading Overlay for Recording Retrieval */}
      {isLoadingRecording && (
        <Overlay
          color="var(--mantine-color-body)"
          backgroundOpacity={0.85}
          blur={3}
          fixed
          zIndex={200}
        >
          <Center h="100vh">
            <Card shadow="lg" padding="xl" radius="lg" withBorder style={{ minWidth: 320 }}>
              <Stack align="center" gap="lg">
                <Box
                  style={{
                    borderRadius: "50%",
                    background: "var(--aph-light-blue-10)",
                    padding: 20,
                  }}
                >
                  <Loader size="lg" color="aphBlue" type="dots" />
                </Box>
                <Stack align="center" gap="xs">
                  <Title order={3} size="h4" ta="center">
                    Preparing Recording
                  </Title>
                  <Text size="sm" c="dimmed" ta="center">
                    {loadingRecordingStatus || "Processing audio file..."}
                  </Text>
                </Stack>
              </Stack>
            </Card>
          </Center>
        </Overlay>
      )}

      <Stack gap="xl">
        {/* Header */}
        <Box>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: "var(--mantine-font-size-sm)",
              color: "var(--mantine-color-dimmed)",
              marginBottom: "var(--mantine-spacing-md)",
              textDecoration: "none",
            }}
          >
            <ArrowLeft style={{ width: 16, height: 16, marginRight: 8 }} />
            Back to Home
          </Link>
          <Group gap="md" mb="xs" wrap="nowrap">
            <Box
              style={{
                borderRadius: "var(--mantine-radius-lg)",
                background: "var(--aph-light-blue-10)",
                padding: "var(--mantine-spacing-sm)",
              }}
            >
              <FileAudio
                style={{ width: 24, height: 24, color: "var(--aph-blue)" }}
              />
            </Box>
            <Box>
              <Title order={1} size="h2">
                Upload Recording
              </Title>
              <Text c="dimmed" mt={4}>
                Upload an audio file to transcribe with AI
              </Text>
            </Box>
          </Group>
        </Box>

        {/* File Upload Section */}
        <Card withBorder shadow="sm" radius="md">
          <Card.Section withBorder inheritPadding py="md">
            <Title order={3} size="h4">
              Select Audio File
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              Upload an audio recording for transcription. Supported formats:
              MP3, M4A, WAV, WebM, OGG, FLAC, AAC. Files larger than 25MB
              are automatically converted and split before upload.
            </Text>
          </Card.Section>
          <Card.Section inheritPadding py="md">
            <FileUploadZone
              file={file}
              audioMetadata={audioMetadata}
              error={error}
              isProcessing={isProcessing}
              onFileSelect={handleFileSelect}
              onFileRemove={clearFile}
              disabled={isUploading}
            />
          </Card.Section>
        </Card>

        {/* Upload Settings */}
        {file && (
          <Card withBorder shadow="sm" radius="md" data-tour-id="upload-settings">
            <Card.Section withBorder inheritPadding py="md">
              <Group gap="sm">
                <Settings2
                  size={20}
                  style={{ color: "var(--mantine-color-dimmed)" }}
                />
                <Box>
                  <Title order={3} size="h4">
                    Transcription Settings
                  </Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    Configure department, language and model options (optional)
                  </Text>
                </Box>
              </Group>
            </Card.Section>
            <Card.Section inheritPadding py="md">
              <Stack gap="md">
                {/* Department Selection */}
                <DepartmentSelector
                  value={department}
                  onValueChange={setDepartment}
                  disabled={isUploading}
                />

                <Divider />

                {/* Speaker Detection Toggle */}
                <Box>
                  <Switch
                    label="Enable Speaker Detection"
                    description={
                      isUploading
                        ? `Speaker detection is ${
                            enableSpeakerDetection ? "enabled" : "disabled"
                          }`
                        : "Uses the diarization model to label speakers (beta)"
                    }
                    checked={enableSpeakerDetection}
                    onChange={(event) =>
                      setModel(
                        event.currentTarget.checked
                          ? "gpt-4o-transcribe-diarize"
                          : "gpt-4o-transcribe"
                      )
                    }
                    disabled={isUploading}
                    size="md"
                  />
                </Box>

                <Divider />

                {/* Language Selection */}
                <Box>
                  <Select
                    label="Language"
                    description={
                      isUploading
                        ? `Using: ${
                            SUPPORTED_LANGUAGES.find(
                              (lang) => lang.value === language
                            )?.label
                          }`
                        : 'Leave on "Auto-detect" to let AI determine the language'
                    }
                    data={SUPPORTED_LANGUAGES}
                    value={language}
                    onChange={(value) => value && setLanguage(value)}
                    disabled={isUploading}
                    allowDeselect={false}
                  />
                </Box>

                <Divider />

                {/* Model Selection */}
                <Box>
                  <Select
                    label="Transcription Model"
                    description={
                      isUploading
                        ? `Using: ${
                            TRANSCRIPTION_MODELS.find((m) => m.value === model)
                              ?.label
                          }`
                        : "Select transcription model - GPT-4o provides high-quality results with timestamps"
                    }
                    data={TRANSCRIPTION_MODELS}
                    value={model}
                    onChange={(value) => value && setModel(value)}
                    disabled={isUploading}
                    allowDeselect={false}
                  />
                </Box>
              </Stack>
            </Card.Section>
          </Card>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <Card withBorder shadow="sm" radius="md">
            <Card.Section withBorder inheritPadding py="md">
              <Title order={3} size="h4">
                Transcription Progress
              </Title>
              <Text size="sm" c="dimmed" mt={4}>
                Processing your audio file. This may take a few minutes
                depending on the file size.
              </Text>
            </Card.Section>
            <Card.Section inheritPadding py="md">
              <UploadProgress
                progress={progress}
                onCancel={uploadInProgress ? handleCancel : undefined}
                showCancel={uploadInProgress}
              />
            </Card.Section>
          </Card>
        )}

        {/* Action Buttons */}
        {file && !isUploading && (
          <Group gap="md">
            <Button
              size="lg"
              onClick={handleUpload}
              disabled={!canUpload}
              leftSection={<Upload size={20} />}
              fw={600}
              style={{ flex: 1 }}
              visibleFrom="sm"
              data-tour-id="upload-submit"
            >
              Start Transcription
            </Button>
            <Button
              size="lg"
              onClick={handleUpload}
              disabled={!canUpload}
              leftSection={<Upload size={20} />}
              fw={600}
              fullWidth
              hiddenFrom="sm"
            >
              Start Transcription
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={clearFile}
              style={{ flex: 1 }}
              visibleFrom="sm"
            >
              Cancel
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={clearFile}
              fullWidth
              hiddenFrom="sm"
            >
              Cancel
            </Button>
          </Group>
        )}

        {/* Info Alert */}
        {!file && !isUploading && (
          <Alert
            icon={<FileAudio size={16} />}
            color="blue"
            variant="light"
          >
            Select an audio file to get started. The transcription process
            typically takes 1-3 minutes depending on the file length. Need to
            record audio? Use the dedicated{" "}
            <Text component="a" href="/record" c="blue" fw={500} style={{ textDecoration: "underline" }}>
              Record page
            </Text>
            .
          </Alert>
        )}
      </Stack>
    </Container>
  );
}
