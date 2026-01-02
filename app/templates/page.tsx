"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileText,
  Trash2,
  Edit,
  Loader2,
  CheckCircle,
  AlertCircle,
  Search,
  Settings2,
} from "lucide-react";
import {
  Button,
  Paper,
  Alert,
  Container,
  Stack,
  Group,
  SimpleGrid,
  ThemeIcon,
  Text,
  Title,
  ActionIcon,
  SegmentedControl,
  TextInput,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useTemplates } from "@/hooks/use-templates";
import { deleteTemplate } from "@/lib/db";
import { getBuiltInTemplateCount, BUILT_IN_TEMPLATES } from "@/lib/template-seeding";
import {
  getUserCategorySettings,
  saveUserCategorySettings,
  resetUserCategorySettings,
  getEffectiveCategory,
  type UserCategorySettings,
} from "@/lib/user-categories";
import { CategoryManagerModal } from "@/components/templates/category-manager-modal";
import type { Template } from "@/types";

/**
 * Compact Template Card Component
 */
const CompactTemplateCard = React.memo(function CompactTemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: Template;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
}) {
  // Use the canonical isCustom field instead of deriving from category
  const isCustom = template.isCustom;

  return (
    <Paper
      component={Link}
      href={`/templates/${template.id}`}
      p="sm"
      withBorder
      style={{
        cursor: 'pointer',
        minHeight: 80,
        transition: 'all 150ms ease',
        textDecoration: 'none',
        color: 'inherit',
      }}
      className="hover:shadow-md"
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
          <ThemeIcon size="lg" variant="light" color="blue" style={{ flexShrink: 0 }}>
            <FileText size={20} />
          </ThemeIcon>
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={600} lineClamp={2}>
              {template.name}
            </Text>
            <Text size="xs" c="dimmed">
              {template.sections.length} section{template.sections.length !== 1 ? 's' : ''}
            </Text>
          </Stack>
        </Group>

        {/* Edit/Delete icons for custom templates - always visible */}
        {isCustom && onEdit && onDelete && (
          <Group gap={4} style={{ flexShrink: 0 }}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(e);
              }}
              aria-label="Edit template"
            >
              <Edit size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              size="lg"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(e);
              }}
              aria-label="Delete template"
            >
              <Trash2 size={16} />
            </ActionIcon>
          </Group>
        )}
      </Group>
    </Paper>
  );
}, (prevProps, nextProps) => {
  // Only re-render if template ID or handlers change
  return (
    prevProps.template.id === nextProps.template.id &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onDelete === nextProps.onDelete
  );
});

/**
 * Templates page with compact card layout and category filtering
 */
