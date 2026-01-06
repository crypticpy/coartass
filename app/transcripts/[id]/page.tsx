/**
 * Transcript Detail Page
 *
 * Displays full transcript with viewer, header, export, and delete functionality.
 * Loads transcript from IndexedDB by ID from route params.
 */

"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Container,
  Text,
  Tabs,
  Group,
  Stack,
  Button,
  Alert,
  Box,
  Paper,
} from "@mantine/core";
import {
  Loader2,
  ArrowLeft,
  AlertCircle,
  FileTextIcon,
  Sparkles,
  MessageCircle,
  ClipboardCheck,
} from "lucide-react";
import { notifications } from "@mantine/notifications";
import {
  getTranscript,
  deleteTranscript,
  deleteAnalysis,
  getAnalysisByTranscript,
  getAllTemplates,
  saveAnalysis,
  getRtassScorecardsByTranscript,
  getRtassRubricTemplate,
} from "@/lib/db";
import {
  exportTranscriptAsText,
  exportTranscriptAsSRT,
  exportTranscriptAsVTT,
  downloadTextAsFile,
} from "@/lib/transcript-utils";
import { getAudioFile, revokeAudioUrl } from "@/lib/audio-storage";
import { findSegmentByTimestamp } from "@/lib/timestamp-utils";
import { normalizeEvidence } from "@/lib/analysis-utils";
import { TranscriptHeader } from "@/components/transcript/transcript-header";
import { TranscriptViewer } from "@/components/transcript/transcript-viewer";
import { AnalysisViewer } from "@/components/analysis/analysis-viewer";
import { AnalysisExportMenu } from "@/components/analysis/analysis-export-menu";
import { EvaluationDisplay } from "@/components/analysis/evaluation-display";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ScorecardRunner } from "@/components/rtass/scorecard-runner";
import type { Transcript, TranscriptSegment } from "@/types/transcript";
import type { Analysis } from "@/types/analysis";
import type { AudioPlayerControls } from "@/types/audio";
import type { Template } from "@/types/template";
import type { RtassScorecard, RtassRubricTemplate } from "@/types/rtass";

// Dynamic import for RadioPlaybackInterface (contains heavy WaveSurfer dependency)
const RadioPlaybackInterface = dynamic(
  () => import("@/components/audio/radio-playback-interface").then((mod) => mod.RadioPlaybackInterface),
  {
    ssr: false,
    loading: () => (
      <Box
        h={300}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--mantine-color-default)',
          borderRadius: 'var(--mantine-radius-md)'
        }}
      >
        <Group gap="xs" c="dimmed">
          <Loader2 size={16} className="animate-spin" />
          <Text size="sm">Loading audio player...</Text>
        </Group>
      </Box>
    )
  }
);

// Dynamic import for InteractiveReviewMode (full-screen overlay)
const InteractiveReviewMode = dynamic(
  () => import("@/components/audio/interactive-review-mode").then((mod) => mod.InteractiveReviewMode),
  {
    ssr: false,
    loading: () => null
  }
);

const EMPTY_ANALYSES: Analysis[] = [];

/**
 * Format analysis tab label: Analysis + short date
 * Example: "Analysis (Nov 23)" or "Analysis (Dec 1)"
 */
function formatAnalysisTabLabel(analysis: Analysis): string {
  const date = new Date(analysis.createdAt);
  const shortDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  return `Analysis (${shortDate})`;
}

/**
 * Transcript detail page component
 *
 * Features:
 * - Load transcript by ID from route params
 * - Display transcript header with metadata
 * - Full transcript viewer with search
 * - Export functionality (TXT, SRT, VTT, JSON)
 * - Delete with confirmation
 * - Loading and error states
 * - Back to list navigation
 */
