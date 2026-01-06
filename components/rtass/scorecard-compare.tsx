"use client";

import * as React from "react";
import { Badge, Group, Paper, Stack, Table, Text, Title } from "@mantine/core";
import type { RtassScorecard } from "@/types/rtass";

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

function formatDelta(left: number, right: number): string {
  const delta = right - left;
  const pct = Math.round(delta * 100);
  if (pct === 0) return "0%";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

export function ScorecardCompare({
  left,
  right,
  rubricNameById,
}: {
  left: RtassScorecard;
  right: RtassScorecard;
  rubricNameById?: Map<string, string>;
}) {
  const leftSections = React.useMemo(() => new Map(left.sections.map((s) => [s.sectionId, s])), [left.sections]);
  const rightSections = React.useMemo(() => new Map(right.sections.map((s) => [s.sectionId, s])), [right.sections]);

  const sectionIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const s of left.sections) ids.add(s.sectionId);
    for (const s of right.sections) ids.add(s.sectionId);
    return Array.from(ids);
  }, [left.sections, right.sections]);

  return (
    <Paper p="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={2}>
            <Title order={3} size="h4">
              Compare Scorecards
            </Title>
            <Text size="sm" c="dimmed">
              {rubricNameById?.get(left.rubricTemplateId) ?? left.rubricTemplateId} •{" "}
              {new Date(left.createdAt).toLocaleString()}
              {"  →  "}
              {rubricNameById?.get(right.rubricTemplateId) ?? right.rubricTemplateId} •{" "}
              {new Date(right.createdAt).toLocaleString()}
            </Text>
          </Stack>

          <Group gap="xs">
            <Badge color={statusColor(left.overall.status)} variant="light">
              {formatPercent(left.overall.score)}
            </Badge>
            <Text size="sm" c="dimmed">
              {formatDelta(left.overall.score, right.overall.score)}
            </Text>
            <Badge color={statusColor(right.overall.status)} variant="light">
              {formatPercent(right.overall.score)}
            </Badge>
          </Group>
        </Group>

        <Table withTableBorder highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Section</Table.Th>
              <Table.Th>{formatPercent(left.overall.score)} (left)</Table.Th>
              <Table.Th>Δ</Table.Th>
              <Table.Th>{formatPercent(right.overall.score)} (right)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sectionIds.map((id) => {
              const l = leftSections.get(id);
              const r = rightSections.get(id);

              const leftScore = l?.score ?? 0;
              const rightScore = r?.score ?? 0;

              return (
                <Table.Tr key={id}>
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {l?.title ?? r?.title ?? id}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {id}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Badge size="sm" variant="light" color={l ? statusColor(l.status) : "gray"}>
                        {formatPercent(leftScore)}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {formatDelta(leftScore, rightScore)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Badge size="sm" variant="light" color={r ? statusColor(r.status) : "gray"}>
                        {formatPercent(rightScore)}
                      </Badge>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Stack>
    </Paper>
  );
}

