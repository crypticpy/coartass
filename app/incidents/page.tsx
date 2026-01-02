'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Group,
  Badge,
  Button,
  Paper,
  ThemeIcon,
} from '@mantine/core';
import { AlertTriangle, FileAudio, Plus, ArrowLeft } from 'lucide-react';

/**
 * Incidents Page
 *
 * Placeholder for incident management feature.
 * Incidents group related radio traffic transcripts for a single call/event.
 */
export default function IncidentsPage() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs">
            <Title order={1}>Incidents</Title>
            <Text c="dimmed" size="lg">
              Group and manage radio traffic by incident
            </Text>
          </Stack>
          <Button
            component={Link}
            href="/"
            variant="subtle"
            leftSection={<ArrowLeft size={18} />}
          >
            Back to Home
          </Button>
        </Group>

        {/* Coming Soon Notice */}
        <Paper p="xl" radius="lg" withBorder>
          <Stack align="center" gap="lg" py="xl">
            <ThemeIcon size={80} radius="xl" color="yellow" variant="light">
              <AlertTriangle size={40} />
            </ThemeIcon>
            <Stack align="center" gap="xs">
              <Title order={2} ta="center">
                Incident Management Coming Soon
              </Title>
              <Text c="dimmed" ta="center" maw={500}>
                This feature will allow you to group multiple radio traffic recordings
                into a single incident for comprehensive analysis and scoring.
              </Text>
            </Stack>

            <Card withBorder p="lg" radius="md" w="100%" maw={600}>
              <Stack gap="md">
                <Text fw={600}>Planned Features:</Text>
                <Stack gap="xs">
                  <Group gap="sm">
                    <Badge color="blue" variant="light">Grouping</Badge>
                    <Text size="sm">Link multiple transcripts to one incident</Text>
                  </Group>
                  <Group gap="sm">
                    <Badge color="green" variant="light">Timeline</Badge>
                    <Text size="sm">View radio traffic in chronological order</Text>
                  </Group>
                  <Group gap="sm">
                    <Badge color="orange" variant="light">Scoring</Badge>
                    <Text size="sm">Apply RTASS rubrics to entire incidents</Text>
                  </Group>
                  <Group gap="sm">
                    <Badge color="purple" variant="light">Reports</Badge>
                    <Text size="sm">Generate comprehensive incident reports</Text>
                  </Group>
                </Stack>
              </Stack>
            </Card>

            <Group gap="md" mt="md">
              <Button
                component={Link}
                href="/upload"
                leftSection={<Plus size={18} />}
                color="aphRed"
              >
                Upload Recording
              </Button>
              <Button
                component={Link}
                href="/transcripts"
                variant="outline"
                leftSection={<FileAudio size={18} />}
              >
                View Transcripts
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
