"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Alert,
  Button,
  Group,
  Loader,
  MultiSelect,
  Paper,
  Progress,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { AlertCircle, Ban, Sparkles, Trash2 } from "lucide-react";
import { notifications } from "@mantine/notifications";
import {
  deleteRtassScorecard,
  getRtassScorecardsByTranscript,
  saveRtassScorecard,
} from "@/lib/db";
import {
  useAllRtassRubrics,
  type RubricWithSource,
} from "@/hooks/use-rtass-rubrics";
import { useSupplementalDocsPersistent } from "@/hooks/use-supplemental-docs-persistent";
import type { Transcript } from "@/types/transcript";
import type {
  RtassRubricTemplate,
  RtassScorecard,
  RtassScorecardSection,
} from "@/types/rtass";
import { ScorecardViewer } from "./scorecard-viewer";
import { ScorecardCompare } from "./scorecard-compare";

type SectionScoreResponse = {
  section: RtassScorecardSection;
  warnings?: string[];
  modelInfo: RtassScorecard["modelInfo"];
};

function normalizeRubricDates(
  rubric: RtassRubricTemplate,
): RtassRubricTemplate {
  return {
    ...rubric,
    createdAt:
      rubric.createdAt instanceof Date
        ? rubric.createdAt
        : new Date(rubric.createdAt),
    updatedAt:
      rubric.updatedAt instanceof Date
        ? rubric.updatedAt
        : rubric.updatedAt
          ? new Date(rubric.updatedAt)
          : undefined,
  };
}

function normalizeScorecardDates(scorecard: RtassScorecard): RtassScorecard {
  const createdAt =
    scorecard.createdAt instanceof Date
      ? scorecard.createdAt
      : new Date(scorecard.createdAt);
  const reviewedAt =
    scorecard.humanReview?.reviewedAt instanceof Date
      ? scorecard.humanReview.reviewedAt
      : scorecard.humanReview?.reviewedAt
        ? new Date(scorecard.humanReview.reviewedAt)
        : undefined;

  return {
    ...scorecard,
    createdAt,
    humanReview: scorecard.humanReview
      ? { ...scorecard.humanReview, reviewedAt }
      : scorecard.humanReview,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function statusFromScore(
  score: number,
  rubric: RtassRubricTemplate,
): RtassScorecard["overall"]["status"] {
  if (score >= rubric.scoring.thresholds.pass) return "pass";
  if (score >= rubric.scoring.thresholds.needsImprovement)
    return "needs_improvement";
  return "fail";
}

async function scoreSection(params: {
  transcript: Transcript;
  rubric: RtassRubricTemplate;
  sectionId: string;
  signal: AbortSignal;
  supplementalMaterial?: string;
}): Promise<SectionScoreResponse> {
  const { transcript, rubric, sectionId, signal, supplementalMaterial } =
    params;

  const res = await fetch("/api/rtass/score/section", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      transcriptId: transcript.id,
      transcript: { text: transcript.text, segments: transcript.segments },
      rubric,
      sectionId,
      supplementalMaterial,
    }),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || "Failed to score rubric section");
  }

  return payload.data as SectionScoreResponse;
}

