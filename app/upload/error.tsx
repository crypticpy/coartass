'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Stack, Title, Text, Alert, Button, Group, Card, List, ThemeIcon } from '@mantine/core';
import { AlertCircle, Home, RefreshCw, Upload, CheckCircle } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Upload Error Boundary
 *
 * Catches errors that occur during the file upload process.
 * Provides helpful troubleshooting tips and recovery options.
 */
export default function UploadError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to the console for debugging
    console.error('Upload Error:', error);
  }, [error]);

  return (
    <Container size="md" py="xl" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <Stack gap="xl" align="center" justify="center" style={{ minHeight: '60vh' }}>
        <Alert
          icon={<AlertCircle size={24} />}
          title="Upload Error"
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
              An error occurred while processing your upload. Your file may not have been uploaded successfully.
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
            maxWidth: 700,
          }}
        >
          <Stack gap="lg">
            <Stack gap="xs" align="center">
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
                <Upload size={40} color="var(--mantine-color-aphBlue-6)" />
              </div>

              <Title order={2} ta="center" c="aphBlue.7" mt="sm">
                Upload Interrupted
              </Title>
              <Text size="md" ta="center" c="dimmed" maw={500}>
                Don&apos;t worry - your file hasn&apos;t been uploaded yet. Try again or check the tips below.
              </Text>
            </Stack>

            <Card withBorder padding="md" radius="md" style={{ background: 'var(--mantine-color-aphBlue-0)' }}>
              <Stack gap="sm">
                <Text size="sm" fw={600} c="aphBlue.7">
                  Troubleshooting Tips:
                </Text>
                <List
                  spacing="xs"
                  size="sm"
                  icon={
                    <ThemeIcon size={20} radius="xl" color="aphGreen" variant="light">
                      <CheckCircle size={14} />
                    </ThemeIcon>
                  }
                >
                  <List.Item>Ensure your file is a supported audio format (MP3, WAV, M4A, WEBM, MP4)</List.Item>
                  <List.Item>Check that your file size is under 25MB</List.Item>
                  <List.Item>Verify you have a stable internet connection</List.Item>
                  <List.Item>Make sure your Azure OpenAI API is configured correctly</List.Item>
                  <List.Item>Try refreshing the page and uploading again</List.Item>
                </List>
              </Stack>
            </Card>

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
                leftSection={<Home size={18} />}
                onClick={() => router.push('/')}
                color="aphGreen"
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
