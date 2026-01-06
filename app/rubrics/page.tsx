"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Download,
  Edit,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Upload,
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
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [builtInRubrics, setBuiltInRubrics] = useState<BuiltInRubric[]>([]);
  const [builtInLoading, setBuiltInLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { rubrics: customRubrics, isLoading, deleteRubric, isDeleting, saveRubric } =
    useRtassRubrics();

  // Fetch built-in rubrics from API
  useEffect(() => {
    async function fetchBuiltIn() {
      try {
        const response = await fetch("/api/rtass/rubrics");
        if (response.ok) {
          const payload = await response.json();
          setBuiltInRubrics(Array.isArray(payload?.data) ? payload.data : []);
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

  const exportRubric = (rubric: RtassRubricTemplate) => {
    const blob = new Blob([JSON.stringify(rubric, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const base = rubric.name ? rubric.name.replace(/[^\w.-]+/g, "-").toLowerCase() : rubric.id;
    a.download = `${base}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (file: File) => {
    setIsImporting(true);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as Partial<RtassRubricTemplate>;

      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid JSON");
      }
      if (!parsed.name || !parsed.description || !parsed.version) {
        throw new Error("Missing required fields (name, description, version)");
      }
      if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
        throw new Error("Rubric must include at least one section");
      }
      if (!parsed.scoring || !parsed.llm) {
        throw new Error("Rubric must include scoring and llm configuration");
      }

      const now = new Date();
      const baseId = typeof parsed.id === "string" && parsed.id.trim().length > 0
        ? parsed.id.trim()
        : parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const allExistingIds = new Set([
        ...builtInRubrics.map((r) => r.id),
        ...customRubrics.map((r) => r.id),
      ]);
      const id = allExistingIds.has(baseId) ? `${baseId}-imported-${now.getTime().toString(36)}` : baseId;

      const rubricToSave: RtassRubricTemplate = {
        ...(parsed as RtassRubricTemplate),
        id,
        createdAt: parsed.createdAt instanceof Date ? parsed.createdAt : parsed.createdAt ? new Date(parsed.createdAt) : now,
        updatedAt: now,
      };

      await saveRubric(rubricToSave);

      notifications.show({
        title: "Imported",
        message: "Rubric imported to your custom rubrics.",
        color: "green",
      });

      router.push(`/rubrics/${id}/edit`);
    } catch (error) {
      notifications.show({
        title: "Import failed",
        message: error instanceof Error ? error.message : "Failed to import rubric",
        color: "red",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
          <Group gap="sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) void handleImportFile(file);
              }}
            />
            <Button
              variant="light"
              leftSection={<Upload size={16} />}
              onClick={handleImportClick}
              loading={isImporting}
            >
              Import
            </Button>
            <Link href="/rubrics/new">
              <Button leftSection={<Plus size={16} />}>Create Rubric</Button>
            </Link>
          </Group>
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
                    <Group justify="flex-end">
                      <Link href={`/rubrics/${rubric.id}`}>
                        <Button size="xs" variant="subtle">
                          View
                        </Button>
                      </Link>
                    </Group>
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
                              leftSection={<BookOpen size={14} />}
                              component={Link}
                              href={`/rubrics/${rubric.id}`}
                            >
                              View
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<Edit size={14} />}
                              component={Link}
                              href={`/rubrics/${rubric.id}/edit`}
                            >
                              Edit
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<Download size={14} />}
                              onClick={() => exportRubric(rubric)}
                            >
                              Export JSON
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
