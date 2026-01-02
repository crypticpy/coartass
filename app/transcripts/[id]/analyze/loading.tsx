import { Container, Skeleton, Stack, Group, Box, Card, Alert, Divider, Progress } from '@mantine/core';

export default function AnalyzeLoading() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Back button skeleton */}
        <Skeleton height={44} width={180} />

        {/* Page header skeleton */}
        <Stack gap="xs">
          <Group gap="md">
            <Skeleton height={32} width={32} circle />
            <Box>
              <Skeleton height={32} width={300} mb={4} />
              <Skeleton height={16} width={400} />
            </Box>
          </Group>
        </Stack>

        <Divider />

        {/* Token info alert skeleton */}
        <Alert
          variant="light"
          styles={{
            root: {
              backgroundColor: 'var(--mantine-color-blue-0)',
              border: '1px solid var(--mantine-color-blue-3)',
            },
          }}
        >
          <Stack gap="md">
            <Group gap="xs">
              <Skeleton height={20} width={200} />
              <Skeleton height={24} width={80} />
            </Group>
            <Skeleton height={16} width="90%" />
            <Box>
              <Group justify="space-between" mb={4}>
                <Skeleton height={12} width={120} />
                <Skeleton height={12} width={40} />
              </Group>
              <Progress value={45} color="blue" size="sm" />
            </Box>
          </Stack>
        </Alert>

        {/* Template selection skeleton */}
        <Stack gap="md">
          <Box>
            <Skeleton height={32} width={300} mb="xs" />
            <Skeleton height={16} width="80%" />
          </Box>

          <Box
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            }}
          >
            {[...Array(3)].map((_, i) => (
              <Card key={i} padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Skeleton height={24} width="70%" />
                      <Skeleton height={16} width="90%" />
                    </Stack>
                    <Skeleton height={20} width={20} circle />
                  </Group>

                  <Group gap="xs">
                    <Skeleton height={24} width={60} />
                    <Skeleton height={24} width={80} />
                    <Skeleton height={24} width={70} />
                  </Group>

                  <Skeleton height={36} width={180} />
                </Stack>
              </Card>
            ))}
          </Box>

          {/* Analyze button skeleton */}
          <Box style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
            <Skeleton height={44} width={200} />
          </Box>
        </Stack>
      </Stack>
    </Container>
  );
}
