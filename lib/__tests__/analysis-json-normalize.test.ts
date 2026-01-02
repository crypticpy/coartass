import { describe, expect, it } from "vitest";
import { normalizeAnalysisJsonKeys } from "@/lib/analysis-strategies/shared";

describe("normalizeAnalysisJsonKeys", () => {
  it("maps snake_case fireground keys to camelCase", () => {
    const input = {
      sections: [],
      radio_reports: [{ id: "report-1", type: "other", timestamp: 12 }],
      safety_events: [
        {
          id: "safety-1",
          type: "other",
          severity: "info",
          timestamp: 34,
          details: "Test",
        },
      ],
    };

    const normalized = normalizeAnalysisJsonKeys(input) as unknown as Record<string, unknown>;

    expect(normalized.radioReports).toEqual(input.radio_reports);
    expect(normalized.safetyEvents).toEqual(input.safety_events);
  });

  it("maps final_results to finalResults and normalizes nested keys", () => {
    const input = {
      improvements: [],
      additions: [],
      qualityScore: 8,
      reasoning: "ok",
      final_results: {
        summary: "Summary",
        sections: [],
        radio_reports: [{ id: "report-1", type: "other", timestamp: 12 }],
      },
    };

    const normalized = normalizeAnalysisJsonKeys(input) as unknown as Record<string, unknown>;
    const finalResults = normalized.finalResults as Record<string, unknown>;

    expect(finalResults).toBeTruthy();
    expect(finalResults.radioReports).toEqual(input.final_results.radio_reports);
  });
});