export default function TranscriptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingAnalysisId, setDeletingAnalysisId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>("transcript");
  const [generatingEvidenceFor, setGeneratingEvidenceFor] = useState<string | null>(null);
  const [evaluationViewMode, setEvaluationViewMode] = useState<Record<string, "draft" | "final">>({});
  const [showReviewMode, setShowReviewMode] = useState(false);
  const hasSetInitialTab = useRef(false);

  const audioControlsRef = useRef<AudioPlayerControls | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const citationsAbortRef = useRef<AbortController | null>(null);

  // Extract transcript ID from route params
  const transcriptId = params.id as string;

  // Load transcript from IndexedDB with live updates
  const transcript = useLiveQuery<Transcript | undefined>(async () => {
    if (!transcriptId) return undefined;
    try {
      return await getTranscript(transcriptId);
    } catch (error) {
      console.error("Error loading transcript:", error);
      return undefined;
    }
  }, [transcriptId]);

  // Load analyses for this transcript with live updates (Reactive)
  const analyses =
    useLiveQuery<Analysis[]>(async () => {
      if (!transcriptId) return [];
      try {
        return await getAnalysisByTranscript(transcriptId);
      } catch (error) {
        console.error("Error loading analyses:", error);
        return [];
      }
    }, [transcriptId]) || EMPTY_ANALYSES;

  const templates = useLiveQuery<Template[]>(async () => {
    try {
      return await getAllTemplates();
    } catch (error) {
      console.error("Error loading templates:", error);
      return [];
    }
  }, []);

  const templateById = useMemo(() => {
    return new Map((templates ?? []).map((t) => [t.id, t]));
  }, [templates]);

  // Load RTASS scorecards for this transcript (for Review Mode benchmarks)
  const scorecards = useLiveQuery<RtassScorecard[]>(async () => {
    if (!transcriptId) return [];
    try {
      return await getRtassScorecardsByTranscript(transcriptId);
    } catch (error) {
      console.error("Error loading scorecards:", error);
      return [];
    }
  }, [transcriptId]);

  // Get the most recent scorecard for the review mode
  const latestScorecard = useMemo(() => {
    if (!scorecards || scorecards.length === 0) return undefined;
    return scorecards[0];
  }, [scorecards]);

  function normalizeRubricDates(rubric: RtassRubricTemplate): RtassRubricTemplate {
    return {
      ...rubric,
      createdAt: rubric.createdAt instanceof Date ? rubric.createdAt : new Date(rubric.createdAt),
      updatedAt:
        rubric.updatedAt instanceof Date
          ? rubric.updatedAt
          : rubric.updatedAt
            ? new Date(rubric.updatedAt)
            : undefined,
    };
  }

  // Load the rubric template for the latest scorecard (for Review Mode benchmarks)
  const [latestRubric, setLatestRubric] = useState<RtassRubricTemplate | undefined>(undefined);

  useEffect(() => {
    if (!latestScorecard?.rubricTemplateId) {
      setLatestRubric(undefined);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const rubricId = latestScorecard.rubricTemplateId;

    (async () => {
      try {
        const custom = await getRtassRubricTemplate(rubricId);
        if (cancelled) return;
        if (custom) {
          setLatestRubric(custom);
          return;
        }
      } catch (error) {
        console.error("Error loading rubric template:", error);
      }

      try {
        const res = await fetch(`/api/rtass/rubrics?id=${encodeURIComponent(rubricId)}`, {
          signal: controller.signal,
        });
        const payload = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLatestRubric(undefined);
          return;
        }
        setLatestRubric(normalizeRubricDates(payload.data as RtassRubricTemplate));
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Error loading built-in rubric:", error);
        if (!cancelled) setLatestRubric(undefined);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [latestScorecard?.rubricTemplateId]);

  const citationsEnabled = process.env.NEXT_PUBLIC_CITATIONS_ENABLED !== "false";

  const handleGenerateEvidence = useCallback(
    async (analysis: Analysis) => {
      if (!transcript) return;
      if (!citationsEnabled) {
        notifications.show({
          title: "Supporting Evidence Disabled",
          message: "Supporting evidence is disabled in this build.",
          color: "gray",
        });
        return;
      }

      const template = templateById.get(analysis.templateId);
      if (!template) {
        notifications.show({
          title: "Template Not Found",
          message: "Cannot generate supporting evidence because the template is missing.",
          color: "red",
        });
        return;
      }

      // Cancel any in-flight citations request
      citationsAbortRef.current?.abort();
      const abortController = new AbortController();
      citationsAbortRef.current = abortController;

      setGeneratingEvidenceFor(analysis.id);
      try {
        const response = await fetch("/api/citations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: { segments: transcript.segments },
            templateSections: template.sections,
            sections: analysis.results.sections.map((s) => ({
              name: s.name,
              content: s.content,
            })),
            maxEvidencePerSection: 3,
          }),
          signal: abortController.signal,
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          notifications.show({
            title: "Supporting Evidence Failed",
            message:
              payload?.error ||
              `Citations request failed with status ${response.status}`,
            color: "red",
          });
          return;
        }

        if (payload?.data?.disabled) {
          notifications.show({
            title: "Supporting Evidence Disabled",
            message: "Supporting evidence is disabled on the server.",
            color: "gray",
          });
          return;
        }

        const evidenceByName = new Map<string, unknown>(
          (payload?.data?.sections || []).map((s: { name: string; evidence: unknown }) => [
            s.name,
            s.evidence,
          ])
        );

        const mergedSections = analysis.results.sections.map((section) => {
          const llmEvidence = evidenceByName.get(section.name);
          return { ...section, evidence: normalizeEvidence(llmEvidence) };
        });

        const updated: Analysis = {
          ...analysis,
          results: {
            ...analysis.results,
            sections: mergedSections,
          },
        };

        await saveAnalysis(updated);

        notifications.show({
          title: "Supporting Evidence Ready",
          message: "Supporting evidence has been generated for this analysis.",
          color: "green",
        });
      } catch (error) {
        // Don't show notification for aborted requests
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        notifications.show({
          title: "Supporting Evidence Failed",
          message:
            error instanceof Error ? error.message : "Failed to generate citations",
          color: "red",
        });
      } finally {
        setGeneratingEvidenceFor(null);
        citationsAbortRef.current = null;
      }
    },
    [citationsEnabled, templateById, transcript]
  );

  // Cleanup: abort in-flight citations request on unmount
  useEffect(() => {
    return () => {
      citationsAbortRef.current?.abort();
    };
  }, []);

  // Loading state
  const isLoading = transcript === undefined;

  // Set initial tab based on analyses availability (only once)
  useEffect(() => {
    if (analyses.length > 0 && !hasSetInitialTab.current) {
      // Select most recent analysis (first in array)
      setActiveTab(`analysis-${analyses[0].id}`);
      hasSetInitialTab.current = true;
    }
  }, [analyses]);

  // Handle export functionality
  const handleExport = useCallback(
    (format: "txt" | "srt" | "vtt" | "json") => {
      if (!transcript) return;

      try {
        let content: string;
        let filename: string;
        let mimeType: string;

        switch (format) {
          case "txt": {
            content = exportTranscriptAsText(transcript);
            filename = `${transcript.filename.replace(/\.[^/.]+$/, "")}.txt`;
            mimeType = "text/plain";
            break;
          }

          case "srt": {
            content = exportTranscriptAsSRT(transcript.segments);
            filename = `${transcript.filename.replace(/\.[^/.]+$/, "")}.srt`;
            mimeType = "text/plain";
            break;
          }

          case "vtt": {
            content = exportTranscriptAsVTT(transcript.segments);
            filename = `${transcript.filename.replace(/\.[^/.]+$/, "")}.vtt`;
            mimeType = "text/vtt";
            break;
          }

          case "json": {
            content = JSON.stringify(transcript, null, 2);
            filename = `${transcript.filename.replace(/\.[^/.]+$/, "")}.json`;
            mimeType = "application/json";
            break;
          }

          default:
            throw new Error(`Unsupported export format: ${format}`);
        }

        downloadTextAsFile(content, filename, mimeType);

        notifications.show({
          title: "Export Successful",
          message: `Transcript exported as ${format.toUpperCase()}`,
          color: "green",
        });
      } catch (error) {
        console.error("Export error:", error);
        notifications.show({
          title: "Export Failed",
          message:
            error instanceof Error
              ? error.message
              : "Failed to export transcript",
          color: "red",
        });
      }
    },
    [transcript]
  );

  // Handle delete functionality
  const handleDelete = useCallback(async () => {
    if (!transcript) return;

    setIsDeleting(true);

    try {
      await deleteTranscript(transcript.id);

      notifications.show({
        title: "Transcript Deleted",
        message: "The transcript has been deleted successfully.",
        color: "green",
      });

      // Navigate back to transcripts list
      router.push("/transcripts");
    } catch (error) {
      console.error("Delete error:", error);
      notifications.show({
        title: "Delete Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete transcript",
        color: "red",
      });
      setIsDeleting(false);
    }
  }, [transcript, router]);

  // Handle analyze functionality (navigate to analysis creation)
  const handleAnalyze = useCallback(() => {
    if (!transcript) return;

    // Navigate to analysis page (Phase 3 feature)
    router.push(`/transcripts/${transcript.id}/analyze`);
  }, [transcript, router]);

  // Handle delete individual analysis
  // Note: Tab switching is handled by the useEffect below to avoid stale closure issues
  const handleDeleteAnalysis = useCallback(async (analysisId: string) => {
    // Guard: prevent concurrent deletions
    if (deletingAnalysisId) return;

    setDeletingAnalysisId(analysisId);

    try {
      await deleteAnalysis(analysisId);

      notifications.show({
        title: "Analysis Deleted",
        message: "The analysis has been deleted successfully.",
        color: "green",
      });
      // Tab switching handled by useEffect reacting to analyses changes
    } catch (error) {
      console.error("Delete analysis error:", error);
      notifications.show({
        title: "Delete Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete analysis",
        color: "red",
      });
    } finally {
      setDeletingAnalysisId(null);
    }
  }, [deletingAnalysisId]);

  // Handle tab switching when current analysis is deleted
  // Separated from delete handler to avoid stale closure issues with useLiveQuery
  useEffect(() => {
    if (activeTab?.startsWith('analysis-')) {
      const analysisId = activeTab.replace('analysis-', '');
      const analysisExists = analyses.some(a => a.id === analysisId);

      if (!analysisExists && analyses.length >= 0) {
        // Analysis was deleted, switch to another tab
        if (analyses.length > 0) {
          setActiveTab(`analysis-${analyses[0].id}`);
        } else {
          setActiveTab("transcript");
        }
      }
    }
  }, [activeTab, analyses]);

  // Load audio file from IndexedDB
  // RACE CONDITION FIX: Proper cancellation to prevent stale audio URL updates
  useEffect(() => {
    if (!transcriptId) return;

    let mounted = true;
    let currentAudioUrl: string | null = null;

    const loadAudio = async () => {
      try {
        const result = await getAudioFile(transcriptId);
        // Only update state if component is still mounted and this is the latest request
        if (result && mounted) {
          currentAudioUrl = result.audioUrl;
          setAudioUrl(result.audioUrl);
        } else if (result && !mounted) {
          // Clean up if component unmounted before completion
          revokeAudioUrl(result.audioUrl);
        }
      } catch (error) {
        // Only log error if component is still mounted
        if (mounted) {
          console.error("Failed to load audio:", error);
        }
      }
    };

    loadAudio();

    // Cleanup: revoke ObjectURL when component unmounts or transcriptId changes
    return () => {
      mounted = false;
      if (currentAudioUrl) {
        revokeAudioUrl(currentAudioUrl);
      }
      // Clear audio URL state to prevent displaying stale audio
      setAudioUrl(null);
    };
  }, [transcriptId]);

  // Handle segment change from audio player
  const handleSegmentChange = useCallback(
    (segment: TranscriptSegment | null, index: number) => {
      setActiveSegmentIndex(index);
    },
    []
  );

  // Handle controls ready from audio player
  const handleControlsReady = useCallback((controls: AudioPlayerControls) => {
    audioControlsRef.current = controls;
  }, []);

  // Handle segment click from transcript viewer (to seek audio)
  const handleTranscriptSegmentClick = useCallback(
    (index: number) => {
      if (audioControlsRef.current && transcript?.segments) {
        audioControlsRef.current.jumpToSegment(index);
      }
      // Switch to transcript tab to show the highlighted segment
      setActiveTab("transcript");
    },
    [transcript]
  );

  // Handle timestamp click from analysis (converts seconds to segment index)
  const handleTimestampClick = useCallback(
    (seconds: number) => {
      if (!transcript?.segments || transcript.segments.length === 0) {
        return;
      }

      // Find the segment containing this timestamp (returns array position)
      const arrayIndex = findSegmentByTimestamp(transcript.segments, seconds);

      if (arrayIndex >= 0 && audioControlsRef.current) {
        // Get the actual segment to access its index property
        const segment = transcript.segments[arrayIndex];
        const segmentIndex = segment.index;

        // Seek audio to exact timestamp
        audioControlsRef.current.seek(seconds);
        audioControlsRef.current.jumpToSegment(segmentIndex);

        // Switch to transcript tab first
        setActiveTab("transcript");

        // Update active segment after a brief delay to ensure tab is visible
        // This helps the virtualizer scroll work correctly
        requestAnimationFrame(() => {
          setActiveSegmentIndex(segmentIndex);
        });
      }
    },
    [transcript]
  );

  // Handle scroll for sticky tabs shadow (throttled for performance)
  useEffect(() => {
    let lastCall = 0;
    const throttleMs = 100;

    const handleScroll = () => {
      const now = Date.now();
      if (now - lastCall < throttleMs) return;
      lastCall = now;

      if (tabsRef.current) {
        const rect = tabsRef.current.getBoundingClientRect();
        setIsScrolled(rect.top <= 0);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <Container size="lg" py="xl">
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 400,
          }}
        >
          <Stack align="center" gap="md">
            <Loader2
              size={32}
              className="animate-spin"
              style={{ color: "var(--aph-blue)" }}
            />
            <Text size="sm" c="dimmed">
              Loading transcript...
            </Text>
          </Stack>
        </Box>
      </Container>
    );
  }

  // Error state - transcript not found
  if (!transcript) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="xl" style={{ maxWidth: 600, margin: "0 auto" }}>
          {/* Back Button */}
          <Button
            component={Link}
            href="/transcripts"
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            styles={{ root: { minHeight: 44, width: "fit-content" } }}
          >
            Back to Transcripts
          </Button>

          {/* Error Alert */}
          <Alert
            variant="light"
            color="red"
            title="Incident Not Found"
            icon={<AlertCircle size={16} />}
          >
            The incident you&apos;re looking for doesn&apos;t exist or may
            have been deleted.
          </Alert>

          {/* Actions */}
          <Box style={{ display: "flex", justifyContent: "center" }}>
            <Button
              component={Link}
              href="/transcripts"
              styles={{ root: { minHeight: 44 } }}
            >
              View All Incidents
            </Button>
          </Box>
        </Stack>
      </Container>
    );
  }

  // Main content
  return (
    <div className="content-max-width">
      <Container size="xl" py="xl">
          <Stack gap="xl">
            {/* Back Button */}
            <Button
              component={Link}
              href="/transcripts"
              variant="subtle"
              leftSection={<ArrowLeft size={16} />}
              styles={{ root: { minHeight: 44, width: "fit-content" } }}
            >
              Back to Incidents
            </Button>

            {/* Transcript Header Components */}
            <TranscriptHeader
              transcript={transcript}
              analyses={analyses}
              onExport={handleExport}
              onDelete={handleDelete}
              onAnalyze={handleAnalyze}
              isDeleting={isDeleting}
              hasExistingAnalyses={analyses.length > 0}
            />

            {/* Radio Playback Interface (if audio is available) */}
            {audioUrl && transcript.segments.length > 0 && (
              <Paper
                p="md"
                radius="md"
                style={{ backgroundColor: "var(--mantine-color-default)", border: "1px solid var(--mantine-color-default-border)" }}
              >
                <RadioPlaybackInterface
                  audioUrl={audioUrl}
                  cacheKey={transcript.id}
                  segments={transcript.segments}
                  duration={transcript.metadata.duration}
                  wordCount={transcript.text.split(/\s+/).filter(Boolean).length}
                  fileSize={transcript.metadata.fileSize}
                  onSegmentChange={handleSegmentChange}
                  onControlsReady={handleControlsReady}
                  onReviewModeClick={() => setShowReviewMode(true)}
                />
              </Paper>
            )}

            {/* Sticky Tabs Section */}
            <div
              ref={tabsRef}
              className={`sticky-tabs ${isScrolled ? "scrolled" : ""}`}
            >
              <Tabs value={activeTab} onChange={setActiveTab} variant="default" keepMounted={false}>
                <Tabs.List
                  mb="md"
                  style={{
                    overflowX: 'auto',
                    flexWrap: 'nowrap',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  {/* Transcript Tab */}
                  <Tabs.Tab
                    value="transcript"
                    leftSection={<FileTextIcon size={14} />}
                  >
                    <Text size="sm" fw={600}>
                      Radio Transcript
                    </Text>
                  </Tabs.Tab>

                  {/* Dynamic Analysis Tabs */}
                  {analyses.map((analysis) => (
                    <Tabs.Tab
                      key={analysis.id}
                      value={`analysis-${analysis.id}`}
                      leftSection={<Sparkles size={14} />}
                    >
                      <Text size="sm" fw={600}>
                        {formatAnalysisTabLabel(analysis)}
                      </Text>
                    </Tabs.Tab>
                  ))}

                  {/* RTASS Scorecard Tab */}
                  <Tabs.Tab value="scorecard" leftSection={<ClipboardCheck size={14} />}>
                    <Text size="sm" fw={600}>
                      Scorecard
                    </Text>
                  </Tabs.Tab>

                  {/* Chat Tab */}
                  <Tabs.Tab
                    value="chat"
                    leftSection={<MessageCircle size={14} />}
                  >
                    <Text size="sm" fw={600}>
                      Chat
                    </Text>
                  </Tabs.Tab>
                </Tabs.List>

                {/* Transcript Panel */}
                <Tabs.Panel value="transcript">
                  <Paper
                    p={0}
                    radius="md"
                    withBorder
                    style={{
                      boxShadow: "var(--mantine-shadow-sm)",
                      overflow: "visible",
                    }}
                  >
                    <TranscriptViewer
                      transcript={transcript}
                      defaultView="segments"
                      activeSegmentIndex={activeSegmentIndex}
                      onSegmentClick={
                        audioUrl ? handleTranscriptSegmentClick : undefined
                      }
                    />
                  </Paper>
                </Tabs.Panel>

                {/* Dynamic Analysis Panels */}
                {analyses.map((analysis) => (
                  <Tabs.Panel
                    key={analysis.id}
                    value={`analysis-${analysis.id}`}
                  >
                    {(() => {
                      const template = templateById.get(analysis.templateId);
                      const hasEvaluation = !!(analysis.evaluation && analysis.draftResults);
                      const currentViewMode = evaluationViewMode[analysis.id] || "final";
                      return (
                        <Stack gap="md">
                          {/* Export Header */}
                          <Group justify="flex-end">
                            {template && (
                              <AnalysisExportMenu
                                analysis={analysis}
                                transcript={transcript}
                                template={template}
                                variant="light"
                                size="sm"
                              />
                            )}
                          </Group>

                          <AnalysisViewer
                            analysis={analysis}
                            template={template}
                            onGenerateEvidence={
                              template ? () => handleGenerateEvidence(analysis) : undefined
                            }
                            isGeneratingEvidence={generatingEvidenceFor === analysis.id}
                            onTimestampClick={
                              audioUrl ? handleTimestampClick : undefined
                            }
                            onDelete={() => handleDeleteAnalysis(analysis.id)}
                            isDeleting={deletingAnalysisId === analysis.id}
                            showDraftResults={hasEvaluation && currentViewMode === "draft"}
                          />

                          {/* Evaluation Display (Quality Checker Panel) - at bottom */}
                          {hasEvaluation && (
                            <EvaluationDisplay
                              evaluation={analysis.evaluation!}
                              draftResults={analysis.draftResults!}
                              finalResults={analysis.results}
                              currentView={currentViewMode}
                              onViewChange={(view) => setEvaluationViewMode((prev) => ({
                                ...prev,
                                [analysis.id]: view
                              }))}
                            />
                          )}
                        </Stack>
                      );
                    })()}
                  </Tabs.Panel>
                ))}

                {/* RTASS Scorecard Panel */}
                <Tabs.Panel value="scorecard">
                  <Paper
                    p="lg"
                    radius="md"
                    withBorder
                    style={{
                      boxShadow: "var(--mantine-shadow-sm)",
                    }}
                  >
                    <ScorecardRunner
                      transcript={transcript}
                      onTimestampClick={audioUrl ? handleTimestampClick : undefined}
                    />
                  </Paper>
                </Tabs.Panel>

                {/* Chat Panel */}
                <Tabs.Panel value="chat">
                  <Paper
                    p="lg"
                    radius="md"
                    withBorder
                    style={{
                      boxShadow: "var(--mantine-shadow-sm)",
                    }}
                  >
                    <ChatInterface
                      transcriptId={transcript.id}
                      transcript={transcript}
                    />
                  </Paper>
                </Tabs.Panel>
              </Tabs>
            </div>
          </Stack>
        </Container>

        {/* Interactive Review Mode Overlay */}
        {showReviewMode && audioUrl && (
          <InteractiveReviewMode
            audioUrl={audioUrl}
            segments={transcript.segments}
            scorecard={latestScorecard}
            rubric={latestRubric}
            scorecards={scorecards ?? []}
            duration={transcript.metadata.duration}
            cacheKey={transcript.id}
            onClose={() => setShowReviewMode(false)}
          />
        )}
      </div>
  );
}
