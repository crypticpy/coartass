import { Container, Skeleton, Stack, Group, Card, Box, Divider } from '@mantine/core';

export default function TemplateDetailLoading() {
  return (
    <Container size="xl" py={{ base: 'md', md: 'xl' }}>
      <Stack gap="xl">
        {/* Navigation header skeleton */}
        <Group justify="space-between" align="center">
          <Skeleton height={36} width={160} />
          <Skeleton height={36} width={140} />
        </Group>

        {/* Template detail card skeleton */}
        <Card withBorder padding="lg">
          <Stack gap="lg">
            {/* Header section */}
            <Group gap="md" align="flex-start">
              <Skeleton height={48} width={48} />
              <Box style={{ flex: 1 }}>
                <Skeleton height={32} width="60%" mb="xs" />
                <Skeleton height={20} width="80%" />
              </Box>
              <Skeleton height={28} width={80} />
            </Group>

            <Divider />

            {/* Metadata section */}
            <Stack gap="sm">
              <Group gap="xs">
                <Skeleton height={20} width={100} />
                <Skeleton height={24} width={120} />
              </Group>
              <Group gap="xs">
                <Skeleton height={20} width={80} />
                <Skeleton height={24} width={100} />
              </Group>
            </Stack>

            <Divider />

            {/* Sections skeleton */}
            <Stack gap="md">
              <Skeleton height={24} width={150} />
              {[...Array(3)].map((_, i) => (
                <Card key={i} withBorder padding="md">
                  <Stack gap="sm">
                    <Skeleton height={20} width="40%" />
                    <Skeleton height={16} width="90%" />
                    <Skeleton height={16} width="85%" />
                    <Group gap="xs" mt="xs">
                      <Skeleton height={24} width={80} />
                      <Skeleton height={24} width={100} />
                    </Group>
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
