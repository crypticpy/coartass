"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Container,
  Button,
  TextInput,
  Textarea,
  Select,
  Stack,
  Group,
  Paper,
  Divider,
  Title,
  Text,
  Checkbox,
  ActionIcon,
} from "@mantine/core";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { notifications } from "@mantine/notifications";
import { saveTemplate } from "@/lib/db";
import type { Template, TemplateCategory, TemplateSection } from "@/types/template";

// Icon options for template selection
const iconOptions = [
  { value: "FileText", label: "Document" },
  { value: "Users", label: "People" },
  { value: "ClipboardCheck", label: "Checklist" },
  { value: "Settings", label: "Settings" },
  { value: "Briefcase", label: "Business" },
  { value: "Calendar", label: "Calendar" },
  { value: "MessageSquare", label: "Chat" },
  { value: "Target", label: "Target" },
];

// Category options
const categoryOptions: { value: TemplateCategory; label: string }[] = [
  { value: "meeting", label: "Meeting" },
  { value: "interview", label: "Interview" },
  { value: "review", label: "Review" },
  { value: "custom", label: "Custom" },
];

// Output format options for sections
const outputFormatOptions = [
  { value: "bullet_points", label: "Bullet Points" },
  { value: "paragraph", label: "Paragraph" },
  { value: "table", label: "Table" },
];

/**
 * New Template Page
 *
 * Form for creating custom analysis templates
 */
