import { Container } from "@mantine/core";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container size="xl" py="xl">
      {children}
    </Container>
  );
}
