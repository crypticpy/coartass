"use client";

import * as React from "react";
import { useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AlertCircle, CheckCircle2, Clock, Download, XCircle } from "lucide-react";
import type { RtassScorecard, RtassRubricTemplate } from "@/types/rtass";
import { formatTimestamp } from "@/lib/transcript-utils";

function formatPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function statusColor(status: RtassScorecard["overall"]["status"]): string {
  switch (status) {
    case "pass":
      return "green";
    case "needs_improvement":
      return "yellow";
    case "fail":
      return "red";
  }
}

function statusIcon(status: RtassScorecard["overall"]["status"]) {
  switch (status) {
    case "pass":
      return <CheckCircle2 size={16} />;
    case "needs_improvement":
      return <AlertCircle size={16} />;
    case "fail":
      return <XCircle size={16} />;
  }
}

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  const escaped = str.replace(/"/g, "\"\"");
  if (/[",\n\r]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
}

function buildScorecardCsv(scorecard: RtassScorecard): string {
  const rows: string[][] = [];

  rows.push([
    "scorecardId",
    "transcriptId",
    "rubricTemplateId",
    "createdAt",
    "overallScore",
    "overallStatus",
    "sectionId",
    "sectionTitle",
    "sectionScore",
    "sectionStatus",
    "criterionId",
    "criterionTitle",
    "verdict",
    "score",
    "confidence",
    "rationale",
    "evidenceQuotes",
    "evidenceStarts",
    "evidenceSpeakers",
  ]);

  for (const section of scorecard.sections) {
    for (const criterion of section.criteria) {
      const evidenceQuotes = criterion.evidence.map((e) => e.quote).join(" | ");
      const evidenceStarts = criterion.evidence.map((e) => e.start).join(" | ");
      const evidenceSpeakers = criterion.evidence.map((e) => e.speaker ?? "").join(" | ");

      rows.push([
        scorecard.id,
        scorecard.transcriptId,
        scorecard.rubricTemplateId,
        new Date(scorecard.createdAt).toISOString(),
        scorecard.overall.score,
        scorecard.overall.status,
        section.sectionId,
        section.title,
        section.score,
        section.status,
        criterion.criterionId,
        criterion.title,
        criterion.verdict,
        criterion.score ?? "",
        criterion.confidence,
        criterion.rationale,
        evidenceQuotes,
        evidenceStarts,
        evidenceSpeakers,
      ].map(escapeCsvCell));
    }
  }

  return rows.map((r) => r.join(",")).join("\n");
}

export function ScorecardViewer({
  scorecard,
  rubric,
  transcriptFilename,
  incidentInfo,
  onTimestampClick,
}: {
  scorecard: RtassScorecard;
  rubric?: RtassRubricTemplate;
  transcriptFilename?: string;
  incidentInfo?: {
    incidentNumber?: string;
    incidentDate?: Date;
    location?: string;
  };
  onTimestampClick?: (seconds: number) => void;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportJSON = () => {
    try {
      const blob = new Blob([JSON.stringify(scorecard, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = transcriptFilename
        ? `${transcriptFilename.replace(/\.[^/.]+$/, "")}-scorecard`
        : `rtass-scorecard-${scorecard.id.slice(0, 8)}`;
      a.download = `${baseName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notifications.show({
        title: "JSON Exported",
        message: "Scorecard JSON has been downloaded",
        color: "green",
      });
    } catch (error) {
      console.error("JSON export error:", error);
      notifications.show({
        title: "Export Failed",
        message: error instanceof Error ? error.message : "Failed to export JSON",
        color: "red",
      });
    }
  };

  const handleExportCSV = () => {
    try {
      const csv = buildScorecardCsv(scorecard);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = transcriptFilename
        ? `${transcriptFilename.replace(/\.[^/.]+$/, "")}-scorecard`
        : `rtass-scorecard-${scorecard.id.slice(0, 8)}`;
      a.download = `${baseName}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notifications.show({
        title: "CSV Exported",
        message: "Scorecard CSV has been downloaded",
        color: "green",
      });
    } catch (error) {
      console.error("CSV export error:", error);
      notifications.show({
        title: "Export Failed",
        message: error instanceof Error ? error.message : "Failed to export CSV",
        color: "red",
      });
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const { exportAndDownloadScorecard, isPDFExportSupported } = await import("@/lib/pdf/pdf-exporter");

      if (!isPDFExportSupported()) {
        throw new Error("Your browser does not support PDF export. Please try a modern browser.");
      }

      const result = await exportAndDownloadScorecard(scorecard, {
        rubric,
        transcriptFilename,
        incidentInfo,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to generate PDF");
      }

      notifications.show({
        title: "PDF Exported",
        message: "Scorecard PDF has been downloaded",
        color: "green",
      });
    } catch (error) {
      console.error("PDF export error:", error);
      notifications.show({
        title: "Export Failed",
        message: error instanceof Error ? error.message : "Failed to export PDF",
        color: "red",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Stack gap="lg">
      <Paper p="lg" radius="md" withBorder>
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={4}>
            <Title order={2} size="h3">
              RTASS Scorecard
            </Title>
            <Group gap="xs" c="dimmed">
              <Clock size={14} />
              <Text size="sm">
                {new Date(scorecard.createdAt).toLocaleString()}
              </Text>
            </Group>
          </Stack>

          <Group gap="sm" align="center">
            <Button
              variant="light"
              size="sm"
              leftSection={<Download size={16} />}
              loading={isExporting}
              onClick={handleExportPDF}
            >
              Export PDF
            </Button>
            <Button
              variant="default"
              size="sm"
              leftSection={<Download size={16} />}
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
            <Button
              variant="default"
              size="sm"
              leftSection={<Download size={16} />}
              onClick={handleExportJSON}
            >
              Export JSON
            </Button>
            <Badge
              color={statusColor(scorecard.overall.status)}
              leftSection={statusIcon(scorecard.overall.status)}
              size="lg"
              variant="light"
              styles={{ root: { textTransform: "uppercase" } }}
            >
              {formatPercent(scorecard.overall.score)}
            </Badge>
          </Group>
        </Group>

        {scorecard.overall.notes && (
          <Text mt="sm" size="sm" c="dimmed">
            {scorecard.overall.notes}
          </Text>
        )}
      </Paper>

      {scorecard.warnings && scorecard.warnings.length > 0 && (
        <Alert
          color="yellow"
          icon={<AlertCircle size={16} />}
          title="Warnings"
          variant="light"
        >
          <Stack gap={4}>
            {scorecard.warnings.slice(0, 6).map((w) => (
              <Text key={w} size="sm">
                {w}
              </Text>
            ))}
            {scorecard.warnings.length > 6 && (
              <Text size="sm" c="dimmed">
                {scorecard.warnings.length - 6} more…
              </Text>
            )}
          </Stack>
        </Alert>
      )}

      <Stack gap="xl">
        {scorecard.sections.map((section) => (
          <Paper key={section.sectionId} p="lg" radius="md" withBorder>
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Stack gap={2}>
                <Title order={3} size="h4">
                  {section.title}
                </Title>
                <Text size="sm" c="dimmed">
                  Score: {formatPercent(section.score)}
                </Text>
              </Stack>
              <Badge
                color={statusColor(section.status)}
                variant="light"
                size="md"
                styles={{ root: { textTransform: "uppercase" } }}
              >
                {section.status.replace("_", " ")}
              </Badge>
            </Group>

            <Divider my="md" />

            <Table withTableBorder highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Criterion</Table.Th>
                  <Table.Th>Verdict</Table.Th>
                  <Table.Th>Confidence</Table.Th>
                  <Table.Th>Evidence</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {section.criteria.map((criterion) => (
                  <Table.Tr key={criterion.criterionId}>
                    <Table.Td>
                      <Text fw={600} size="sm">
                        {criterion.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {criterion.rationale}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        variant="light"
                        color={
                          criterion.verdict === "met"
                            ? "green"
                            : criterion.verdict === "missed"
                              ? "red"
                              : criterion.verdict === "partial"
                                ? "yellow"
                                : "gray"
                        }
                        styles={{ root: { textTransform: "uppercase" } }}
                      >
                        {criterion.verdict.replace("_", " ")}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{Math.round(criterion.confidence * 100)}%</Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={6}>
                        {criterion.evidence.slice(0, 2).map((e, idx) => (
                          <Box key={`${criterion.criterionId}-${idx}`}>
                            <Text size="xs" c="dimmed" lineClamp={2}>
                              “{e.quote}”
                            </Text>
                            <Group gap="xs" mt={2}>
                              <Badge
                                size="xs"
                                variant="outline"
                                leftSection={<Clock size={10} />}
                                style={{ cursor: onTimestampClick ? "pointer" : "default" }}
                                onClick={() => onTimestampClick?.(e.start)}
                              >
                                {formatTimestamp(e.start)}
                              </Badge>
                              {e.speaker && (
                                <Badge size="xs" variant="outline" color="gray">
                                  {e.speaker}
                                </Badge>
                              )}
                            </Group>
                          </Box>
                        ))}
                        {criterion.evidence.length === 0 && (
                          <Group gap="xs" c="dimmed">
                            <AlertCircle size={14} />
                            <Text size="xs">No evidence provided</Text>
                          </Group>
                        )}
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
