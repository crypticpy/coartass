import { Skeleton, Stack, Container } from "@mantine/core";

export default function DocsLoading() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        <Skeleton height={40} width={300} />
        <Skeleton height={20} width={400} />
        <Skeleton height={200} />
      </Stack>
    </Container>
  );
}
