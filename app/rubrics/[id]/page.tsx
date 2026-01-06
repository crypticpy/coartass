"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Container,
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { AlertCircle, ArrowLeft, Copy, Download, Pencil } from "lucide-react";
import { notifications } from "@mantine/notifications";
import { getRtassRubricTemplate, saveRtassRubricTemplate } from "@/lib/db";
import type { RtassRubricTemplate } from "@/types/rtass";

function normalizeRubricDates(rubric: RtassRubricTemplate): RtassRubricTemplate {
  return {
    ...rubric,
    createdAt: rubric.createdAt instanceof Date ? rubric.createdAt : new Date(rubric.createdAt),
    updatedAt:
      rubric.updatedAt instanceof Date
        ? rubric.updatedAt
        : rubric.updatedAt
          ? new Date(rubric.updatedAt)
          : undefined,
  };
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function RubricDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rubricId = params.id as string;

  const [rubric, setRubric] = React.useState<RtassRubricTemplate | null>(null);
  const [isBuiltIn, setIsBuiltIn] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const custom = await getRtassRubricTemplate(rubricId);
        if (!mounted) return;
        if (custom) {
          setRubric(custom);
          setIsBuiltIn(false);
          return;
        }

        const res = await fetch(`/api/rtass/rubrics?id=${encodeURIComponent(rubricId)}`, {
          signal: controller.signal,
        });
        const payload = await res.json();
        if (!mounted) return;

        if (!res.ok) {
          setError(payload?.error || "Rubric not found");
          setRubric(null);
          return;
        }

        setRubric(normalizeRubricDates(payload.data as RtassRubricTemplate));
        setIsBuiltIn(true);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load rubric");
        setRubric(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [rubricId]);

  const handleExport = () => {
    if (!rubric) return;
    const base = rubric.name ? rubric.name.replace(/[^\w.-]+/g, "-").toLowerCase() : rubric.id;
    downloadJson(`${base}.json`, rubric);
    notifications.show({
      title: "Exported",
      message: "Rubric JSON downloaded.",
      color: "green",
    });
  };

  const handleDuplicateToCustom = async () => {
    if (!rubric) return;
    setIsDuplicating(true);
    try {
      const now = new Date();
      const newIdBase = `${rubric.id}-custom`;
      const newId = `${newIdBase}-${now.getTime().toString(36)}`;

      const copy: RtassRubricTemplate = {
        ...rubric,
        id: newId,
        name: `${rubric.name} (Custom Copy)`,
        createdAt: now,
        updatedAt: now,
      };

      await saveRtassRubricTemplate(copy);

      notifications.show({
        title: "Copied",
        message: "Built-in rubric copied to your custom rubrics.",
        color: "green",
      });

      router.push(`/rubrics/${newId}/edit`);
    } catch (err) {
      notifications.show({
        title: "Copy failed",
        message: err instanceof Error ? err.message : "Failed to duplicate rubric",
        color: "red",
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <Container size="lg" py={{ base: "md", md: "xl" }}>
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Link href="/rubrics">
            <Button variant="subtle" leftSection={<ArrowLeft size={16} />}>
              Back to Rubrics
            </Button>
          </Link>
        </Group>

        {isLoading && (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        )}

        {error && (
          <Alert color="red" icon={<AlertCircle size={16} />} title="Error">
            {error}
          </Alert>
        )}

        {!isLoading && !error && rubric && (
          <>
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Stack gap={4}>
                <Title order={1}>{rubric.name}</Title>
                <Group gap="xs">
                  <Badge variant="light" color={isBuiltIn ? "blue" : "green"}>
                    {isBuiltIn ? "Built-in" : "Custom"}
                  </Badge>
                  <Badge variant="light" color="gray">
                    v{rubric.version}
                  </Badge>
                  {rubric.jurisdiction && (
                    <Badge variant="light" color="gray">
                      {rubric.jurisdiction}
                    </Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed">
                  {rubric.description}
                </Text>
              </Stack>

              <Group gap="sm">
                <Button
                  variant="default"
                  leftSection={<Download size={16} />}
                  onClick={handleExport}
                >
                  Export JSON
                </Button>
                {isBuiltIn ? (
                  <Button
                    leftSection={<Copy size={16} />}
                    onClick={handleDuplicateToCustom}
                    loading={isDuplicating}
                  >
                    Duplicate to Custom
                  </Button>
                ) : (
                  <Link href={`/rubrics/${rubric.id}/edit`}>
                    <Button leftSection={<Pencil size={16} />}>Edit</Button>
                  </Link>
                )}
              </Group>
            </Group>

            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Title order={2} size="h3">
                  Sections
                </Title>

                <Stack gap="lg">
                  {rubric.sections.map((section) => (
                    <Paper key={section.id} p="md" radius="sm" withBorder>
                      <Group justify="space-between" align="flex-start" wrap="wrap">
                        <Stack gap={2}>
                          <Text fw={600}>{section.title}</Text>
                          <Text size="sm" c="dimmed">
                            {section.description}
                          </Text>
                        </Stack>
                        <Badge variant="light" color="gray">
                          Weight: {Math.round(section.weight * 100)}%
                        </Badge>
                      </Group>

                      <Divider my="sm" />

                      <Table withTableBorder highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Criterion</Table.Th>
                            <Table.Th>Type</Table.Th>
                            <Table.Th>Required</Table.Th>
                            <Table.Th>Weight</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {section.criteria.map((c) => (
                            <Table.Tr key={c.id}>
                              <Table.Td>
                                <Text fw={600} size="sm">
                                  {c.title}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {c.description}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge size="sm" variant="light" color="gray">
                                  {c.type}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                {c.required ? (
                                  <Badge size="sm" variant="light" color="red">
                                    Required
                                  </Badge>
                                ) : (
                                  <Badge size="sm" variant="light" color="gray">
                                    Optional
                                  </Badge>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">
                                  {typeof c.weight === "number"
                                    ? `${Math.round(c.weight * 100)}%`
                                    : "—"}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Paper>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          </>
        )}
      </Stack>
    </Container>
  );
}

