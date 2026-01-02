'use client';

import { Container, Skeleton, Stack, Grid, Card, Group, Box, Alert } from '@mantine/core';

export default function Loading() {
  return (
    <Container size="xl" py={{ base: 'md', md: 'xl' }} px={{ base: 'md', sm: 'lg' }}>
      <Stack gap="xl">
        {/* Alert skeleton */}
        <Alert styles={{ root: { borderLeft: '4px solid var(--mantine-color-red-6)' } }}>
          <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
            <Skeleton height={40} width="60%" />
            <Skeleton height={44} width={140} />
          </Group>
        </Alert>

        {/* Hero section skeleton */}
        <Stack gap="lg" align="center" py={{ base: 'lg', md: 'xl' }}>
          <Skeleton height={48} width="70%" />
          <Skeleton height={24} width="50%" />
          <Group gap="md" mt="md">
            <Skeleton height={44} width={150} />
            <Skeleton height={44} width={150} />
          </Group>
        </Stack>

        {/* Recent transcripts section skeleton */}
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Box>
              <Skeleton height={32} width={200} mb="xs" />
              <Skeleton height={20} width={250} />
            </Box>
            <Skeleton height={44} width={120} />
          </Group>

          <Grid>
            {[...Array(3)].map((_, i) => (
              <Grid.Col key={i} span={{ base: 12, sm: 6, lg: 4 }}>
                <Card padding="lg" shadow="sm" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <Skeleton height={20} width="70%" />
                      <Skeleton height={20} width={20} circle />
                    </Group>
                    <Skeleton height={16} width="50%" />
                    <Skeleton height={60} />
                    <Skeleton height={24} width={80} />
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </Stack>
      </Stack>
    </Container>
  );
}
