'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Stack, Title, Text, Alert, Button, Group } from '@mantine/core';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root Error Boundary
 *
 * Catches errors that occur anywhere in the application.
 * Provides a user-friendly error message and recovery options.
 */
export default function Error({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to the console for debugging
    console.error('Application Error:', error);
  }, [error]);

  return (
    <Container size="sm" py="xl" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <Stack gap="xl" align="center" justify="center" style={{ minHeight: '60vh' }}>
        <Alert
          icon={<AlertCircle size={24} />}
          title="Something Went Wrong"
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
              We encountered an unexpected error while processing your request.
              This has been logged and our team will investigate.
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

        <Stack gap="md" align="center">
          <Title order={2} ta="center" c="aphBlue.7">
            Austin RTASS
          </Title>
          <Text size="lg" ta="center" c="dimmed" maw={500}>
            Don&apos;t worry, your data is safe. Try refreshing the page or return to the home page.
          </Text>
        </Stack>

        <Group gap="md" wrap="wrap" justify="center">
          <Button
            size="lg"
            leftSection={<RefreshCw size={20} />}
            onClick={reset}
            color="aphBlue"
            styles={{
              root: {
                minHeight: 48,
              },
            }}
          >
            Try Again
          </Button>
          <Button
            size="lg"
            variant="outline"
            leftSection={<Home size={20} />}
            onClick={() => router.push('/')}
            color="aphGreen"
            styles={{
              root: {
                minHeight: 48,
              },
            }}
          >
            Go Home
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
