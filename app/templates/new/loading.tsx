import { Container, Skeleton, Stack, Group, Paper, Card, Divider } from '@mantine/core';

export default function NewTemplateLoading() {
  return (
    <Container size="lg" py={{ base: 'md', md: 'xl' }}>
      <Stack gap="xl">
        {/* Back button */}
        <Skeleton height={36} width={160} />

        {/* Page title */}
        <Stack gap="xs">
          <Skeleton height={36} width={250} />
          <Skeleton height={20} width="70%" />
        </Stack>

        {/* Form skeleton */}
        <Paper withBorder p="lg">
          <Stack gap="lg">
            {/* Basic info section */}
            <Stack gap="md">
              <Skeleton height={24} width={180} />
              <Skeleton height={56} />
              <Skeleton height={100} />
              <Group gap="md">
                <Skeleton height={56} style={{ flex: 1 }} />
                <Skeleton height={56} style={{ flex: 1 }} />
              </Group>
            </Stack>

            <Divider />

            {/* Sections header */}
            <Group justify="space-between" align="center">
              <Skeleton height={24} width={200} />
              <Skeleton height={36} width={130} />
            </Group>

            {/* Section card skeleton */}
            <Card withBorder p="md">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Skeleton height={20} width={150} />
                  <Skeleton height={36} width={36} />
                </Group>
                <Skeleton height={56} />
                <Skeleton height={120} />
                <Group gap="md">
                  <Skeleton height={56} style={{ flex: 1 }} />
                  <Skeleton height={40} width={200} />
                </Group>
              </Stack>
            </Card>

            <Divider />

            {/* Action buttons */}
            <Group justify="flex-end" gap="md">
              <Skeleton height={44} width={100} />
              <Skeleton height={44} width={150} />
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
