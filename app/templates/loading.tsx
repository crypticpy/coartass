'use client';

import { Container, Skeleton, Stack, Grid, Group, Paper } from '@mantine/core';

export default function TemplatesLoading() {
  return (
    <Container size="xl" py={{ base: 'md', md: 'xl' }}>
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs">
            <Skeleton height={36} width={200} />
            <Skeleton height={20} width={350} />
          </Stack>
          <Skeleton height={36} width={150} />
        </Group>

        {/* Built-in templates section */}
        <Stack gap="lg">
          <Stack gap={4}>
            <Skeleton height={32} width={250} />
            <Skeleton height={16} width={350} />
          </Stack>
          <Grid>
            {[...Array(3)].map((_, i) => (
              <Grid.Col key={i} span={{ base: 12, sm: 6, lg: 4 }}>
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <Group gap="sm">
                        <Skeleton height={36} width={36} />
                        <Skeleton height={24} width="60%" />
                      </Group>
                      <Skeleton height={24} width={60} />
                    </Group>
                    <Skeleton height={48} />
                    <Group gap="xs">
                      <Skeleton height={24} width={60} />
                      <Skeleton height={24} width={80} />
                    </Group>
                    <Skeleton height={36} />
                  </Stack>
                </Paper>
              </Grid.Col>
            ))}
          </Grid>
        </Stack>

        {/* Custom templates section */}
        <Stack gap="lg">
          <Stack gap={4}>
            <Skeleton height={32} width={250} />
            <Skeleton height={16} width={300} />
          </Stack>
          <Grid>
            {[...Array(2)].map((_, i) => (
              <Grid.Col key={i} span={{ base: 12, sm: 6, lg: 4 }}>
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <Group gap="sm">
                        <Skeleton height={36} width={36} />
                        <Skeleton height={24} width="60%" />
                      </Group>
                      <Skeleton height={24} width={60} />
                    </Group>
                    <Skeleton height={48} />
                    <Group gap="xs">
                      <Skeleton height={24} width={60} />
                      <Skeleton height={24} width={80} />
                    </Group>
                    <Group gap="xs">
                      <Skeleton height={36} style={{ flex: 1 }} />
                      <Skeleton height={36} width={36} />
                      <Skeleton height={36} width={36} />
                    </Group>
                  </Stack>
                </Paper>
              </Grid.Col>
            ))}
          </Grid>
        </Stack>
      </Stack>
    </Container>
  );
}
