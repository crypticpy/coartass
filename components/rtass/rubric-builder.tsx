"use client";

import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Collapse,
  Divider,
  Group,
  NumberInput,
  Paper,
  Progress,
  Select,
  Slider,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import type {
  RtassRubricTemplate,
  RtassRubricSection,
  RtassCriterion,
  RtassCriterionType,
  RtassScoringConfig,
  RtassLlmConfig,
} from "@/types/rtass";

/**
 * Generate kebab-case ID from title
 */
function generateId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Criterion type options
 */
const criterionTypeOptions = [
  { value: "boolean", label: "Boolean (Yes/No)" },
  { value: "graded", label: "Graded (Score Range)" },
  { value: "enum", label: "Enum (Multiple Choice)" },
  { value: "timing", label: "Timing (Duration)" },
];

/**
 * Props for RubricBuilder
 */
interface RubricBuilderProps {
  initialRubric?: RtassRubricTemplate;
  onSave: (rubric: RtassRubricTemplate) => Promise<void>;
  onCancel?: () => void;
}

/**
 * Empty criterion template
 */
function createEmptyCriterion(): RtassCriterion {
  return {
    id: "",
    title: "",
    description: "",
    required: false,
    type: "boolean",
    evidenceRules: {
      minEvidence: 1,
      requireVerbatimQuote: true,
    },
  };
}

/**
 * Empty section template
 */
function createEmptySection(): RtassRubricSection {
  return {
    id: "",
    title: "",
    description: "",
    weight: 0.25,
    criteria: [createEmptyCriterion()],
  };
}

/**
 * Default rubric template
 */
function createDefaultRubric(): Omit<RtassRubricTemplate, "id" | "createdAt"> {
  return {
    name: "",
    description: "",
    version: "1.0",
    jurisdiction: "",
    tags: [],
    sections: [createEmptySection()],
    scoring: {
      method: "weighted_average",
      thresholds: {
        pass: 0.8,
        needsImprovement: 0.6,
      },
      requiredNotObservedBehavior: "exclude_with_warning",
    },
    llm: {
      concurrency: 3,
      maxRetries: 2,
      evidenceQuoteMaxChars: 200,
    },
  };
}

/**
 * Criterion Editor Component
 */
