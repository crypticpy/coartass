import { Container, Skeleton, Stack, Card, Group, Box } from '@mantine/core';

export default function TranscriptsLoading() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header skeleton */}
        <Stack gap="xs">
          <Skeleton height={40} width="30%" />
          <Skeleton height={20} width="50%" />
        </Stack>

        {/* Search bar skeleton */}
        <Group align="center" gap="md" wrap="nowrap" style={{ flexDirection: 'row' }}>
          <Skeleton height={44} style={{ flex: 1, maxWidth: 512 }} />
          <Skeleton height={20} width={120} />
        </Group>

        {/* Transcript cards skeleton */}
        <Box
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          }}
        >
          {[...Array(6)].map((_, i) => (
            <Card key={i} padding="lg" radius="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Skeleton height={24} width="75%" />
                  <Skeleton height={44} width={44} />
                </Group>
                <Skeleton height={16} width="50%" />
                <Skeleton height={48} />
                <Group gap="xs" mt="xs">
                  <Skeleton height={14} width={14} circle />
                  <Skeleton height={16} width={60} />
                </Group>
              </Stack>
            </Card>
          ))}
        </Box>
      </Stack>
    </Container>
  );
}
