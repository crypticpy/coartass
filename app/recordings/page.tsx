"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Clock,
  Mic,
  Monitor,
  MessageSquare,
  Loader2,
  PlayCircle,
  FileText,
  HardDrive,
  Upload,
} from "lucide-react";
import {
  Container,
  Title,
  Text,
  Card,
  Button,
  ActionIcon,
  Group,
  Stack,
  Skeleton,
  Box,
  Modal,
  Badge,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { formatDistanceToNow } from "date-fns";
import { getAllRecordings, deleteRecording } from "@/lib/db";
import type { SavedRecording, RecordingMode } from "@/types/recording";

/**
 * Format bytes to human-readable size
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Get icon component for recording mode
 */
function getModeIcon(mode: RecordingMode) {
  switch (mode) {
    case "microphone":
      return <Mic size={14} />;
    case "system-audio":
      return <Monitor size={14} />;
    case "commentary":
      return <MessageSquare size={14} />;
  }
}

/**
 * Get display label for recording mode
 */
function getModeLabel(mode: RecordingMode): string {
  switch (mode) {
    case "microphone":
      return "Microphone";
    case "system-audio":
      return "System Audio";
    case "commentary":
      return "Commentary";
  }
}

/**
 * Get color for recording mode
 */
function getModeColor(mode: RecordingMode): string {
  switch (mode) {
    case "microphone":
      return "aphBlue";
    case "system-audio":
      return "aphGreen";
    case "commentary":
      return "aphCyan";
  }
}

/**
 * Recordings listing page with playback, transcription, and delete functionality
 */
export default function RecordingsPage() {
  const router = useRouter();
  const [recordings, setRecordings] = React.useState<SavedRecording[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [playingId, setPlayingId] = React.useState<number | null>(null);
  const [transcribingId, setTranscribingId] = React.useState<number | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Load recordings on mount
  React.useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    setIsLoading(true);
    try {
      const data = await getAllRecordings();
      setRecordings(data);
    } catch (error) {
      console.error("Error loading recordings:", error);
      notifications.show({
        title: "Error",
        message: "Failed to load recordings.",
        color: "red",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;

    setIsDeleting(true);
    try {
      await deleteRecording(deleteId);
      setRecordings((prev) => prev.filter((r) => r.id !== deleteId));
      notifications.show({
        title: "Recording Deleted",
        message: "The recording has been deleted successfully.",
        color: "green",
      });
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting recording:", error);
      notifications.show({
        title: "Error",
        message: "Failed to delete recording. Please try again.",
        color: "red",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePlay = (recording: SavedRecording) => {
    if (!recording.id) return;

    // Stop current playback if any
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingId === recording.id) {
      setPlayingId(null);
      return;
    }

    // Create audio element and play
    const url = URL.createObjectURL(recording.blob);
    const audio = new Audio(url);
    audio.onended = () => {
      setPlayingId(null);
      URL.revokeObjectURL(url);
    };
    audio.play();
    audioRef.current = audio;
    setPlayingId(recording.id);
  };

  const handleTranscribe = (recording: SavedRecording) => {
    if (!recording.id) return;

    // Set loading state for this recording
    setTranscribingId(recording.id);

    // Store recording ID in sessionStorage for upload page to retrieve
    sessionStorage.setItem("transcribe-recording-id", String(recording.id));

    // Navigate to upload page
    router.push("/upload?from=recordings");
  };

  // Cleanup audio on unmount
  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header Section */}
        <Stack gap="xs">
          <Title order={1} size="h1">
            Saved Recordings
          </Title>
          <Text size="sm" c="dimmed">
            Manage your saved audio recordings
          </Text>
        </Stack>

        {/* Count Display */}
        {!isLoading && recordings.length > 0 && (
          <Text size="sm" c="dimmed">
            {recordings.length} recording{recordings.length !== 1 ? "s" : ""} saved
          </Text>
        )}

        {/* Recordings List */}
        {isLoading ? (
          <Box
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            }}
          >
            {[...Array(6)].map((_, i) => (
              <Card key={i} padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Skeleton height={24} width="75%" />
                  <Skeleton height={16} width="50%" />
                  <Skeleton height={16} width="100%" />
                  <Skeleton height={16} width="85%" />
                </Stack>
              </Card>
            ))}
          </Box>
        ) : recordings.length > 0 ? (
          <Box
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            }}
          >
            {recordings.map((recording) => (
              <Card
                key={recording.id}
                padding="lg"
                radius="md"
                withBorder
                style={{
                  position: "relative",
                }}
              >
                <Stack gap="sm">
                  {/* Header with name and actions */}
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Title order={3} size="h4" lineClamp={1}>
                        {recording.name || `Recording ${recording.id}`}
                      </Title>
                      <Badge
                        size="sm"
                        variant="light"
                        color={getModeColor(recording.metadata.mode)}
                        leftSection={getModeIcon(recording.metadata.mode)}
                      >
                        {getModeLabel(recording.metadata.mode)}
                      </Badge>
                    </Stack>
                    <Group gap={4}>
                      <ActionIcon
                        variant="subtle"
                        color={playingId === recording.id ? "red" : "aphBlue"}
                        size="lg"
                        onClick={() => handlePlay(recording)}
                        aria-label={playingId === recording.id ? "Stop" : "Play"}
                        style={{ minWidth: 44, minHeight: 44 }}
                      >
                        <PlayCircle size={20} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="lg"
                        onClick={() => setDeleteId(recording.id ?? null)}
                        aria-label="Delete recording"
                        style={{ minWidth: 44, minHeight: 44 }}
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>

                  {/* Metadata */}
                  <Group gap="md">
                    <Group gap="xs">
                      <Clock size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="sm" c="dimmed">
                        {formatDuration(recording.metadata.duration)}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <HardDrive size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="sm" c="dimmed">
                        {formatSize(recording.metadata.size)}
                      </Text>
                    </Group>
                  </Group>

                  {/* Created at */}
                  <Text size="sm" c="dimmed">
                    {formatDistanceToNow(new Date(recording.metadata.createdAt), {
                      addSuffix: true,
                    })}
                  </Text>

                  {/* Status and Actions */}
                  <Group gap="xs" mt="xs">
                    <Badge
                      size="sm"
                      variant="light"
                      color={recording.status === "transcribed" ? "aphGreen" : "gray"}
                    >
                      {recording.status === "transcribed" ? "Transcribed" : "Saved"}
                    </Badge>
                    {recording.status === "saved" && (
                      <Button
                        variant="light"
                        size="xs"
                        color="aphBlue"
                        leftSection={
                          transcribingId === recording.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Upload size={14} />
                          )
                        }
                        onClick={() => handleTranscribe(recording)}
                        disabled={transcribingId === recording.id}
                        loading={transcribingId === recording.id}
                      >
                        {transcribingId === recording.id ? "Preparing..." : "Transcribe"}
                      </Button>
                    )}
                    {recording.status === "transcribed" && recording.transcriptId && (
                      <Button
                        component={Link}
                        href={`/transcripts/${recording.transcriptId}`}
                        variant="subtle"
                        size="xs"
                        leftSection={<FileText size={14} />}
                      >
                        View Transcript
                      </Button>
                    )}
                  </Group>
                </Stack>
              </Card>
            ))}
          </Box>
        ) : (
          <Card padding="xl" radius="md" withBorder style={{ borderStyle: "dashed" }}>
            <Stack align="center" gap="xl" py="xl">
              <Box
                style={{
                  borderRadius: "50%",
                  backgroundColor: "var(--aph-blue-light)",
                  padding: 24,
                }}
              >
                <Mic size={64} color="var(--aph-blue)" />
              </Box>

              <Title order={2} size="h2" ta="center">
                No recordings yet
              </Title>

              <Text c="dimmed" ta="center" size="md" style={{ maxWidth: 450 }}>
                Your saved recordings will appear here. Start by creating a new recording.
              </Text>

              <Button
                component={Link}
                href="/record"
                size="lg"
                color="aphBlue"
                styles={{ root: { minHeight: 44 } }}
              >
                Create Recording
              </Button>
            </Stack>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <Modal
          opened={deleteId !== null}
          onClose={() => setDeleteId(null)}
          title="Delete Recording"
          centered
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Are you sure you want to delete this recording? This action cannot be
              undone.
            </Text>

            <Group justify="flex-end" gap="sm" mt="md">
              <Button
                variant="outline"
                onClick={() => setDeleteId(null)}
                disabled={isDeleting}
                styles={{ root: { minHeight: 44 } }}
              >
                Cancel
              </Button>
              <Button
                color="red"
                onClick={handleDelete}
                disabled={isDeleting}
                leftSection={
                  isDeleting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : undefined
                }
                styles={{ root: { minHeight: 44 } }}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}