export default function TemplatesPage() {
  const router = useRouter();
  const { templates, isLoading } = useTemplates();
  const [seedingStatus, setSeedingStatus] = React.useState<
    'checking' | 'seeding' | 'success' | 'error' | null
  >('checking');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('review');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [userSettings, setUserSettings] = React.useState<UserCategorySettings>({
    customCategories: [],
    templateAssignments: {},
  });
  const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);

  // Load user category settings from localStorage on mount
  React.useEffect(() => {
    setUserSettings(getUserCategorySettings());
  }, []);

  // Optimize: Use single query and derive built-in/custom templates in memory
  const { builtInTemplates, customTemplates } = React.useMemo(() => {
    return {
      builtInTemplates: templates.filter(t => !t.isCustom),
      customTemplates: templates.filter(t => t.isCustom),
    };
  }, [templates]);

  // Check seeding status on mount with proper cleanup
  React.useEffect(() => {
    let mounted = true;
    let hideTimer: NodeJS.Timeout;

    async function checkSeedingStatus() {
      try {
        const count = await getBuiltInTemplateCount();
        if (!mounted) return;

        if (count >= BUILT_IN_TEMPLATES.length) {
          setSeedingStatus('success');
          hideTimer = setTimeout(() => {
            if (mounted) setSeedingStatus(null);
          }, 3000);
        } else if (count === 0) {
          setSeedingStatus('seeding');
        } else {
          setSeedingStatus('error');
        }
      } catch (error) {
        if (mounted) {
          console.error('Error checking seeding status:', error);
          setSeedingStatus('error');
        }
      }
    }

    checkSeedingStatus();

    return () => {
      mounted = false;
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  // Filter templates by selected category and search query
  const filteredTemplates = React.useMemo(() => {
    let result: Template[] = [];

    if (selectedCategory === 'custom') {
      // Show user's custom-created templates
      result = customTemplates;
    } else if (userSettings.customCategories.includes(selectedCategory)) {
      // User-defined category: show templates assigned to it
      result = templates.filter(t =>
        userSettings.templateAssignments[t.id] === selectedCategory
      );
    } else {
      // Built-in category: show templates in this category (considering user overrides)
      result = builtInTemplates.filter((template) => {
        const effectiveCategory = getEffectiveCategory(template.id, template.name);
        return effectiveCategory === selectedCategory;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(t =>
        t.name.toLowerCase().includes(query)
      );
    }

    return result;
  }, [selectedCategory, builtInTemplates, customTemplates, templates, userSettings, searchQuery]);

  // Category data for SegmentedControl - includes user-defined categories
  const categoryData = React.useMemo(() => {
    // Count templates per built-in category (considering user overrides)
    const counts: Record<string, number> = { meeting: 0, interview: 0, review: 0 };

    // Single pass through built-in templates
    builtInTemplates.forEach(t => {
      const effectiveCategory = getEffectiveCategory(t.id, t.name);
      if (counts[effectiveCategory] !== undefined) {
        counts[effectiveCategory]++;
      }
    });

    // Count user-defined category assignments
    const userCategoryCounts: Record<string, number> = {};
    userSettings.customCategories.forEach(cat => {
      userCategoryCounts[cat] = 0;
    });
    Object.values(userSettings.templateAssignments).forEach(cat => {
      if (userCategoryCounts[cat] !== undefined) {
        userCategoryCounts[cat]++;
      }
    });

    // Build category options
    const data = [
      { label: `Meeting (${counts.meeting})`, value: 'meeting' },
      { label: `Interview (${counts.interview})`, value: 'interview' },
      { label: `Review (${counts.review})`, value: 'review' },
      // User-defined categories
      ...userSettings.customCategories.map(cat => ({
        label: `${cat} (${userCategoryCounts[cat]})`,
        value: cat,
      })),
      { label: `My Templates (${customTemplates.length})`, value: 'custom' },
    ];

    return data;
  }, [builtInTemplates, customTemplates, userSettings]);

  // Handle save user category settings
  const handleSaveUserSettings = React.useCallback((settings: UserCategorySettings) => {
    saveUserCategorySettings(settings);
    setUserSettings(settings);
    notifications.show({
      title: 'Categories Updated',
      message: 'Your category preferences have been saved.',
      color: 'green',
    });
  }, []);

  // Handle reset user category settings
  const handleResetUserSettings = React.useCallback(() => {
    resetUserCategorySettings();
    setUserSettings({ customCategories: [], templateAssignments: {} });
    setSelectedCategory('meeting'); // Reset to default category
    notifications.show({
      title: 'Categories Reset',
      message: 'Template categories have been reset to defaults.',
      color: 'blue',
    });
  }, []);

  const handleEdit = (templateId: string) => () => {
    router.push(`/templates/${templateId}/edit`);
  };

  const handleDelete = (templateId: string, templateName: string) => () => {
    modals.openConfirmModal({
      title: 'Delete Custom Template',
      children: `Are you sure you want to delete "${templateName}"? This action cannot be undone. All analyses created with this template will remain, but you won't be able to use this template for new analyses.`,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteTemplate(templateId);
          notifications.show({
            title: 'Template Deleted',
            message: 'The custom template has been deleted successfully.',
            color: 'green',
          });
        } catch (error) {
          console.error('Error deleting template:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to delete template.';
          notifications.show({
            title: 'Error',
            message: errorMessage,
            color: 'red',
          });
        }
      },
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <Container size="xl" py={{ base: 'md', md: 'xl' }}>
        <Stack gap="xl">
          <Stack gap="xs">
            <div
              style={{
                height: 32,
                background: 'var(--mantine-color-gray-2)',
                borderRadius: 4,
                width: 192,
              }}
              className="animate-pulse"
            ></div>
            <div
              style={{
                height: 16,
                background: 'var(--mantine-color-gray-2)',
                borderRadius: 4,
                width: 384,
              }}
              className="animate-pulse"
            ></div>
          </Stack>
          <SimpleGrid cols={{ base: 2, sm: 2, md: 3, lg: 4 }} spacing="md">
            {[...Array(8)].map((_, i) => (
              <Paper key={i} p="sm" withBorder className="animate-pulse" style={{ minHeight: 80 }}>
                <div>
                  <div
                    style={{
                      height: 16,
                      background: 'var(--mantine-color-gray-2)',
                      borderRadius: 4,
                      width: '75%',
                    }}
                  ></div>
                  <div
                    style={{
                      height: 12,
                      background: 'var(--mantine-color-gray-2)',
                      borderRadius: 4,
                      width: '50%',
                      marginTop: 8,
                    }}
                  ></div>
                </div>
              </Paper>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" py={{ base: 'md', md: 'xl' }}>
      <Stack gap="xl">
        {/* Seeding Status Alerts */}
        {seedingStatus === 'seeding' && (
          <Alert icon={<Loader2 size={16} className="animate-spin" />}>
            Loading built-in templates...
          </Alert>
        )}

        {seedingStatus === 'success' && (
          <Alert icon={<CheckCircle size={16} />} color="green">
            Built-in templates loaded successfully!
          </Alert>
        )}

        {seedingStatus === 'error' && (
          <Alert icon={<AlertCircle size={16} />} color="red">
            Failed to load some built-in templates. Please refresh the page.
          </Alert>
        )}

        {/* Header Section */}
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs">
            <Title order={1} size="h1">
              Templates
            </Title>
            <Text c="dimmed">
              Choose a template to analyze your transcripts or create your own
            </Text>
          </Stack>
          <Link href="/templates/new">
            <Button variant="filled" leftSection={<Plus size={16} />} data-tour-id="create-template-button">
              Create Template
            </Button>
          </Link>
        </Group>

        {/* Search and Category Controls */}
        <Stack gap="md">
          {/* Search Input */}
          <TextInput
            placeholder="Search templates..."
            leftSection={<Search size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            styles={{ input: { minHeight: 44 } }}
          />

          {/* Category Tabs with Manage Button */}
          <Group gap="sm" align="stretch" wrap="nowrap">
            <SegmentedControl
              value={selectedCategory}
              onChange={setSelectedCategory}
              data={categoryData}
              size="sm"
              style={{ minHeight: 44, flex: 1, overflowX: 'auto' }}
            />
            <ActionIcon
              variant="light"
              size="xl"
              onClick={() => setCategoryModalOpen(true)}
              title="Manage Categories"
              style={{ minWidth: 44, height: 44 }}
            >
              <Settings2 size={20} />
            </ActionIcon>
          </Group>
        </Stack>

        {/* Template Grid */}
        {filteredTemplates.length > 0 ? (
          <SimpleGrid
            cols={{ base: 2, sm: 2, md: 3, lg: 4 }}
            spacing={{ base: 'xs', sm: 'sm', md: 'md' }}
            verticalSpacing={{ base: 'xs', sm: 'sm' }}
            data-tour-id="templates-grid"
          >
            {filteredTemplates.map((template) => (
              <CompactTemplateCard
                key={template.id}
                template={template}
                onEdit={
                  selectedCategory === 'custom' ? handleEdit(template.id) : undefined
                }
                onDelete={
                  selectedCategory === 'custom'
                    ? handleDelete(template.id, template.name)
                    : undefined
                }
              />
            ))}
          </SimpleGrid>
        ) : (
          /* Empty State */
          <Paper p="xl" withBorder style={{ borderStyle: 'dashed' }}>
            <Stack align="center" py={64}>
              <div
                style={{
                  borderRadius: '50%',
                  background: 'var(--mantine-color-blue-light)',
                  padding: 24,
                  marginBottom: 24,
                }}
              >
                <FileText
                  style={{
                    height: 64,
                    width: 64,
                    color: 'var(--mantine-color-blue-filled)',
                  }}
                />
              </div>
              <Title order={3}>
                {searchQuery.trim()
                  ? 'No matching templates'
                  : selectedCategory === 'custom'
                  ? 'No custom templates yet'
                  : 'No templates in this category'}
              </Title>
              <Text c="dimmed" ta="center" style={{ maxWidth: 448, marginTop: 8, marginBottom: 32 }}>
                {searchQuery.trim()
                  ? `No templates found matching "${searchQuery}". Try a different search term or clear the search.`
                  : selectedCategory === 'custom'
                  ? 'Create custom templates to extract specific information from your meetings, interviews, or reviews.'
                  : 'Try selecting a different category or create a custom template.'}
              </Text>
              <Link href="/templates/new">
                <Button variant="filled" size="lg" leftSection={<Plus size={20} />}>
                  Create Custom Template
                </Button>
              </Link>
            </Stack>
          </Paper>
        )}
      </Stack>

      {/* Category Manager Modal */}
      <CategoryManagerModal
        opened={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        templates={templates}
        userSettings={userSettings}
        onSave={handleSaveUserSettings}
        onReset={handleResetUserSettings}
      />
    </Container>
  );
}
