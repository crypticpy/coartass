'use client';

import { Container, Skeleton, Stack, Group, Box, Card, Paper, Tabs, Divider } from '@mantine/core';

export default function TranscriptDetailLoading() {
  return (
    <div className="content-max-width">
      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Back button skeleton */}
          <Skeleton height={44} width={180} />

          {/* Page header skeleton */}
          <Stack gap="xs">
            <Group gap="md">
              <Skeleton height={32} width={32} circle />
              <Box style={{ flex: 1 }}>
                <Skeleton height={32} width="50%" mb="xs" />
                <Skeleton height={16} width="70%" />
              </Box>
            </Group>
          </Stack>

          <Divider />

          {/* Transcript header metadata skeleton */}
          <Card withBorder padding="lg">
            <Group justify="space-between" align="flex-start">
              <Stack gap="sm" style={{ flex: 1 }}>
                <Skeleton height={20} width="30%" />
                <Skeleton height={16} width="40%" />
              </Stack>
              <Group gap="xs">
                <Skeleton height={36} width={100} />
                <Skeleton height={36} width={100} />
                <Skeleton height={36} width={100} />
              </Group>
            </Group>
          </Card>

          {/* Audio player skeleton */}
          <Paper
            p="md"
            radius="md"
            bg="gray.0"
            style={{ border: "1px solid var(--mantine-color-gray-3)" }}
          >
            <Stack gap="xs">
              <Group gap="xs" mb="xs">
                <Skeleton height={14} width={14} circle />
                <Skeleton height={12} width={120} />
              </Group>
              <Skeleton height={120} />
            </Stack>
          </Paper>

          {/* Tabs skeleton */}
          <div className="sticky-tabs">
            <Tabs value="transcript" variant="default">
              <Tabs.List mb="md">
                <Tabs.Tab value="transcript">
                  <Skeleton height={16} width={80} />
                </Tabs.Tab>
                <Tabs.Tab value="analysis">
                  <Group gap="xs">
                    <Skeleton height={16} width={70} />
                    <Skeleton height={20} width={20} circle />
                  </Group>
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="transcript">
                <Paper
                  p={0}
                  radius="md"
                  withBorder
                  style={{
                    boxShadow: "var(--mantine-shadow-sm)",
                    overflow: "hidden",
                  }}
                >
                  <Card withBorder padding="lg">
                    <Stack gap="md">
                      <Skeleton height={24} width="30%" />
                      {[...Array(10)].map((_, i) => (
                        <Box key={i}>
                          <Skeleton height={14} width="10%" mb={4} />
                          <Skeleton height={48} />
                        </Box>
                      ))}
                    </Stack>
                  </Card>
                </Paper>
              </Tabs.Panel>
            </Tabs>
          </div>
        </Stack>
      </Container>
    </div>
  );
}
