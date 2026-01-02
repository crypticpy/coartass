"use client";

import { memo } from "react";
import Link from "next/link";
import { FileAudio, Clock, ArrowRight, Upload, Settings } from "lucide-react";
import { Button, Card, Badge, Text, Title, Group, Stack, Grid, Skeleton, Box } from "@mantine/core";
import { formatDistanceToNow } from "date-fns";
import type { Transcript } from "@/types/transcript";

interface RecentTranscriptsProps {
  transcripts: Transcript[];
  isLoading: boolean;
  isLoadingConfig: boolean;
  isConfigured: boolean;
  onConfigureClick: () => void;
}

interface TranscriptCardProps {
  transcript: Transcript;
}

const TranscriptCard = memo(function TranscriptCard({ transcript }: TranscriptCardProps) {
  return (
    <Link
      href={`/transcripts/${transcript.id}`}
      style={{ textDecoration: 'none', color: 'inherit', height: '100%', display: 'block' }}
    >
      <Card
        padding="lg"
        shadow="sm"
        withBorder
        style={{
          height: '100%',
          cursor: 'pointer',
          borderLeft: '4px solid transparent',
          transition: 'all 0.3s ease',
        }}
        styles={{
          root: {
            '&:hover': {
              borderLeftColor: 'var(--mantine-color-primary-5)',
              boxShadow: 'var(--mantine-shadow-md)',
              transform: 'translateY(-4px)',
            },
          },
        }}
      >
        <Stack gap="md" style={{ height: '100%' }}>
          <Group justify="space-between" align="flex-start">
            <Title
              order={3}
              size="h5"
              lineClamp={2}
              style={{ flex: 1, transition: 'color 0.2s' }}
              styles={{
                root: {
                  '&:hover': { color: 'var(--mantine-color-primary-5)' },
                },
              }}
            >
              {transcript.filename}
            </Title>
            <FileAudio size={20} style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0 }} />
          </Group>

          <Group gap="xs">
            <Clock size={12} />
            <Text size="xs" c="dimmed">
              {formatDistanceToNow(new Date(transcript.createdAt), { addSuffix: true })}
            </Text>
          </Group>

          <Text size="sm" c="dimmed" lineClamp={3} style={{ flex: 1 }}>
            {transcript.text}
          </Text>

          {transcript.metadata?.duration && (
            <Box>
              <Badge color="aphBlue" variant="light" size="sm">
                {Math.floor(transcript.metadata.duration / 60)}:
                {String(Math.floor(transcript.metadata.duration % 60)).padStart(2, "0")}
              </Badge>
            </Box>
          )}
        </Stack>
      </Card>
    </Link>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the transcript id or critical fields change
  return prevProps.transcript.id === nextProps.transcript.id &&
         prevProps.transcript.filename === nextProps.transcript.filename &&
         prevProps.transcript.text === nextProps.transcript.text &&
         prevProps.transcript.createdAt === nextProps.transcript.createdAt &&
         prevProps.transcript.metadata?.duration === nextProps.transcript.metadata?.duration;
});

export const RecentTranscripts = memo(function RecentTranscripts({
  transcripts,
  isLoading,
  isLoadingConfig,
  isConfigured,
  onConfigureClick,
}: RecentTranscriptsProps) {
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={4}>
          <Title order={2} size="h2">
            Recent Incidents
          </Title>
          <Text size="sm" c="dimmed">
            Your latest radio traffic transcriptions
          </Text>
        </Stack>
        {transcripts.length > 0 && (
          <Link href="/transcripts" style={{ textDecoration: 'none' }}>
            <Button
              variant="outline"
              rightSection={<ArrowRight size={16} />}
              styles={{
                root: {
                  minHeight: 44,
                  borderColor: 'var(--mantine-color-primary-2)',
                  '&:hover': {
                    borderColor: 'var(--mantine-color-primary-5)',
                    background: 'var(--mantine-color-primary-0)',
                  },
                },
              }}
            >
              View All
            </Button>
          </Link>
        )}
      </Group>

      {isLoading ? (
        <Grid>
          {[...Array(3)].map((_, i) => (
            <Grid.Col key={i} span={{ base: 12, sm: 6, lg: 4 }}>
              <Card padding="lg" withBorder>
                <Stack gap="md">
                  <Skeleton height={20} width="40%" />
                  <Skeleton height={16} width="70%" />
                  <Skeleton height={60} />
                </Stack>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      ) : transcripts.length > 0 ? (
        <div className="stagger-animate">
          <Grid>
            {transcripts.map((transcript, index) => (
              <Grid.Col key={transcript.id} span={{ base: 12, sm: 6, lg: 4 }}>
                <div className="stagger-item" style={{ animationDelay: `${index * 0.1}s`, height: '100%' }}>
                  <TranscriptCard transcript={transcript} />
                </div>
              </Grid.Col>
            ))}
          </Grid>
        </div>
      ) : (
        <div className="page-transition">
          <Card padding="xl" withBorder style={{ borderStyle: 'dashed' }}>
            <Stack align="center" gap="md" py="xl">
              <FileAudio size={48} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Title order={3} ta="center">
                No incidents yet
              </Title>
              <Text size="sm" ta="center" c="dimmed" maw={500}>
                Upload your first radio traffic audio to get started with transcription and training review.
              </Text>
              {isLoadingConfig ? (
                <Button disabled styles={{ root: { minHeight: 44 } }}>
                  <Upload size={16} style={{ marginRight: 8 }} />
                  Loading...
                </Button>
              ) : isConfigured ? (
                <Link href="/upload" style={{ textDecoration: 'none' }}>
                  <Button leftSection={<Upload size={16} />} styles={{ root: { minHeight: 44 } }}>
                    Upload Your First Audio
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  onClick={onConfigureClick}
                  leftSection={<Settings size={16} />}
                  styles={{ root: { minHeight: 44 } }}>
                  Configure API First
                </Button>
              )}
            </Stack>
          </Card>
        </div>
      )}
    </Stack>
  );
});
