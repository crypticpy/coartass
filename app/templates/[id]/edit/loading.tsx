import { Container, Skeleton, Stack, Group, Paper, Card, Divider } from '@mantine/core';

export default function EditTemplateLoading() {
  return (
    <Container size="lg" py={{ base: 'md', md: 'xl' }}>
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Skeleton height={36} width={160} />
          <Skeleton height={36} width={140} />
        </Group>

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

            {/* Section cards skeleton */}
            {[...Array(2)].map((_, i) => (
              <Card key={i} withBorder padding="md">
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
            ))}

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
