'use client';

import { Container, Skeleton, Stack, Card, Box, Group } from '@mantine/core';

export default function UploadLoading() {
  return (
    <Container size="lg" py={{ base: "md", md: "xl" }}>
      <Stack gap="xl">
        {/* Header */}
        <Box>
          <Skeleton height={16} width={120} mb="md" />
          <Group gap="md" mb="xs" wrap="nowrap">
            <Skeleton height={40} width={40} />
            <Box>
              <Skeleton height={32} width={200} mb={4} />
              <Skeleton height={16} width={300} />
            </Box>
          </Group>
        </Box>

        {/* Tabs skeleton */}
        <Box>
          <Group mb="xl" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
            <Skeleton height={40} width={120} />
            <Skeleton height={40} width={120} />
          </Group>

          {/* File upload card */}
          <Card withBorder shadow="sm" radius="md">
            <Card.Section withBorder inheritPadding py="md">
              <Skeleton height={24} width="40%" mb={4} />
              <Skeleton height={16} width="80%" />
            </Card.Section>
            <Card.Section inheritPadding py="md">
              <Stack align="center" gap="md" py="xl">
                <Skeleton height={80} width={80} circle />
                <Skeleton height={24} width="60%" />
                <Skeleton height={16} width="80%" />
                <Group gap="xs">
                  <Skeleton height={24} width={60} />
                  <Skeleton height={24} width={60} />
                  <Skeleton height={24} width={60} />
                </Group>
              </Stack>
            </Card.Section>
          </Card>
        </Box>

        {/* Settings section skeleton */}
        <Card withBorder shadow="sm" radius="md">
          <Card.Section withBorder inheritPadding py="md">
            <Group gap="sm">
              <Skeleton height={20} width={20} circle />
              <Box>
                <Skeleton height={24} width="40%" mb={4} />
                <Skeleton height={16} width="60%" />
              </Box>
            </Group>
          </Card.Section>
          <Card.Section inheritPadding py="md">
            <Stack gap="md">
              <Skeleton height={56} />
              <Skeleton height={56} />
              <Skeleton height={56} />
            </Stack>
          </Card.Section>
        </Card>

        {/* Info alert skeleton */}
        <Box
          p="md"
          style={{
            border: '1px solid var(--mantine-color-blue-3)',
            borderRadius: 'var(--mantine-radius-md)',
            backgroundColor: 'var(--mantine-color-blue-0)',
          }}
        >
          <Skeleton height={16} width="90%" />
        </Box>
      </Stack>
    </Container>
  );
}
