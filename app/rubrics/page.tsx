"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Menu,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  BookOpen,
  Edit,
  MoreVertical,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useRtassRubrics } from "@/hooks/use-rtass-rubrics";
import type { RtassRubricTemplate } from "@/types/rtass";

interface BuiltInRubric {
  id: string;
  name: string;
  description: string;
  version: string;
  jurisdiction?: string;
  tags?: string[];
}

/**
 * Rubrics List Page
 *
 * Shows all available RTASS rubric templates (built-in + custom)
 */
export default function RubricsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [builtInRubrics, setBuiltInRubrics] = useState<BuiltInRubric[]>([]);
  const [builtInLoading, setBuiltInLoading] = useState(true);

  const { rubrics: customRubrics, isLoading, deleteRubric, isDeleting } =
    useRtassRubrics();

  // Fetch built-in rubrics from API
  useEffect(() => {
    async function fetchBuiltIn() {
      try {
        const response = await fetch("/api/rtass/rubrics");
        if (response.ok) {
          const data = await response.json();
          setBuiltInRubrics(data.rubrics || []);
        }
      } catch (error) {
        console.error("Error fetching built-in rubrics:", error);
      } finally {
        setBuiltInLoading(false);
      }
    }
    fetchBuiltIn();
  }, []);

  // Filter rubrics by search term
  const filteredBuiltIn = builtInRubrics.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.jurisdiction?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustom = customRubrics.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.jurisdiction?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Delete handler
  const handleDelete = (rubric: RtassRubricTemplate) => {
    modals.openConfirmModal({
      title: "Delete Rubric",
      children: (
        <Text size="sm">
          Are you sure you want to delete &quot;{rubric.name}&quot;? This action
          cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await deleteRubric(rubric.id);
          notifications.show({
            title: "Deleted",
            message: "Rubric deleted successfully",
            color: "green",
          });
        } catch (error) {
          notifications.show({
            title: "Error",
            message:
              error instanceof Error ? error.message : "Failed to delete rubric",
            color: "red",
          });
        }
      },
    });
  };

  const loading = isLoading || builtInLoading;

  return (
    <Container size="xl" py={{ base: "md", md: "xl" }}>
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <div>
            <Title order={1}>RTASS Rubrics</Title>
            <Text c="dimmed" size="sm" mt="xs">
              Manage rubric templates for radio traffic analysis scoring
            </Text>
          </div>
          <Link href="/rubrics/new">
            <Button leftSection={<Plus size={16} />}>Create Rubric</Button>
          </Link>
        </Group>

        {/* Search */}
        <TextInput
          placeholder="Search rubrics..."
          leftSection={<Search size={16} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Loading State */}
        {loading && (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        )}

        {/* Built-in Rubrics */}
        {!loading && filteredBuiltIn.length > 0 && (
          <Stack gap="md">
            <Group gap="xs">
              <Title order={3} size="h4">
                Built-in Rubrics
              </Title>
              <Badge color="blue" variant="light">
                {filteredBuiltIn.length}
              </Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              {filteredBuiltIn.map((rubric) => (
                <Card key={rubric.id} withBorder shadow="sm">
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start">
                      <Group gap="sm">
                        <BookOpen size={20} color="var(--mantine-color-blue-6)" />
                        <div>
                          <Text fw={600} lineClamp={1}>
                            {rubric.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            v{rubric.version}
                          </Text>
                        </div>
                      </Group>
                      <Badge color="blue" variant="light" size="sm">
                        Built-in
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {rubric.description}
                    </Text>
                    {rubric.jurisdiction && (
                      <Text size="xs" c="dimmed">
                        {rubric.jurisdiction}
                      </Text>
                    )}
                    {rubric.tags && rubric.tags.length > 0 && (
                      <Group gap="xs">
                        {rubric.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} size="xs" variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </Group>
                    )}
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        )}

        {/* Custom Rubrics */}
        {!loading && (
          <Stack gap="md">
            <Group gap="xs">
              <Title order={3} size="h4">
                Custom Rubrics
              </Title>
              <Badge color="green" variant="light">
                {filteredCustom.length}
              </Badge>
            </Group>

            {filteredCustom.length === 0 ? (
              <Card withBorder p="xl" ta="center">
                <Stack align="center" gap="md">
                  <BookOpen size={48} color="var(--mantine-color-gray-5)" />
                  <Text c="dimmed">No custom rubrics yet</Text>
                  <Link href="/rubrics/new">
                    <Button variant="light" leftSection={<Plus size={16} />}>
                      Create Your First Rubric
                    </Button>
                  </Link>
                </Stack>
              </Card>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                {filteredCustom.map((rubric) => (
                  <Card key={rubric.id} withBorder shadow="sm">
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <Group gap="sm">
                          <BookOpen
                            size={20}
                            color="var(--mantine-color-green-6)"
                          />
                          <div>
                            <Text fw={600} lineClamp={1}>
                              {rubric.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              v{rubric.version}
                            </Text>
                          </div>
                        </Group>
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" size="sm">
                              <MoreVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<Edit size={14} />}
                              component={Link}
                              href={`/rubrics/${rubric.id}/edit`}
                            >
                              Edit
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<Trash2 size={14} />}
                              color="red"
                              onClick={() => handleDelete(rubric)}
                              disabled={isDeleting === rubric.id}
                            >
                              Delete
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {rubric.description}
                      </Text>
                      {rubric.jurisdiction && (
                        <Text size="xs" c="dimmed">
                          {rubric.jurisdiction}
                        </Text>
                      )}
                      <Group gap="xs">
                        <Badge size="xs" variant="light">
                          {rubric.sections.length} sections
                        </Badge>
                        {rubric.tags &&
                          rubric.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} size="xs" variant="outline">
                              {tag}
                            </Badge>
                          ))}
                      </Group>
                      <Text size="xs" c="dimmed">
                        Created {new Date(rubric.createdAt).toLocaleDateString()}
                      </Text>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