export default function NewTemplatePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [icon, setIcon] = React.useState("Settings");
  const [category, setCategory] = React.useState<TemplateCategory>("custom");
  const [sections, setSections] = React.useState<TemplateSection[]>([
    {
      id: crypto.randomUUID(),
      name: "",
      prompt: "",
      extractEvidence: true,
      outputFormat: "bullet_points",
    },
  ]);
  const [outputs, setOutputs] = React.useState<string[]>([]);

  // Add a new section
  const handleAddSection = () => {
    setSections([
      ...sections,
      {
        id: crypto.randomUUID(),
        name: "",
        prompt: "",
        extractEvidence: true,
        outputFormat: "bullet_points",
      },
    ]);
  };

  // Remove a section
  const handleRemoveSection = (index: number) => {
    if (sections.length > 1) {
      setSections(sections.filter((_, i) => i !== index));
    }
  };

  // Update section field
  const handleUpdateSection = (
    index: number,
    field: keyof TemplateSection,
    value: string | boolean | null
  ) => {
    if (value === null) return;
    setSections(
      sections.map((section, i) =>
        i === index ? { ...section, [field]: value } : section
      )
    );
  };

  // Toggle output option
  const handleToggleOutput = (output: string) => {
    setOutputs((prev) =>
      prev.includes(output)
        ? prev.filter((o) => o !== output)
        : [...prev, output]
    );
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!name.trim()) {
      notifications.show({
        title: "Validation Error",
        message: "Template name is required",
        color: "red",
      });
      return false;
    }

    if (!description.trim()) {
      notifications.show({
        title: "Validation Error",
        message: "Template description is required",
        color: "red",
      });
      return false;
    }

    if (sections.length === 0) {
      notifications.show({
        title: "Validation Error",
        message: "At least one section is required",
        color: "red",
      });
      return false;
    }

    for (let i = 0; i < sections.length; i++) {
      if (!sections[i].name.trim()) {
        notifications.show({
          title: "Validation Error",
          message: `Section ${i + 1} name is required`,
          color: "red",
        });
        return false;
      }
      if (!sections[i].prompt.trim()) {
        notifications.show({
          title: "Validation Error",
          message: `Section ${i + 1} prompt is required`,
          color: "red",
        });
        return false;
      }
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const template: Template = {
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description.trim(),
        icon,
        category,
        sections,
        outputs: outputs as Template['outputs'],
        isCustom: true,
        createdAt: new Date(),
      };

      await saveTemplate(template);

      notifications.show({
        title: "Success",
        message: "Template created successfully",
        color: "green",
      });

      router.push("/templates");
    } catch (error) {
      console.error("Error creating template:", error);
      notifications.show({
        title: "Error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create template",
        color: "red",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container size="lg" py={{ base: 'md', md: 'xl' }}>
      <form onSubmit={handleSubmit}>
        <Stack gap="xl">
          {/* Header */}
          <Group justify="space-between" align="center">
            <Link href="/templates">
              <Button
                variant="subtle"
                leftSection={<ArrowLeft size={16} />}
                disabled={isSubmitting}
              >
                Back to Templates
              </Button>
            </Link>

            <Group gap="xs">
              <Button
                type="submit"
                variant="filled"
                leftSection={<Save size={16} />}
                loading={isSubmitting}
              >
                Save Template
              </Button>
            </Group>
          </Group>

          {/* Page Title */}
          <div>
            <Title order={1}>Create Custom Template</Title>
            <Text c="dimmed" size="sm" mt="xs">
              Create a custom analysis template tailored to your specific needs
            </Text>
          </div>

          {/* Basic Information */}
          <Paper p="xl" withBorder>
            <Stack gap="md">
              <Title order={3} size="h4">
                Basic Information
              </Title>

              <TextInput
                label="Template Name"
                placeholder="e.g., Product Review Meeting"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                description="A descriptive name for your template"
              />

              <Textarea
                label="Description"
                placeholder="Describe what this template is used for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minRows={3}
                description="Explain the purpose and use case of this template"
              />

              <Group grow>
                <Select
                  label="Icon"
                  value={icon}
                  onChange={(value) => setIcon(value || "Settings")}
                  data={iconOptions}
                  description="Visual identifier for your template"
                />

                <Select
                  label="Category"
                  value={category}
                  onChange={(value) =>
                    setCategory((value as TemplateCategory) || "custom")
                  }
                  data={categoryOptions}
                  description="Template category"
                />
              </Group>
            </Stack>
          </Paper>

          {/* Analysis Sections */}
          <Paper p="xl" withBorder data-tour-id="template-sections">
            <Stack gap="lg">
              <Group justify="space-between">
                <div>
                  <Title order={3} size="h4">
                    Analysis Sections
                  </Title>
                  <Text c="dimmed" size="sm" mt={4}>
                    Define the sections that will be generated in the analysis
                  </Text>
                </div>
                <Button
                  variant="light"
                  leftSection={<Plus size={16} />}
                  onClick={handleAddSection}
                  disabled={isSubmitting}
                >
                  Add Section
                </Button>
              </Group>

              {sections.map((section, index) => (
                <Paper key={section.id} p="md" withBorder>
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Text fw={600} size="sm">
                        Section {index + 1}
                      </Text>
                      {sections.length > 1 && (
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => handleRemoveSection(index)}
                          disabled={isSubmitting}
                          aria-label="Remove section"
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      )}
                    </Group>

                    <TextInput
                      label="Section Name"
                      placeholder="e.g., Key Discussions"
                      value={section.name}
                      onChange={(e) =>
                        handleUpdateSection(index, "name", e.target.value)
                      }
                      required
                    />

                    <Textarea
                      label="Analysis Prompt"
                      placeholder="What should the AI analyze for this section?"
                      value={section.prompt}
                      onChange={(e) =>
                        handleUpdateSection(index, "prompt", e.target.value)
                      }
                      required
                      minRows={3}
                      description="Describe what information the AI should extract"
                    />

                    <Group grow>
                      <Select
                        label="Output Format"
                        value={section.outputFormat}
                        onChange={(value) =>
                          handleUpdateSection(index, "outputFormat", value)
                        }
                        data={outputFormatOptions}
                      />

                      <Checkbox
                        label="Extract Evidence"
                        description="Include supporting quotes from transcript"
                        checked={section.extractEvidence}
                        onChange={(e) =>
                          handleUpdateSection(
                            index,
                            "extractEvidence",
                            e.currentTarget.checked
                          )
                        }
                        mt="xl"
                      />
                    </Group>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>

          {/* Additional Outputs */}
          <Paper p="xl" withBorder>
            <Stack gap="md">
              <Title order={3} size="h4">
                Additional Outputs
              </Title>
              <Text c="dimmed" size="sm">
                Select additional analysis outputs to generate
              </Text>

              <Stack gap="xs">
                <Checkbox
                  label="Executive Summary"
                  description="Generate a high-level overview of the transcript"
                  checked={outputs.includes("summary")}
                  onChange={() => handleToggleOutput("summary")}
                />
                <Checkbox
                  label="Action Items"
                  description="Extract tasks and action items"
                  checked={outputs.includes("action_items")}
                  onChange={() => handleToggleOutput("action_items")}
                />
                <Checkbox
                  label="Key Decisions"
                  description="Identify important decisions made"
                  checked={outputs.includes("decisions")}
                  onChange={() => handleToggleOutput("decisions")}
                />
                <Checkbox
                  label="Notable Quotes"
                  description="Extract memorable or important quotes"
                  checked={outputs.includes("quotes")}
                  onChange={() => handleToggleOutput("quotes")}
                />
              </Stack>
            </Stack>
          </Paper>

          {/* Submit Actions */}
          <Divider />
          <Group justify="flex-end">
            <Link href="/templates">
              <Button variant="subtle" disabled={isSubmitting}>
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="filled"
              leftSection={<Save size={16} />}
              loading={isSubmitting}
              data-tour-id="save-template-button"
            >
              Save Template
            </Button>
          </Group>
        </Stack>
      </form>
    </Container>
  );
}
