'use client';

import {
  Stack,
  Title,
  Text,
  Paper,
  List,
  ThemeIcon,
  Group,
  Badge,
} from "@mantine/core";
import {
  Monitor,
  Server,
  Database,
  Shield,
  Cloud,
  ArrowRight,
  Check,
} from "lucide-react";

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
  return (
    <Paper p="lg" withBorder radius="md">
      <Stack gap="md">
        <Group gap="sm">
          <ThemeIcon size="lg" variant="light" color="aphBlue">
            {icon}
          </ThemeIcon>
          <Title order={3} size="h4">
            {title}
          </Title>
        </Group>
        {children}
      </Stack>
    </Paper>
  );
}

export default function ArchitecturePage() {
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Group gap="md">
          <Title order={1}>Architecture & Security</Title>
          <Badge variant="light" color="aphGreen">
            City of Austin Internal
          </Badge>
        </Group>
        <Text c="dimmed" size="lg">
          Understanding how Austin RTASS handles your data
        </Text>
      </Stack>

      <Stack gap="lg">
        {/* System Overview */}
        <Section title="System Overview" icon={<Monitor size={20} />}>
          <List spacing="sm" size="sm">
            <List.Item>
              Client-side web application built with Next.js
            </List.Item>
            <List.Item>
              All user data stored locally in browser (IndexedDB)
            </List.Item>
            <List.Item>No server-side data persistence</List.Item>
            <List.Item>
              Audio processing happens client-side using WebAssembly
            </List.Item>
          </List>
        </Section>

        {/* Client-Side Architecture */}
        <Section title="Client-Side Architecture" icon={<Database size={20} />}>
          <Text size="sm" mb="md">
            The application runs entirely in your browser with the following
            technologies:
          </Text>
          <List
            spacing="sm"
            size="sm"
            icon={
              <ThemeIcon size={20} radius="xl" variant="light" color="aphBlue">
                <Check size={12} />
              </ThemeIcon>
            }
          >
            <List.Item>
              <Text component="span" fw={500}>
                React 18
              </Text>{" "}
              with Next.js 15 App Router
            </List.Item>
            <List.Item>
              <Text component="span" fw={500}>
                Mantine v8
              </Text>{" "}
              component library for UI
            </List.Item>
            <List.Item>
              <Text component="span" fw={500}>
                Dexie.js
              </Text>{" "}
              for IndexedDB management (local storage)
            </List.Item>
            <List.Item>
              <Text component="span" fw={500}>
                FFmpeg WASM
              </Text>{" "}
              for client-side audio processing
            </List.Item>
          </List>
        </Section>

        {/* API Routes */}
        <Section title="API Routes" icon={<Server size={20} />}>
          <Text size="sm" mb="md">
            All API routes are stateless pass-through endpoints to Azure
            services:
          </Text>
          <Stack gap="xs">
            <Paper p="sm" bg="gray.0" radius="sm">
              <Group gap="xs">
                <Badge variant="outline" size="sm" color="blue">
                  POST
                </Badge>
                <Text size="sm" ff="monospace">
                  /api/transcribe
                </Text>
                <ArrowRight size={14} color="gray" />
                <Text size="sm" c="dimmed">
                  Audio transcription via Azure OpenAI Whisper
                </Text>
              </Group>
            </Paper>
            <Paper p="sm" bg="gray.0" radius="sm">
              <Group gap="xs">
                <Badge variant="outline" size="sm" color="blue">
                  POST
                </Badge>
                <Text size="sm" ff="monospace">
                  /api/analyze
                </Text>
                <ArrowRight size={14} color="gray" />
                <Text size="sm" c="dimmed">
                  AI analysis via Azure OpenAI GPT
                </Text>
              </Group>
            </Paper>
            <Paper p="sm" bg="gray.0" radius="sm">
              <Group gap="xs">
                <Badge variant="outline" size="sm" color="blue">
                  POST
                </Badge>
                <Text size="sm" ff="monospace">
                  /api/chat
                </Text>
                <ArrowRight size={14} color="gray" />
                <Text size="sm" c="dimmed">
                  Q&A conversations about transcripts
                </Text>
              </Group>
            </Paper>
          </Stack>
        </Section>

        {/* Data Flow */}
        <Section title="Transcription Data Flow" icon={<ArrowRight size={20} />}>
          <Stack gap="md">
            <Paper p="md" bg="aphBlue.0" radius="sm" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  1. Audio Upload/Recording
                </Text>
                <Text size="sm" c="dimmed">
                  User uploads or records audio in the browser
                </Text>
              </Stack>
            </Paper>
            <Paper p="md" bg="aphGreen.0" radius="sm" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  2. Client-Side Processing (Security Layer)
                </Text>
                <Text size="sm" c="dimmed">
                  Audio is split into ~5 minute segments at natural silence points using FFmpeg WASM.
                  No complete meeting file is ever transmitted as a single unit.
                </Text>
                <List size="xs" c="dimmed" spacing={4}>
                  <List.Item>Original filenames replaced with UUIDs before transmission</List.Item>
                  <List.Item>Chunks cannot be used to reconstruct original file signatures</List.Item>
                  <List.Item>Split points occur at natural conversation pauses</List.Item>
                </List>
              </Stack>
            </Paper>
            <Paper p="md" bg="aphBlue.0" radius="sm" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  3. Transcription (Per Chunk)
                </Text>
                <Text size="sm" c="dimmed">
                  Each chunk sent independently to Azure OpenAI. Processing is transient
                  (in-memory only) — Azure does NOT retain audio after transcription.
                </Text>
              </Stack>
            </Paper>
            <Paper p="md" bg="aphGreen.0" radius="sm" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  4. Client-Side Reassembly
                </Text>
                <Text size="sm" c="dimmed">
                  Transcript segments are merged back together in your browser.
                  The complete transcript exists ONLY in your local IndexedDB.
                </Text>
              </Stack>
            </Paper>
          </Stack>
        </Section>

        {/* Analysis Data Flow */}
        <Section title="Analysis Data Flow" icon={<ArrowRight size={20} />}>
          <Stack gap="md">
            <Paper p="md" bg="aphBlue.0" radius="sm" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  What IS sent to Azure OpenAI:
                </Text>
                <List size="xs" c="dimmed" spacing={4}>
                  <List.Item>Transcript text with timestamp markers</List.Item>
                  <List.Item>Analysis template prompts</List.Item>
                  <List.Item>System prompts for structured extraction</List.Item>
                </List>
              </Stack>
            </Paper>
            <Paper p="md" bg="aphGreen.0" radius="sm" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  What is NOT sent:
                </Text>
                <List size="xs" c="dimmed" spacing={4}>
                  <List.Item>Original audio files (text only)</List.Item>
                  <List.Item>Original filenames (hashed for logging)</List.Item>
                  <List.Item>User identifiers or browser data</List.Item>
                </List>
              </Stack>
            </Paper>
            <Paper p="md" bg="aphBlue.0" radius="sm" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Data Retention:
                </Text>
                <Text size="sm" c="dimmed">
                  <strong>Server-side:</strong> None — all processing is transient.
                  <br />
                  <strong>Azure OpenAI:</strong> Data NOT retained after processing, NOT used for training.
                  <br />
                  <strong>Client-side:</strong> Stored in IndexedDB under your control.
                </Text>
              </Stack>
            </Paper>
          </Stack>
        </Section>

        {/* Security Controls */}
        <Section title="Security Controls" icon={<Shield size={20} />}>
          <List
            spacing="sm"
            size="sm"
            icon={
              <ThemeIcon size={20} radius="xl" variant="light" color="aphGreen">
                <Check size={12} />
              </ThemeIcon>
            }
          >
            <List.Item>
              <Text component="span" fw={500}>Audio Segmentation:</Text> Files split into ~5 min chunks at silence points — no complete meeting transmitted as single unit
            </List.Item>
            <List.Item>
              <Text component="span" fw={500}>Filename Obfuscation:</Text> Original filenames replaced with UUIDs before transmission to Azure
            </List.Item>
            <List.Item>
              <Text component="span" fw={500}>Hash Non-Reconstruction:</Text> Segmented chunks prevent file signature tracing or hash reconstruction
            </List.Item>
            <List.Item>
              <Text component="span" fw={500}>Client-Side Reassembly:</Text> Complete transcripts assembled only in browser, never on server
            </List.Item>
            <List.Item>
              <Text component="span" fw={500}>Transient Processing:</Text> All server-side processing is in-memory only, no data persistence
            </List.Item>
            <List.Item>
              Content Security Policy (CSP) headers configured
            </List.Item>
            <List.Item>Input validation on all API endpoints</List.Item>
            <List.Item>
              HTTPS/TLS 1.2+ enforced for all communications
            </List.Item>
            <List.Item>
              No cookies, sessions, or tracking mechanisms
            </List.Item>
          </List>
        </Section>

        {/* Infrastructure Control */}
        <Section title="Infrastructure Control" icon={<Cloud size={20} />}>
          <Text size="sm" mb="md">
            Both transcription and analysis use internal Azure OpenAI endpoints under centralized governance:
          </Text>
          <Stack gap="xs">
            <Paper p="sm" bg="aphGreen.0" radius="sm" withBorder>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    Configuration Management
                  </Text>
                  <Badge variant="light" size="sm" color="green">
                    ATS / ISO Managed
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Azure OpenAI endpoints managed under Austin Technology Services (ATS) and Information Security Office (ISO) configuration controls
                </Text>
              </Stack>
            </Paper>
            <Paper p="sm" bg="gray.0" radius="sm">
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Azure OpenAI (GPT-4o Transcribe)
                </Text>
                <Badge variant="light" size="sm">
                  Audio Transcription
                </Badge>
              </Group>
            </Paper>
            <Paper p="sm" bg="gray.0" radius="sm">
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Azure OpenAI (GPT-5 / GPT-4.1)
                </Text>
                <Badge variant="light" size="sm">
                  AI Analysis
                </Badge>
              </Group>
            </Paper>
            <Paper p="sm" bg="aphGreen.0" radius="sm" withBorder>
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Access Controls
                </Text>
                <List size="xs" c="dimmed" spacing={4}>
                  <List.Item>Azure Managed Identity (no credentials in code)</List.Item>
                  <List.Item>Azure Key Vault for secret storage</List.Item>
                  <List.Item>RBAC policies enforced</List.Item>
                  <List.Item>Azure backbone network (no public internet transit)</List.Item>
                </List>
              </Stack>
            </Paper>
          </Stack>
          <Text size="sm" c="dimmed" mt="md">
            No analytics, advertising, or third-party tracking services are used.
            Azure OpenAI data is NOT used for model training and NOT retained after processing.
          </Text>
        </Section>
      </Stack>
    </Stack>
  );
}
