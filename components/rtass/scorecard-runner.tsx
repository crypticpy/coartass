"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Alert,
  Button,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { AlertCircle, Sparkles, Trash2 } from "lucide-react";
import { notifications } from "@mantine/notifications";
import { deleteRtassScorecard, getRtassScorecardsByTranscript, saveRtassScorecard } from "@/lib/db";
import type { Transcript } from "@/types/transcript";
import type { RtassRubricTemplate, RtassScorecard } from "@/types/rtass";
import { ScorecardViewer } from "./scorecard-viewer";

type RubricListItem = Pick<RtassRubricTemplate, "id" | "name" | "description" | "version"> & {
  _sourceFile?: string;
};

async function fetchRubrics(): Promise<RubricListItem[]> {
  const res = await fetch("/api/rtass/rubrics");
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || "Failed to load rubrics");
  }
  return payload.data as RubricListItem[];
}

function normalizeScorecardDates(scorecard: RtassScorecard): RtassScorecard {
  const createdAt = scorecard.createdAt instanceof Date ? scorecard.createdAt : new Date(scorecard.createdAt);
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

export function ScorecardRunner({
  transcript,
  onTimestampClick,
}: {
  transcript: Transcript;
  onTimestampClick?: (seconds: number) => void;
}) {
  const [rubrics, setRubrics] = React.useState<RubricListItem[] | null>(null);
  const [rubricId, setRubricId] = React.useState<string | null>(null);
  const [isLoadingRubrics, setIsLoadingRubrics] = React.useState(true);
  const [isRunning, setIsRunning] = React.useState(false);
  const [activeScorecardId, setActiveScorecardId] = React.useState<string | null>(null);

  const scorecards = useLiveQuery<RtassScorecard[]>(
    async () => getRtassScorecardsByTranscript(transcript.id),
    [transcript.id]
  );

  const activeScorecard = React.useMemo(() => {
    if (!scorecards || scorecards.length === 0) return null;
    if (activeScorecardId) {
      return scorecards.find((s) => s.id === activeScorecardId) ?? scorecards[0];
    }
    return scorecards[0];
  }, [scorecards, activeScorecardId]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsLoadingRubrics(true);
        const list = await fetchRubrics();
        if (!mounted) return;
        setRubrics(list);

        const defaultRubric =
          list.find((r) => r.id === "rtass-afd-a1016-radio-compliance") ?? list[0] ?? null;
        setRubricId(defaultRubric?.id ?? null);
      } catch (error) {
        notifications.show({
          title: "Failed to load rubrics",
          message: error instanceof Error ? error.message : String(error),
          color: "red",
        });
      } finally {
        if (mounted) setIsLoadingRubrics(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const runScorecard = async () => {
    if (!rubricId) return;
    if (!transcript.text || transcript.segments.length === 0) return;
    if (!rubrics) return;

    setIsRunning(true);
    try {
      const match = rubrics.find((r) => r.id === rubricId);
      if (!match || !match._sourceFile) {
        throw new Error("Rubric source not found");
      }

      const rubricFileRes = await fetch(`/api/rtass/rubrics?file=${encodeURIComponent(match._sourceFile)}`);
      const rubricFilePayload = await rubricFileRes.json();
      if (!rubricFileRes.ok) {
        throw new Error(rubricFilePayload?.error || "Failed to load rubric");
      }
      const rubric = rubricFilePayload.data as RtassRubricTemplate;

      const res = await fetch("/api/rtass/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptId: transcript.id,
          transcript: { text: transcript.text, segments: transcript.segments },
          rubric,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Scorecard request failed");
      }

      const rawScorecard = payload.data as RtassScorecard;
      const scorecard = normalizeScorecardDates(rawScorecard);
      await saveRtassScorecard(scorecard);
      setActiveScorecardId(scorecard.id);

      notifications.show({
        title: "Scorecard generated",
        message: "RTASS scorecard saved to this browser.",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Scorecard failed",
        message: error instanceof Error ? error.message : String(error),
        color: "red",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const deleteScorecard = async () => {
    if (!activeScorecard) return;
    try {
      await deleteRtassScorecard(activeScorecard.id);
      setActiveScorecardId(null);
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

  const rubricOptions = (rubrics ?? []).map((r) => ({
    value: r.id,
    label: `${r.name} (v${r.version})`,
  }));

  const rubricNameById = React.useMemo(() => {
    return new Map((rubrics ?? []).map((r) => [r.id, r.name]));
  }, [rubrics]);

  return (
    <Stack gap="lg">
      <Paper p="lg" radius="md" withBorder>
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={4}>
            <Title order={2} size="h3">
              Scorecard (RTASS)
            </Title>
            <Text size="sm" c="dimmed">
              Run a rubric-based evaluation and generate an evidence-linked scorecard.
            </Text>
          </Stack>

          <Group gap="sm">
            <Button
              leftSection={isRunning ? <Loader size={16} /> : <Sparkles size={16} />}
              onClick={runScorecard}
              loading={isRunning}
              disabled={isLoadingRubrics || !rubricId}
              styles={{ root: { minHeight: 44 } }}
            >
              Generate Scorecard
            </Button>
          </Group>
        </Group>

        <Stack gap="md" mt="md">
          {isLoadingRubrics ? (
            <Group gap="xs" c="dimmed">
              <Loader size={16} />
              <Text size="sm">Loading rubrics…</Text>
            </Group>
          ) : (
            <Select
              label="Rubric"
              value={rubricId}
              onChange={setRubricId}
              data={rubricOptions}
              searchable
              styles={{ input: { minHeight: 44 } }}
            />
          )}
        </Stack>
      </Paper>

      {scorecards && scorecards.length > 0 && (
        <Paper p="lg" radius="md" withBorder>
          <Group justify="space-between" wrap="wrap">
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
        <Alert icon={<Loader size={16} />} title="Loading" color="blue" variant="light">
          Loading scorecards from this browser…
        </Alert>
      ) : scorecards.length === 0 ? (
        <Alert icon={<AlertCircle size={16} />} title="No scorecards yet" color="gray" variant="light">
          Generate your first scorecard to see results here.
        </Alert>
      ) : activeScorecard ? (
        <ScorecardViewer scorecard={activeScorecard} onTimestampClick={onTimestampClick} />
      ) : (
        <Alert icon={<AlertCircle size={16} />} title="No scorecard selected" color="gray" variant="light">
          Select a saved scorecard to view.
        </Alert>
      )}
    </Stack>
  );
}
