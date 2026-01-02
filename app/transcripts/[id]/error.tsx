'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Stack, Title, Text, Alert, Button, Group, Card } from '@mantine/core';
import { AlertCircle, Home, RefreshCw, FileText } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Transcript Detail Error Boundary
 *
 * Catches errors that occur while viewing or processing a specific transcript.
 * Provides context-specific error messaging and recovery options.
 */
export default function TranscriptError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to the console for debugging
    console.error('Transcript Error:', error);
  }, [error]);

  return (
    <Container size="md" py="xl" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <Stack gap="xl" align="center" justify="center" style={{ minHeight: '60vh' }}>
        <Alert
          icon={<AlertCircle size={24} />}
          title="Unable to Load Transcript"
          color="aphRed"
          radius="lg"
          styles={{
            root: {
              width: '100%',
              borderLeft: '4px solid var(--mantine-color-aphRed-6)',
            },
          }}
        >
          <Stack gap="sm">
            <Text size="sm">
              We encountered an error while loading this transcript. The transcript may have been deleted,
              or there may be an issue with the stored data.
            </Text>
            {error.message && (
              <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                Error: {error.message}
              </Text>
            )}
            {error.digest && (
              <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                Error ID: {error.digest}
              </Text>
            )}
          </Stack>
        </Alert>

        <Card
          padding="xl"
          radius="lg"
          withBorder
          shadow="sm"
          style={{
            width: '100%',
            maxWidth: 600,
          }}
        >
          <Stack gap="lg" align="center">
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--mantine-color-aphBlue-1) 0%, var(--mantine-color-aphBlue-2) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={40} color="var(--mantine-color-aphBlue-6)" />
            </div>

            <Stack gap="xs" align="center">
              <Title order={2} ta="center" c="aphBlue.7">
                Transcript Not Available
              </Title>
              <Text size="md" ta="center" c="dimmed" maw={450}>
                This transcript cannot be displayed at the moment. You can try refreshing
                or return to view all your transcripts.
              </Text>
            </Stack>

            <Group gap="md" wrap="wrap" justify="center" mt="md">
              <Button
                size="md"
                leftSection={<RefreshCw size={18} />}
                onClick={reset}
                color="aphBlue"
              >
                Try Again
              </Button>
              <Button
                size="md"
                variant="outline"
                leftSection={<FileText size={18} />}
                onClick={() => router.push('/transcripts')}
                color="aphGreen"
              >
                All Transcripts
              </Button>
              <Button
                size="md"
                variant="subtle"
                leftSection={<Home size={18} />}
                onClick={() => router.push('/')}
                color="aphGray"
              >
                Go Home
              </Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
