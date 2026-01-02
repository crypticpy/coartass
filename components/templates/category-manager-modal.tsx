"use client";

import * as React from "react";
import {
  Modal,
  TextInput,
  Button,
  Stack,
  Group,
  Badge,
  ActionIcon,
  Text,
  Alert,
  Select,
  Divider,
  Paper,
  ScrollArea,
} from "@mantine/core";
import { Plus, Trash2, AlertCircle, RotateCcw } from "lucide-react";
import { modals } from "@mantine/modals";
import type { Template } from "@/types/template";
import type { UserCategorySettings } from "@/lib/user-categories";
import { TEMPLATE_CATEGORIES } from "@/lib/template-categories";

interface CategoryManagerModalProps {
  opened: boolean;
  onClose: () => void;
  templates: Template[];
  userSettings: UserCategorySettings;
  onSave: (settings: UserCategorySettings) => void;
  onReset: () => void;
}

/**
 * Category Manager Modal
 *
 * Allows users to:
 * - Create custom template categories
 * - Delete custom categories
 * - Assign templates to categories
 * - Reset to default categories
 */
export function CategoryManagerModal({
  opened,
  onClose,
  templates,
  userSettings,
  onSave,
  onReset,
}: CategoryManagerModalProps) {
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [localSettings, setLocalSettings] = React.useState<UserCategorySettings>(userSettings);
  const [error, setError] = React.useState<string | null>(null);

  // Sync local settings with prop changes
  React.useEffect(() => {
    setLocalSettings(userSettings);
  }, [userSettings]);

  // Get all available category options (default + custom)
  const defaultCategories = Object.keys(TEMPLATE_CATEGORIES);
  const allCategories = [...defaultCategories, ...localSettings.customCategories];

  /**
   * Get count of templates assigned to a specific category
   */
  const getTemplateCountForCategory = React.useCallback(
    (categoryName: string): number => {
      return Object.values(localSettings.templateAssignments).filter(
        (cat) => cat === categoryName
      ).length;
    },
    [localSettings.templateAssignments]
  );

  /**
   * Handle adding a new custom category
   */
  const handleAddCategory = React.useCallback(() => {
    const trimmedName = newCategoryName.trim();

    // Validation
    if (!trimmedName) {
      setError("Category name cannot be empty");
      return;
    }

    // Check for duplicates (case-insensitive)
    const lowerName = trimmedName.toLowerCase();
    const allExisting = [...defaultCategories, ...localSettings.customCategories];
    if (allExisting.some((cat) => cat.toLowerCase() === lowerName)) {
      setError("A category with this name already exists");
      return;
    }

    // Add the category
    setLocalSettings((prev) => ({
      ...prev,
      customCategories: [...prev.customCategories, trimmedName],
    }));

    setNewCategoryName("");
    setError(null);
  }, [newCategoryName, localSettings.customCategories, defaultCategories]);

  /**
   * Handle deleting a custom category
   */
  const handleDeleteCategory = React.useCallback((categoryName: string) => {
    setLocalSettings((prev) => {
      // Remove the category
      const updatedCategories = prev.customCategories.filter(
        (cat) => cat !== categoryName
      );

      // Remove all template assignments to this category
      const updatedAssignments = { ...prev.templateAssignments };
      Object.keys(updatedAssignments).forEach((templateId) => {
        if (updatedAssignments[templateId] === categoryName) {
          delete updatedAssignments[templateId];
        }
      });

      return {
        customCategories: updatedCategories,
        templateAssignments: updatedAssignments,
      };
    });
  }, []);

  /**
   * Handle changing template category assignment
   */
  const handleTemplateAssignment = React.useCallback(
    (templateId: string, category: string | null) => {
      setLocalSettings((prev) => {
        const updatedAssignments = { ...prev.templateAssignments };

        if (!category || category === "default") {
          // Remove assignment (fall back to default)
          delete updatedAssignments[templateId];
        } else {
          // Assign to category
          updatedAssignments[templateId] = category;
        }

        return {
          ...prev,
          templateAssignments: updatedAssignments,
        };
      });
    },
    []
  );

  /**
   * Handle save button click
   */
  const handleSave = React.useCallback(() => {
    onSave(localSettings);
    onClose();
  }, [localSettings, onSave, onClose]);

  /**
   * Handle reset to defaults with confirmation
   */
  const handleResetWithConfirmation = React.useCallback(() => {
    modals.openConfirmModal({
      title: "Reset to Default Categories?",
      centered: true,
      children: (
        <Text size="sm">
          This will remove all custom categories and template assignments,
          reverting to the default category system. This action cannot be undone.
        </Text>
      ),
      labels: { confirm: "Reset to Defaults", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        onReset();
        onClose();
      },
    });
  }, [onReset, onClose]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Manage Template Categories"
      size="lg"
      padding="xl"
      styles={{
        body: { maxHeight: "80vh" },
      }}
    >
      <Stack gap="xl">
        <Text size="sm" c="dimmed">
          Create custom categories and organize your templates.
        </Text>

        {/* Create Category Section */}
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Create New Category
          </Text>
          <Group gap="xs" align="flex-start" wrap="nowrap">
            <TextInput
              value={newCategoryName}
              onChange={(e) => {
                setNewCategoryName(e.currentTarget.value);
                setError(null);
              }}
              placeholder="Category name..."
              style={{ flex: 1 }}
              error={error}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddCategory();
                }
              }}
            />
            <Button
              leftSection={<Plus size={16} />}
              onClick={handleAddCategory}
              variant="light"
            >
              Add
            </Button>
          </Group>
        </Stack>

        <Divider />

        {/* Existing Categories List */}
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Custom Categories ({localSettings.customCategories.length})
          </Text>
          {localSettings.customCategories.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No custom categories yet. Create one above to get started.
            </Text>
          ) : (
            <Stack gap="xs">
              {localSettings.customCategories.map((category) => (
                <Paper key={category} p="sm" withBorder>
                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {category}
                      </Text>
                      <Badge variant="outline" size="sm" color="gray">
                        {getTemplateCountForCategory(category)}{" "}
                        {getTemplateCountForCategory(category) === 1
                          ? "template"
                          : "templates"}
                      </Badge>
                    </Group>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDeleteCategory(category)}
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>

        <Divider />

        {/* Template Assignment Section */}
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Template Assignments ({templates.length} templates)
          </Text>
          <ScrollArea style={{ maxHeight: 300 }} type="auto">
            <Stack gap="xs">
              {templates.map((template) => {
                const currentAssignment =
                  localSettings.templateAssignments[template.id];
                const selectValue = currentAssignment || "default";

                return (
                  <Group key={template.id} gap="xs" align="center" wrap="nowrap">
                    <Text
                      size="sm"
                      style={{ flex: 1, minWidth: 0 }}
                      truncate
                      title={template.name}
                    >
                      {template.name}
                    </Text>
                    <Select
                      value={selectValue}
                      onChange={(value) =>
                        handleTemplateAssignment(template.id, value)
                      }
                      data={[
                        { value: "default", label: "Default" },
                        ...allCategories.map((cat) => ({
                          value: cat,
                          label:
                            cat.charAt(0).toUpperCase() + cat.slice(1),
                        })),
                      ]}
                      size="xs"
                      style={{ minWidth: 150 }}
                      comboboxProps={{ withinPortal: true }}
                    />
                  </Group>
                );
              })}
            </Stack>
          </ScrollArea>
        </Stack>

        {/* Info Alert */}
        <Alert icon={<AlertCircle size={16} />} color="blue" variant="light">
          <Text size="sm">
            Templates assigned to &quot;Default&quot; will appear in the Review
            category. Create custom categories to organize templates your way.
          </Text>
        </Alert>

        {/* Actions */}
        <Group justify="space-between" mt="md">
          <Button
            variant="subtle"
            color="red"
            leftSection={<RotateCcw size={16} />}
            onClick={handleResetWithConfirmation}
          >
            Reset to Defaults
          </Button>
          <Group gap="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