export function ScorecardRunner({
  transcript,
  onTimestampClick,
}: {
  transcript: Transcript;
  onTimestampClick?: (seconds: number) => void;
}) {
  const {
    rubrics: allRubrics,
    customRubrics,
    isLoading: isLoadingRubrics,
    error: rubricsError,
  } = useAllRtassRubrics();
  const persistentDocs = useSupplementalDocsPersistent(transcript.id);
  const [selectedRubricIds, setSelectedRubricIds] = React.useState<string[]>(
    [],
  );
  const [isRunning, setIsRunning] = React.useState(false);
  const [activeScorecardId, setActiveScorecardId] = React.useState<
    string | null
  >(null);
  const [compareScorecardId, setCompareScorecardId] = React.useState<
    string | null
  >(null);
  const [activeRubric, setActiveRubric] = React.useState<
    RtassRubricTemplate | undefined
  >(undefined);
  const abortRef = React.useRef<AbortController | null>(null);

  const [runProgress, setRunProgress] = React.useState<{
    totalSections: number;
    completedSections: number;
    label?: string;
  } | null>(null);

  const scorecards = useLiveQuery<RtassScorecard[]>(async () => {
    const stored = await getRtassScorecardsByTranscript(transcript.id);
    return stored.map(normalizeScorecardDates);
  }, [transcript.id]);

  const activeScorecard = React.useMemo(() => {
    if (!scorecards || scorecards.length === 0) return null;
    if (activeScorecardId) {
      return (
        scorecards.find((s) => s.id === activeScorecardId) ?? scorecards[0]
      );
    }
    return scorecards[0];
  }, [scorecards, activeScorecardId]);

  React.useEffect(() => {
    if (selectedRubricIds.length > 0) return;
    const defaultRubricId =
      allRubrics.find((r) => r.id === "rtass-afd-a1016-radio-compliance")?.id ??
      allRubrics[0]?.id;
    if (defaultRubricId) {
      setSelectedRubricIds([defaultRubricId]);
    }
  }, [allRubrics, selectedRubricIds.length]);

  React.useEffect(() => {
    if (!activeScorecard) {
      setActiveRubric(undefined);
      return;
    }

    const rubricId = activeScorecard.rubricTemplateId;
    const custom = customRubrics.find((r) => r.id === rubricId);
    if (custom) {
      setActiveRubric(custom);
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/rtass/rubrics?id=${encodeURIComponent(rubricId)}`,
          {
            signal: controller.signal,
          },
        );
        const payload = await res.json();
        if (!res.ok) return;
        setActiveRubric(
          normalizeRubricDates(payload.data as RtassRubricTemplate),
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    })();

    return () => {
      controller.abort();
    };
  }, [activeScorecard, customRubrics]);

  const cancelRun = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRunning(false);
    setRunProgress(null);
    notifications.show({
      title: "Cancelled",
      message: "Stopped scorecard generation.",
      color: "yellow",
    });
  }, []);

  const resolveRubricTemplate = React.useCallback(
    async (rubric: RubricWithSource): Promise<RtassRubricTemplate> => {
      if (!rubric.isBuiltIn) {
        return rubric;
      }

      const res = await fetch(
        `/api/rtass/rubrics?id=${encodeURIComponent(rubric.id)}`,
      );
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load rubric");
      }
      return normalizeRubricDates(payload.data as RtassRubricTemplate);
    },
    [],
  );

  const runScorecards = async () => {
    if (selectedRubricIds.length === 0) return;
    if (!transcript.text || transcript.segments.length === 0) return;

    const selectedRubrics = selectedRubricIds
      .map((id) => allRubrics.find((r) => r.id === id))
      .filter(Boolean) as RubricWithSource[];

    if (selectedRubrics.length === 0) return;

    setIsRunning(true);
    try {
      // Get supplemental material from persistent docs
      const supplementalMaterial = await persistentDocs.getFormattedContent();

      const rubricTemplates = await Promise.all(
        selectedRubrics.map(resolveRubricTemplate),
      );
      const totalSections = rubricTemplates.reduce(
        (sum, r) => sum + r.sections.length,
        0,
      );

      const controller = new AbortController();
      abortRef.current = controller;
      setRunProgress({ totalSections, completedSections: 0 });

      let lastScorecardId: string | null = null;

      for (const rubric of rubricTemplates) {
        const concurrency = Math.max(1, Math.min(10, rubric.llm.concurrency));
        const sectionOrder = new Map(
          rubric.sections.map((s, idx) => [s.id, idx]),
        );

        const sectionResults: RtassScorecardSection[] = [];
        const warnings: string[] = [];
        let modelInfo: RtassScorecard["modelInfo"] | undefined;

        for (let i = 0; i < rubric.sections.length; i += concurrency) {
          const batch = rubric.sections.slice(i, i + concurrency);
          const results = await Promise.all(
            batch.map(async (section) => {
              const label = `${rubric.name}: ${section.title}`;
              setRunProgress((prev) => (prev ? { ...prev, label } : prev));
              const result = await scoreSection({
                transcript,
                rubric,
                sectionId: section.id,
                signal: controller.signal,
                supplementalMaterial: supplementalMaterial || undefined,
              });

              modelInfo = modelInfo ?? result.modelInfo;
              if (result.warnings) warnings.push(...result.warnings);
              sectionResults.push(result.section);

              setRunProgress((prev) =>
                prev
                  ? { ...prev, completedSections: prev.completedSections + 1 }
                  : prev,
              );
              return result.section;
            }),
          );

          // Preserve section ordering regardless of concurrency completion order
          results.sort(
            (a, b) =>
              (sectionOrder.get(a.sectionId) ?? 0) -
              (sectionOrder.get(b.sectionId) ?? 0),
          );
        }

        sectionResults.sort(
          (a, b) =>
            (sectionOrder.get(a.sectionId) ?? 0) -
            (sectionOrder.get(b.sectionId) ?? 0),
        );

        const overallNumerator = sectionResults.reduce(
          (sum, s) => sum + s.weight * s.score,
          0,
        );
        const overallDenominator = sectionResults.reduce(
          (sum, s) => sum + s.weight,
          0,
        );
        const overallScore =
          overallDenominator > 0
            ? clamp01(overallNumerator / overallDenominator)
            : 0;

        const scorecard: RtassScorecard = {
          id: crypto.randomUUID(),
          incidentId: transcript.id,
          transcriptId: transcript.id,
          rubricTemplateId: rubric.id,
          createdAt: new Date(),
          modelInfo: modelInfo ?? { provider: "openai", model: "unknown" },
          overall: {
            score: overallScore,
            status: statusFromScore(overallScore, rubric),
          },
          sections: sectionResults,
          warnings:
            warnings.length > 0 ? Array.from(new Set(warnings)) : undefined,
          humanReview: { reviewed: false },
        };

        await saveRtassScorecard(scorecard);
        lastScorecardId = scorecard.id;
      }

      setActiveScorecardId(lastScorecardId);

      notifications.show({
        title: "Scorecards generated",
        message: `${rubricTemplates.length} scorecard${rubricTemplates.length === 1 ? "" : "s"} saved to this browser.`,
        color: "green",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      notifications.show({
        title: "Scorecard failed",
        message: error instanceof Error ? error.message : String(error),
        color: "red",
      });
    } finally {
      abortRef.current = null;
      setIsRunning(false);
      setRunProgress(null);
    }
  };

  const deleteScorecard = async () => {
    if (!activeScorecard) return;
    try {
      await deleteRtassScorecard(activeScorecard.id);
      setActiveScorecardId(null);
      setCompareScorecardId(null);
      notifications.show({
        title: "Scorecard deleted",
        message: "Removed from this browser.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Delete failed",
        message: error instanceof Error ? error.message : String(error),
        color: "red",
      });
    }
  };

  const rubricNameById = React.useMemo(() => {
    return new Map(allRubrics.map((r) => [r.id, r.name]));
  }, [allRubrics]);

  const compareScorecard = React.useMemo(() => {
    if (!scorecards || !compareScorecardId) return null;
    return scorecards.find((s) => s.id === compareScorecardId) ?? null;
  }, [scorecards, compareScorecardId]);

  const progressValue =
    runProgress && runProgress.totalSections > 0
      ? (runProgress.completedSections / runProgress.totalSections) * 100
      : 0;

  return (
    <Stack gap="lg">
      <Paper p="lg" radius="md" withBorder>
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={4}>
            <Title order={2} size="h3">
              Scorecard (RTASS)
            </Title>
            <Text size="sm" c="dimmed">
              Run a rubric-based evaluation and generate an evidence-linked
              scorecard.
            </Text>
          </Stack>

          <Group gap="sm">
            <Button
              leftSection={
                isRunning ? <Loader size={16} /> : <Sparkles size={16} />
              }
              onClick={runScorecards}
              loading={isRunning}
              disabled={isLoadingRubrics || selectedRubricIds.length === 0}
              styles={{ root: { minHeight: 44 } }}
            >
              Generate Scorecard{selectedRubricIds.length > 1 ? "s" : ""}
            </Button>
            {isRunning && (
              <Button
                variant="default"
                color="gray"
                leftSection={<Ban size={16} />}
                onClick={cancelRun}
                styles={{ root: { minHeight: 44 } }}
              >
                Cancel
              </Button>
            )}
          </Group>
        </Group>

        <Stack gap="md" mt="md">
          {rubricsError && (
            <Alert
              icon={<AlertCircle size={16} />}
              title="Rubrics unavailable"
              color="red"
              variant="light"
            >
              {rubricsError.message}
            </Alert>
          )}

          {isLoadingRubrics ? (
            <Group gap="xs" c="dimmed">
              <Loader size={16} />
              <Text size="sm">Loading rubrics…</Text>
            </Group>
          ) : (
            <MultiSelect
              label="Rubrics to score"
              value={selectedRubricIds}
              onChange={setSelectedRubricIds}
              data={allRubrics.map((r) => ({
                value: r.id,
                label: `${r.name} (v${r.version})${r.isBuiltIn ? " • Built-in" : " • Custom"}`,
              }))}
              searchable
              clearable
              styles={{ input: { minHeight: 44 } }}
            />
          )}

          {runProgress && (
            <Stack gap={6}>
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Generating scorecards
                </Text>
                <Text size="sm" c="dimmed">
                  {runProgress.completedSections}/{runProgress.totalSections}{" "}
                  sections
                </Text>
              </Group>
              <Progress value={progressValue} animated striped />
              {runProgress.label && (
                <Text size="xs" c="dimmed">
                  {runProgress.label}
                </Text>
              )}
            </Stack>
          )}
        </Stack>
      </Paper>

      {scorecards && scorecards.length > 0 && (
        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" align="flex-end" wrap="wrap">
            <Select
              label="Saved scorecards"
              value={activeScorecard?.id ?? null}
              onChange={(v) => setActiveScorecardId(v)}
              data={scorecards.map((s) => ({
                value: s.id,
                label: `${new Date(s.createdAt).toLocaleString()} • ${rubricNameById.get(s.rubricTemplateId) ?? s.rubricTemplateId}`,
              }))}
              styles={{ input: { minHeight: 44 } }}
              style={{ flex: 1, minWidth: 280 }}
            />
            <Select
              label="Compare with"
              placeholder="Optional"
              value={compareScorecardId}
              onChange={setCompareScorecardId}
              data={(scorecards ?? [])
                .filter((s) => s.id !== activeScorecard?.id)
                .map((s) => ({
                  value: s.id,
                  label: `${new Date(s.createdAt).toLocaleString()} • ${rubricNameById.get(s.rubricTemplateId) ?? s.rubricTemplateId}`,
                }))}
              clearable
              styles={{ input: { minHeight: 44 } }}
              style={{ flex: 1, minWidth: 280 }}
            />
            <Button
              color="red"
              variant="light"
              leftSection={<Trash2 size={16} />}
              onClick={deleteScorecard}
              styles={{ root: { minHeight: 44 } }}
            >
              Delete
            </Button>
          </Group>
        </Paper>
      )}

      {!scorecards ? (
        <Alert
          icon={<Loader size={16} />}
          title="Loading"
          color="blue"
          variant="light"
        >
          Loading scorecards from this browser…
        </Alert>
      ) : scorecards.length === 0 ? (
        <Alert
          icon={<AlertCircle size={16} />}
          title="No scorecards yet"
          color="gray"
          variant="light"
        >
          Generate your first scorecard to see results here.
        </Alert>
      ) : activeScorecard ? (
        <Stack gap="lg">
          {compareScorecard && (
            <ScorecardCompare
              left={activeScorecard}
              right={compareScorecard}
              rubricNameById={rubricNameById}
            />
          )}
          <ScorecardViewer
            scorecard={activeScorecard}
            rubric={activeRubric}
            transcriptFilename={transcript.filename}
            onTimestampClick={onTimestampClick}
          />
        </Stack>
      ) : (
        <Alert
          icon={<AlertCircle size={16} />}
          title="No scorecard selected"
          color="gray"
          variant="light"
        >
          Select a saved scorecard to view.
        </Alert>
      )}
    </Stack>
  );
}