function CriterionEditor({
  criterion,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: {
  criterion: RtassCriterion;
  index: number;
  onUpdate: (criterion: RtassCriterion) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleTitleChange = (title: string) => {
    onUpdate({
      ...criterion,
      title,
      id: generateId(title),
    });
  };

  return (
    <Paper p="sm" withBorder bg="gray.0">
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </ActionIcon>
            <Text size="sm" fw={500}>
              Criterion {index + 1}
              {criterion.title && `: ${criterion.title}`}
            </Text>
            {criterion.required && (
              <Badge size="xs" color="red" variant="light">
                Required
              </Badge>
            )}
          </Group>
          {canRemove && (
            <ActionIcon color="red" variant="subtle" size="sm" onClick={onRemove}>
              <Trash2 size={14} />
            </ActionIcon>
          )}
        </Group>

        <Collapse in={isExpanded}>
          <Stack gap="sm" pt="xs">
            <Group grow align="flex-start">
              <TextInput
                label="Title"
                placeholder="e.g., Initial Size-Up Report"
                value={criterion.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                required
                size="sm"
              />
              <Select
                label="Type"
                value={criterion.type}
                onChange={(v) =>
                  onUpdate({ ...criterion, type: v as RtassCriterionType })
                }
                data={criterionTypeOptions}
                size="sm"
              />
            </Group>

            <Textarea
              label="Description"
              placeholder="Describe what this criterion evaluates..."
              value={criterion.description}
              onChange={(e) =>
                onUpdate({ ...criterion, description: e.target.value })
              }
              minRows={2}
              size="sm"
            />

            <Group grow>
              <Checkbox
                label="Required"
                description="Failure counts against overall score"
                checked={criterion.required}
                onChange={(e) =>
                  onUpdate({ ...criterion, required: e.currentTarget.checked })
                }
                size="sm"
              />
              <NumberInput
                label="Weight (optional)"
                placeholder="0.0 - 1.0"
                value={criterion.weight}
                onChange={(v) =>
                  onUpdate({ ...criterion, weight: v as number | undefined })
                }
                min={0}
                max={1}
                step={0.1}
                decimalScale={2}
                size="sm"
              />
            </Group>

            {/* Type-specific fields */}
            {criterion.type === "graded" && (
              <Group grow>
                <NumberInput
                  label="Min Score"
                  value={criterion.grading?.minScore ?? 0}
                  onChange={(v) =>
                    onUpdate({
                      ...criterion,
                      grading: { ...criterion.grading, minScore: v as number },
                    })
                  }
                  size="sm"
                />
                <NumberInput
                  label="Max Score"
                  value={criterion.grading?.maxScore ?? 10}
                  onChange={(v) =>
                    onUpdate({
                      ...criterion,
                      grading: { ...criterion.grading, maxScore: v as number },
                    })
                  }
                  size="sm"
                />
              </Group>
            )}

            {criterion.type === "enum" && (
              <TagsInput
                label="Options"
                placeholder="Add option and press Enter"
                value={criterion.enumOptions || []}
                onChange={(options) =>
                  onUpdate({ ...criterion, enumOptions: options })
                }
                size="sm"
              />
            )}

            {criterion.type === "timing" && (
              <Stack gap="xs">
                <Group grow>
                  <TextInput
                    label="Start Event"
                    placeholder="e.g., arrival_on_scene"
                    value={criterion.timing?.startEvent || ""}
                    onChange={(e) =>
                      onUpdate({
                        ...criterion,
                        timing: {
                          ...criterion.timing,
                          startEvent: e.target.value,
                          endEvent: criterion.timing?.endEvent || "",
                        },
                      })
                    }
                    size="sm"
                  />
                  <TextInput
                    label="End Event"
                    placeholder="e.g., initial_report"
                    value={criterion.timing?.endEvent || ""}
                    onChange={(e) =>
                      onUpdate({
                        ...criterion,
                        timing: {
                          ...criterion.timing,
                          startEvent: criterion.timing?.startEvent || "",
                          endEvent: e.target.value,
                        },
                      })
                    }
                    size="sm"
                  />
                </Group>
                <Group grow>
                  <NumberInput
                    label="Target (seconds)"
                    value={criterion.timing?.targetSeconds}
                    onChange={(v) =>
                      onUpdate({
                        ...criterion,
                        timing: {
                          ...criterion.timing,
                          startEvent: criterion.timing?.startEvent || "",
                          endEvent: criterion.timing?.endEvent || "",
                          targetSeconds: v as number | undefined,
                        },
                      })
                    }
                    size="sm"
                  />
                  <NumberInput
                    label="Max (seconds)"
                    value={criterion.timing?.maxSeconds}
                    onChange={(v) =>
                      onUpdate({
                        ...criterion,
                        timing: {
                          ...criterion.timing,
                          startEvent: criterion.timing?.startEvent || "",
                          endEvent: criterion.timing?.endEvent || "",
                          maxSeconds: v as number | undefined,
                        },
                      })
                    }
                    size="sm"
                  />
                </Group>
              </Stack>
            )}

            {/* Evidence rules */}
            <Group grow>
              <NumberInput
                label="Min Evidence"
                value={criterion.evidenceRules?.minEvidence ?? 1}
                onChange={(v) =>
                  onUpdate({
                    ...criterion,
                    evidenceRules: {
                      ...criterion.evidenceRules,
                      minEvidence: v as number,
                    },
                  })
                }
                min={0}
                max={10}
                size="sm"
              />
              <Checkbox
                label="Require Verbatim Quote"
                checked={criterion.evidenceRules?.requireVerbatimQuote ?? true}
                onChange={(e) =>
                  onUpdate({
                    ...criterion,
                    evidenceRules: {
                      ...criterion.evidenceRules,
                      minEvidence: criterion.evidenceRules?.minEvidence ?? 1,
                      requireVerbatimQuote: e.currentTarget.checked,
                    },
                  })
                }
                mt="xl"
                size="sm"
              />
            </Group>

            <Textarea
              label="Notes (optional)"
              placeholder="Trainer guidance or additional context..."
              value={criterion.notes || ""}
              onChange={(e) => onUpdate({ ...criterion, notes: e.target.value })}
              minRows={1}
              size="sm"
            />
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}

/**
 * Section Editor Component
 */
function SectionEditor({
  section,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: {
  section: RtassRubricSection;
  index: number;
  onUpdate: (section: RtassRubricSection) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleTitleChange = (title: string) => {
    onUpdate({
      ...section,
      title,
      id: generateId(title),
    });
  };

  const handleAddCriterion = () => {
    onUpdate({
      ...section,
      criteria: [...section.criteria, createEmptyCriterion()],
    });
  };

  const handleUpdateCriterion = (criterionIndex: number, criterion: RtassCriterion) => {
    onUpdate({
      ...section,
      criteria: section.criteria.map((c, i) =>
        i === criterionIndex ? criterion : c
      ),
    });
  };

  const handleRemoveCriterion = (criterionIndex: number) => {
    if (section.criteria.length > 1) {
      onUpdate({
        ...section,
        criteria: section.criteria.filter((_, i) => i !== criterionIndex),
      });
    }
  };

  return (
    <Card withBorder shadow="sm">
      <Stack gap="md">
        {/* Section Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="xs">
            <ActionIcon variant="subtle" color="gray" size="sm">
              <GripVertical size={14} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </ActionIcon>
            <Stack gap={2}>
              <Text fw={600}>
                Section {index + 1}
                {section.title && `: ${section.title}`}
              </Text>
              <Text size="xs" c="dimmed">
                Weight: {Math.round(section.weight * 100)}% •{" "}
                {section.criteria.length} criteria
              </Text>
            </Stack>
          </Group>
          {canRemove && (
            <ActionIcon color="red" variant="subtle" onClick={onRemove}>
              <Trash2 size={16} />
            </ActionIcon>
          )}
        </Group>

        <Collapse in={isExpanded}>
          <Stack gap="md">
            <Divider />

            {/* Section Metadata */}
            <Group grow align="flex-start">
              <TextInput
                label="Section Title"
                placeholder="e.g., Initial Arrival Communications"
                value={section.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                required
              />
              <Box>
                <Text size="sm" fw={500} mb={4}>
                  Weight
                </Text>
                <Slider
                  value={section.weight}
                  onChange={(v) => onUpdate({ ...section, weight: v })}
                  min={0}
                  max={1}
                  step={0.05}
                  marks={[
                    { value: 0.25, label: "25%" },
                    { value: 0.5, label: "50%" },
                    { value: 0.75, label: "75%" },
                  ]}
                  label={(v) => `${Math.round(v * 100)}%`}
                />
              </Box>
            </Group>

            <Textarea
              label="Description"
              placeholder="Describe what this section evaluates..."
              value={section.description}
              onChange={(e) =>
                onUpdate({ ...section, description: e.target.value })
              }
              minRows={2}
            />

            {/* Criteria */}
            <Divider label="Criteria" labelPosition="left" />
            <Stack gap="sm">
              {section.criteria.map((criterion, criterionIndex) => (
                <CriterionEditor
                  key={criterion.id || criterionIndex}
                  criterion={criterion}
                  index={criterionIndex}
                  onUpdate={(c) => handleUpdateCriterion(criterionIndex, c)}
                  onRemove={() => handleRemoveCriterion(criterionIndex)}
                  canRemove={section.criteria.length > 1}
                />
              ))}
            </Stack>

            <Button
              variant="light"
              size="sm"
              leftSection={<Plus size={14} />}
              onClick={handleAddCriterion}
            >
              Add Criterion
            </Button>
          </Stack>
        </Collapse>
      </Stack>
    </Card>
  );
}

/**
 * RubricBuilder Component
 *
 * Form-based UI for creating and editing RTASS rubric templates.
 */
export function RubricBuilder({
  initialRubric,
  onSave,
  onCancel,
}: RubricBuilderProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rubric, setRubric] = useState<Omit<RtassRubricTemplate, "id" | "createdAt">>(() =>
    initialRubric
      ? {
          name: initialRubric.name,
          description: initialRubric.description,
          version: initialRubric.version,
          jurisdiction: initialRubric.jurisdiction,
          tags: initialRubric.tags,
          sections: initialRubric.sections,
          scoring: initialRubric.scoring,
          llm: initialRubric.llm,
          updatedAt: new Date(),
        }
      : createDefaultRubric()
  );

  // Calculate total weight
  const totalWeight = useMemo(
    () => rubric.sections.reduce((sum, s) => sum + s.weight, 0),
    [rubric.sections]
  );

  const weightIsValid = Math.abs(totalWeight - 1) < 0.01;

  // Section handlers
  const handleAddSection = useCallback(() => {
    setRubric((prev) => ({
      ...prev,
      sections: [...prev.sections, createEmptySection()],
    }));
  }, []);

  const handleUpdateSection = useCallback(
    (index: number, section: RtassRubricSection) => {
      setRubric((prev) => ({
        ...prev,
        sections: prev.sections.map((s, i) => (i === index ? section : s)),
      }));
    },
    []
  );

  const handleRemoveSection = useCallback((index: number) => {
    setRubric((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
  }, []);

  // Scoring config handlers
  const handleScoringChange = useCallback((scoring: RtassScoringConfig) => {
    setRubric((prev) => ({ ...prev, scoring }));
  }, []);

  // LLM config handlers
  const handleLlmChange = useCallback((llm: RtassLlmConfig) => {
    setRubric((prev) => ({ ...prev, llm }));
  }, []);

  // Validation
  const validate = (): boolean => {
    if (!rubric.name.trim()) {
      notifications.show({
        title: "Validation Error",
        message: "Rubric name is required",
        color: "red",
      });
      return false;
    }

    if (!rubric.description.trim()) {
      notifications.show({
        title: "Validation Error",
        message: "Rubric description is required",
        color: "red",
      });
      return false;
    }

    if (!weightIsValid) {
      notifications.show({
        title: "Validation Error",
        message: "Section weights must sum to 100%",
        color: "red",
      });
      return false;
    }

    for (let i = 0; i < rubric.sections.length; i++) {
      const section = rubric.sections[i];
      if (!section.title.trim()) {
        notifications.show({
          title: "Validation Error",
          message: `Section ${i + 1} title is required`,
          color: "red",
        });
        return false;
      }

      for (let j = 0; j < section.criteria.length; j++) {
        const criterion = section.criteria[j];
        if (!criterion.title.trim()) {
          notifications.show({
            title: "Validation Error",
            message: `Criterion ${j + 1} in section "${section.title}" needs a title`,
            color: "red",
          });
          return false;
        }
      }
    }

    return true;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const fullRubric: RtassRubricTemplate = {
        id: initialRubric?.id || crypto.randomUUID(),
        createdAt: initialRubric?.createdAt || new Date(),
        ...rubric,
        updatedAt: initialRubric ? new Date() : undefined,
      };

      await onSave(fullRubric);

      notifications.show({
        title: "Success",
        message: initialRubric
          ? "Rubric updated successfully"
          : "Rubric created successfully",
        color: "green",
      });
    } catch (error) {
      console.error("Error saving rubric:", error);
      notifications.show({
        title: "Error",
        message:
          error instanceof Error ? error.message : "Failed to save rubric",
        color: "red",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="xl">
        {/* Metadata Section */}
        <Paper p="xl" withBorder>
          <Stack gap="md">
            <Title order={3} size="h4">
              Rubric Information
            </Title>

            <Group grow align="flex-start">
              <TextInput
                label="Name"
                placeholder="e.g., AFD A1016 Radio Compliance"
                value={rubric.name}
                onChange={(e) =>
                  setRubric((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
              <TextInput
                label="Version"
                placeholder="e.g., 1.0"
                value={rubric.version}
                onChange={(e) =>
                  setRubric((prev) => ({ ...prev, version: e.target.value }))
                }
                required
              />
            </Group>

            <Textarea
              label="Description"
              placeholder="Describe the purpose and scope of this rubric..."
              value={rubric.description}
              onChange={(e) =>
                setRubric((prev) => ({ ...prev, description: e.target.value }))
              }
              required
              minRows={3}
            />

            <Group grow>
              <TextInput
                label="Jurisdiction (optional)"
                placeholder="e.g., Austin Fire Department"
                value={rubric.jurisdiction || ""}
                onChange={(e) =>
                  setRubric((prev) => ({
                    ...prev,
                    jurisdiction: e.target.value,
                  }))
                }
              />
              <TagsInput
                label="Tags (optional)"
                placeholder="Add tag and press Enter"
                value={rubric.tags || []}
                onChange={(tags) =>
                  setRubric((prev) => ({ ...prev, tags }))
                }
              />
            </Group>
          </Stack>
        </Paper>

        {/* Weight Summary */}
        <Paper p="md" withBorder>
          <Group justify="space-between" align="center">
            <Text fw={500}>Section Weights</Text>
            <Group gap="sm">
              <Progress
                value={totalWeight * 100}
                color={weightIsValid ? "green" : totalWeight > 1 ? "red" : "yellow"}
                size="xl"
                w={200}
              />
              <Badge
                color={weightIsValid ? "green" : totalWeight > 1 ? "red" : "yellow"}
                variant="light"
                size="lg"
              >
                {Math.round(totalWeight * 100)}%
              </Badge>
            </Group>
          </Group>
          {!weightIsValid && (
            <Alert color="yellow" mt="sm" icon={<AlertCircle size={16} />}>
              Section weights should sum to 100%
            </Alert>
          )}
        </Paper>

        {/* Sections */}
        <Paper p="xl" withBorder>
          <Stack gap="lg">
            <Group justify="space-between">
              <Title order={3} size="h4">
                Sections
              </Title>
              <Button
                variant="light"
                leftSection={<Plus size={16} />}
                onClick={handleAddSection}
              >
                Add Section
              </Button>
            </Group>

            {rubric.sections.map((section, index) => (
              <SectionEditor
                key={section.id || index}
                section={section}
                index={index}
                onUpdate={(s) => handleUpdateSection(index, s)}
                onRemove={() => handleRemoveSection(index)}
                canRemove={rubric.sections.length > 1}
              />
            ))}
          </Stack>
        </Paper>

        {/* Scoring Config */}
        <Paper p="xl" withBorder>
          <Stack gap="md">
            <Title order={3} size="h4">
              Scoring Configuration
            </Title>

            <Group grow>
              <Box>
                <Text size="sm" fw={500} mb={4}>
                  Pass Threshold
                </Text>
                <Slider
                  value={rubric.scoring.thresholds.pass}
                  onChange={(v) =>
                    handleScoringChange({
                      ...rubric.scoring,
                      thresholds: { ...rubric.scoring.thresholds, pass: v },
                    })
                  }
                  min={0}
                  max={1}
                  step={0.05}
                  marks={[
                    { value: 0.7, label: "70%" },
                    { value: 0.8, label: "80%" },
                    { value: 0.9, label: "90%" },
                  ]}
                  label={(v) => `${Math.round(v * 100)}%`}
                />
              </Box>
              <Box>
                <Text size="sm" fw={500} mb={4}>
                  Needs Improvement Threshold
                </Text>
                <Slider
                  value={rubric.scoring.thresholds.needsImprovement}
                  onChange={(v) =>
                    handleScoringChange({
                      ...rubric.scoring,
                      thresholds: {
                        ...rubric.scoring.thresholds,
                        needsImprovement: v,
                      },
                    })
                  }
                  min={0}
                  max={1}
                  step={0.05}
                  marks={[
                    { value: 0.5, label: "50%" },
                    { value: 0.6, label: "60%" },
                    { value: 0.7, label: "70%" },
                  ]}
                  label={(v) => `${Math.round(v * 100)}%`}
                />
              </Box>
            </Group>

            <Select
              label="Required Not Observed Behavior"
              value={rubric.scoring.requiredNotObservedBehavior}
              onChange={(v) =>
                handleScoringChange({
                  ...rubric.scoring,
                  requiredNotObservedBehavior: v as
                    | "treat_as_missed"
                    | "exclude_with_warning",
                })
              }
              data={[
                { value: "treat_as_missed", label: "Treat as Missed" },
                { value: "exclude_with_warning", label: "Exclude with Warning" },
              ]}
            />
          </Stack>
        </Paper>

        {/* LLM Config */}
        <Paper p="xl" withBorder>
          <Stack gap="md">
            <Title order={3} size="h4">
              LLM Configuration
            </Title>

            <Group grow>
              <NumberInput
                label="Concurrency"
                description="Parallel API calls (1-10)"
                value={rubric.llm.concurrency}
                onChange={(v) =>
                  handleLlmChange({ ...rubric.llm, concurrency: v as number })
                }
                min={1}
                max={10}
              />
              <NumberInput
                label="Max Retries"
                description="Retry attempts on failure (0-5)"
                value={rubric.llm.maxRetries}
                onChange={(v) =>
                  handleLlmChange({ ...rubric.llm, maxRetries: v as number })
                }
                min={0}
                max={5}
              />
              <NumberInput
                label="Evidence Quote Max Chars"
                description="Max characters per quote (40-600)"
                value={rubric.llm.evidenceQuoteMaxChars}
                onChange={(v) =>
                  handleLlmChange({
                    ...rubric.llm,
                    evidenceQuoteMaxChars: v as number,
                  })
                }
                min={40}
                max={600}
              />
            </Group>
          </Stack>
        </Paper>

        {/* Actions */}
        <Divider />
        <Group justify="flex-end">
          {onCancel && (
            <Button variant="subtle" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="filled"
            leftSection={<Save size={16} />}
            loading={isSubmitting}
          >
            {initialRubric ? "Update Rubric" : "Create Rubric"}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export default RubricBuilder;
