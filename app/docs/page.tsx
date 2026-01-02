'use client';

import {
  Upload,
  Mic,
  FileText,
  Sparkles,
  Layout,
  Shield,
  Lightbulb,
  Info,
} from "lucide-react";
import { Stack, Title, Text, SimpleGrid, Divider, Group, Badge, Alert, Loader } from "@mantine/core";
import { DocsCard } from "@/components/docs/docs-card";
import { useTour } from "@/components/docs/tour";
import { DEMO_DATA_INFO } from "@/lib/demo-data";

export default function DocsPage() {
  const { startTour, isLoadingDemoData } = useTour();

  return (
    <Stack gap="xl">
      <div>
        <Title order={1} mb="xs">Documentation & Help</Title>
        <Text c="dimmed" size="lg">
          Learn how to use Austin RTASS effectively
        </Text>
      </div>

      <Divider label="Interactive Guides" labelPosition="left" />

      {/* Info about demo data */}
      <Alert
        icon={isLoadingDemoData ? <Loader size={16} /> : <Info size={16} />}
        color="blue"
        variant="light"
      >
        <Group gap="xs" wrap="wrap">
          <Text size="sm">
            {isLoadingDemoData
              ? 'Loading demo content for the tour...'
              : 'Starting a guide will automatically load sample content to demonstrate features.'}
          </Text>
          <Badge variant="light" color="blue" size="sm">
            {DEMO_DATA_INFO.transcriptCount} Sample Transcripts
          </Badge>
          <Badge variant="light" color="green" size="sm">
            {DEMO_DATA_INFO.analysisCount} Sample Analyses
          </Badge>
        </Group>
      </Alert>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        <DocsCard
          title="How to Upload & Transcribe"
          description="Step-by-step guide to transcribing radio audio files"
          icon={<Upload size={24} />}
          onStartTour={() => startTour('upload')}
        />
        <DocsCard
          title="How to Record Audio"
          description="Learn to record audio directly in the app"
          icon={<Mic size={24} />}
          onStartTour={() => startTour('record')}
        />
        <DocsCard
          title="View & Search Incidents"
          description="Navigate and search your transcriptions"
          icon={<FileText size={24} />}
          onStartTour={() => startTour('transcripts')}
        />
        <DocsCard
          title="Run AI Review"
          description="Generate a structured review from radio traffic transcripts"
          icon={<Sparkles size={24} />}
          onStartTour={() => startTour('analysis')}
        />
        <DocsCard
          title="Manage Templates"
          description="Create and customize review templates"
          icon={<Layout size={24} />}
          onStartTour={() => startTour('templates')}
        />
      </SimpleGrid>

      <Divider label="Reference Documentation" labelPosition="left" />

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <DocsCard
          title="Architecture & Security"
          description="Technical overview of the application"
          icon={<Shield size={24} />}
          href="/docs/architecture"
        />
        <DocsCard
          title="Best Practices"
          description="Tips for better transcriptions"
          icon={<Lightbulb size={24} />}
          href="/docs/best-practices"
        />
      </SimpleGrid>
    </Stack>
  );
}
