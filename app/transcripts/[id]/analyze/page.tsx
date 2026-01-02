/**
 * Analysis Page
 *
 * Page for creating and viewing transcript analyses.
 * Allows template selection, triggers analysis, displays results,
 * and provides export functionality.
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDisclosure } from '@mantine/hooks';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Brain,
  FileText,
  CheckCircle,
  Sparkles,
  ExternalLink,
  Zap,
  Info,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  Container,
  Stack,
  Button,
  Alert,
  Card,
  Text,
  Title,
  Badge,
  Progress,
  Group,
  Box,
  Divider,
  Modal,
  ScrollArea,
  ThemeIcon,
  SegmentedControl,
  SimpleGrid,
  Paper,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAnalysis } from '@/hooks/use-analysis';
import { useSupplementalUpload } from '@/hooks/use-supplemental-upload';
import { getTranscript, getAllTemplates, getAnalysisByTranscript } from '@/lib/db';
import { estimateTokens, getDeploymentInfo, formatTokenCount } from '@/lib/token-utils';
import {
  getUserCategorySettings,
  getEffectiveCategory,
  type UserCategorySettings,
} from '@/lib/user-categories';
import { AnalysisViewer } from '@/components/analysis/analysis-viewer';
import { TemplateDetail } from '@/components/templates/template-detail';
import { StrategySelector } from '@/components/analysis/strategy-selector';
import { EvaluationDisplay } from '@/components/analysis/evaluation-display';
import { StrategyBadge } from '@/components/analysis/strategy-badge';
import { AnalysisExportMenu } from '@/components/analysis/analysis-export-menu';
import { ExportOptionsModal } from '@/components/analysis/export-options-modal';
import { AnalysisProgressCard } from '@/components/analysis/analysis-progress-card';
import { SupplementalUpload } from '@/components/analysis/supplemental-upload';
import type { Transcript } from '@/types/transcript';
import type { Template } from '@/types/template';
import type { Analysis } from '@/types/analysis';
import type { AnalysisStrategy } from '@/lib/analysis-strategy';

/**
 * Compact Template Card Component (Phase 2)
 */
function CompactTemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: Template;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Paper
      p="sm"
      withBorder
      style={{
        cursor: 'pointer',
        borderColor: selected ? 'var(--aph-blue)' : undefined,
        borderWidth: selected ? 2 : 1,
        minHeight: 80,
        transition: 'all 150ms ease',
        boxShadow: selected ? '0 2px 8px rgba(68, 73, 156, 0.12)' : undefined,
      }}
      onClick={onSelect}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
          <ThemeIcon size="lg" variant="light" color="blue" style={{ flexShrink: 0 }}>
            <FileText size={20} />
          </ThemeIcon>
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={600} lineClamp={2}>{template.name}</Text>
            <Text size="xs" c="dimmed">{template.sections.length} sections</Text>
          </Stack>
        </Group>
        {selected && <CheckCircle size={20} color="var(--aph-blue)" style={{ flexShrink: 0 }} />}
      </Group>
    </Paper>
  );
}

/**
 * Analysis Page Component
 */
export default function AnalyzePage() {
  const params = useParams();
  const { state, analyzeTranscript, cancelAnalysis, clearAnalysis, reset } = useAnalysis();

  const transcriptId = params.id as string;
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('review');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [userSettings, setUserSettings] = useState<UserCategorySettings>({
    customCategories: [],
    templateAssignments: {},
  });
  const [selectedStrategy, setSelectedStrategy] = useState<AnalysisStrategy | 'auto'>('auto');
  const [runEvaluation, setRunEvaluation] = useState<boolean>(true);
  const [evaluationView, setEvaluationView] = useState<'draft' | 'final'>('final');
  const [phasesExpanded, setPhasesExpanded] = useState<boolean>(true);
  const [exportOptionsOpened, { open: openExportOptions, close: closeExportOptions }] = useDisclosure(false);

  // Supplemental material upload state
  const supplementalUpload = useSupplementalUpload();

  // Reset analysis state on page load to clear any stale/cached state
  React.useEffect(() => {
    reset();
  }, [reset]);

  // Load user category settings from localStorage on mount
  React.useEffect(() => {
    setUserSettings(getUserCategorySettings());
  }, []);

  // Load transcript from IndexedDB
  const transcript = useLiveQuery<Transcript | undefined>(
    async () => {
      if (!transcriptId) return undefined;
      try {
        return await getTranscript(transcriptId);
      } catch (error) {
        console.error('Error loading transcript:', error);
        return undefined;
      }
    },
    [transcriptId]
  );

  // Load all templates
  const templates = useLiveQuery<Template[]>(
    async () => {
      try {
        return await getAllTemplates();
      } catch (error) {
        console.error('Error loading templates:', error);
        return [];
      }
    },
    []
  );

  // Load existing analyses
  const existingAnalyses = useLiveQuery<Analysis[]>(
    async () => {
      if (!transcriptId) return [];
      try {
        return await getAnalysisByTranscript(transcriptId);
      } catch (error) {
        console.error('Error loading existing analyses:', error);
        return [];
      }
    },
    [transcriptId]
  ) || [];

  // Filter templates by selected category and search query
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];

    let result: Template[] = [];

    if (selectedCategory === 'custom') {
      // Show user's custom-created templates
      result = templates.filter(t => t.isCustom);
    } else if (userSettings.customCategories.includes(selectedCategory)) {
      // User-defined category: show templates assigned to it
      result = templates.filter(t =>
        userSettings.templateAssignments[t.id] === selectedCategory
      );
    } else {
      // Built-in category: show templates in this category (considering user overrides)
      result = templates.filter(t => {
        if (t.isCustom) return false;
        const effectiveCategory = getEffectiveCategory(t.id, t.name);
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
  }, [templates, selectedCategory, userSettings, searchQuery]);

  // Count templates per category - includes user-defined categories
  const categoryCounts = useMemo(() => {
    if (!templates) return { meeting: 0, interview: 0, review: 0, custom: 0 };
    const counts: Record<string, number> = { meeting: 0, interview: 0, review: 0, custom: 0 };

    // Count user-defined category assignments
    userSettings.customCategories.forEach(cat => {
      counts[cat] = 0;
    });

    // Single pass through templates
    templates.forEach(t => {
      if (t.isCustom) {
        counts.custom++;
      } else {
        const effectiveCategory = getEffectiveCategory(t.id, t.name);
        if (counts[effectiveCategory] !== undefined) {
          counts[effectiveCategory]++;
        }
      }
    });

    return counts;
  }, [templates, userSettings]);

  const isLoading = transcript === undefined || templates === undefined;
  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);

  // Handle analyze button click
  const handleAnalyze = useCallback(async () => {
    if (!transcript || !selectedTemplate) {
      notifications.show({
        title: 'Error',
        message: 'Please select a template first.',
        color: 'red',
      });
      return;
    }

    // Get supplemental content if enabled and template supports it
    const supplementalContent = selectedTemplate.supportsSupplementalMaterial
      ? supplementalUpload.getSupplementalContent()
      : undefined;

    const analysis = await analyzeTranscript(
      transcript,
      selectedTemplate,
      selectedStrategy,
      runEvaluation,
      supplementalContent
    );

    if (analysis) {
      notifications.show({
        title: 'Analysis Complete',
        message: 'Your transcript has been analyzed successfully.',
        color: 'green',
      });
    } else if (state.error && !state.error.includes('cancelled')) {
      notifications.show({
        title: 'Analysis Failed',
        message: state.error,
        color: 'red',
      });
    }
  }, [transcript, selectedTemplate, selectedStrategy, runEvaluation, analyzeTranscript, state.error, supplementalUpload]);

  // Handle retry after error
  const handleRetry = useCallback(() => {
    clearAnalysis();
  }, [clearAnalysis]);

  // Handle cancel analysis
  const handleCancel = useCallback(() => {
    cancelAnalysis();
    notifications.show({
      title: 'Analysis Cancelled',
      message: 'The analysis has been cancelled.',
      color: 'blue',
    });
  }, [cancelAnalysis]);


  // Loading state
  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          <Stack align="center" gap="md">
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--aph-blue)' }} />
            <Text size="sm" c="dimmed">Loading...</Text>
          </Stack>
        </Box>
      </Container>
    );
  }

  // Error state - transcript not found
  if (!transcript) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="xl" style={{ maxWidth: 600, margin: '0 auto' }}>
          <Button
            component={Link}
            href="/transcripts"
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            styles={{ root: { minHeight: 44, width: 'fit-content' } }}
          >
            Back to Transcripts
          </Button>

          <Alert
            variant="light"
            color="red"
            title="Transcript Not Found"
            icon={<AlertCircle size={16} />}
          >
            The transcript you&apos;re trying to analyze doesn&apos;t exist or may have been deleted.
          </Alert>

          <Box style={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              component={Link}
              href="/transcripts"
              styles={{ root: { minHeight: 44 } }}
            >
              View All Transcripts
            </Button>
          </Box>
        </Stack>
      </Container>
    );
  }

  // Error state - no templates
  if (!templates || templates.length === 0) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="xl" style={{ maxWidth: 600, margin: '0 auto' }}>
          <Button
            component={Link}
            href={`/transcripts/${transcriptId}`}
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            styles={{ root: { minHeight: 44, width: 'fit-content' } }}
          >
            Back to Transcript
          </Button>

          <Alert
            variant="light"
            color="red"
            title="No Templates Available"
            icon={<AlertCircle size={16} />}
          >
            No analysis templates are available. Please create a template first.
          </Alert>

          <Group justify="center" gap="md">
            <Button
              component={Link}
              href="/templates"
              styles={{ root: { minHeight: 44 } }}
            >
              Manage Templates
            </Button>
            <Button
              component={Link}
              href={`/transcripts/${transcriptId}`}
              variant="outline"
              styles={{ root: { minHeight: 44 } }}
            >
              Back to Transcript
            </Button>
          </Group>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Back Button */}
        <Button
          component={Link}
          href={`/transcripts/${transcriptId}`}
          variant="subtle"
          leftSection={<ArrowLeft size={16} />}
          styles={{ root: { minHeight: 44, width: 'fit-content' } }}
        >
          Back to Transcript
        </Button>

        {/* Page Header */}
        <Stack gap="xs">
          <Group gap="md">
            <Brain size={32} color="var(--aph-blue)" />
            <div>
              <Title order={1} size="h1">
                Analyze Transcript
              </Title>
              <Text c="dimmed" size="sm">
                {transcript.filename}
              </Text>
            </div>
          </Group>
        </Stack>

        <Divider />

        {/* Token count and deployment info */}
        {transcript && (
          (() => {
            const deploymentInfo = getDeploymentInfo(estimateTokens(transcript.text));
            const {isExtended, isHighUtilization} = deploymentInfo;
            const isCritical = deploymentInfo.isCriticalUtilization;

            return (
              <Alert
                variant="light"
                color={isExtended ? 'cyan' : 'blue'}
                title={
                  <Group gap="xs">
                    {isExtended ? 'Extended Context Analysis' : 'Transcript Size'}
                    <Badge
                      variant="light"
                      color={isExtended ? 'cyan' : 'blue'}
                      size="sm"
                    >
                      {isExtended ? 'GPT-41' : 'GPT-5'}
                    </Badge>
                  </Group>
                }
                icon={isExtended ? <Zap size={16} /> : <Info size={16} />}
              >
                <Stack gap="md">
                  <Text size="sm">
                    This transcript is approximately{' '}
                    <Text component="span" fw={600}>
                      {formatTokenCount(deploymentInfo.estimatedTokens)}
                    </Text>
                    .
                    {isExtended ? (
                      <>
                        {' '}Using{' '}
                        <Text component="span" fw={600}>
                          {deploymentInfo.deployment}
                        </Text>{' '}
                        deployment with extended context (up to{' '}
                        {deploymentInfo.tokenLimit.toLocaleString()} tokens).
                      </>
                    ) : (
                      <>
                        {' '}Using{' '}
                        <Text component="span" fw={600}>
                          {deploymentInfo.deployment}
                        </Text>{' '}
                        deployment (up to {deploymentInfo.tokenLimit.toLocaleString()} tokens).
                      </>
                    )}
                  </Text>

                  {/* Progress bar showing token utilization */}
                  <Box>
                    <Group justify="space-between" mb={4}>
                      <Text size="xs" c="dimmed">
                        Token Utilization
                      </Text>
                      <Text
                        size="xs"
                        c={isCritical ? 'red' : isHighUtilization ? 'orange' : 'dimmed'}
                        fw={isCritical || isHighUtilization ? 600 : 400}
                      >
                        {deploymentInfo.utilizationPercentage}%
                      </Text>
                    </Group>
                    <Progress
                      value={deploymentInfo.utilizationPercentage}
                      color={isCritical ? 'red' : isHighUtilization ? 'orange' : 'blue'}
                      size="sm"
                    />
                  </Box>

                  {/* Warning for high utilization */}
                  {isCritical && (
                    <Text size="sm" c="red" fw={500}>
                      ⚠️ Critical: Transcript is using {deploymentInfo.utilizationPercentage}% of
                      token limit. Analysis may exceed limits. Consider preprocessing the
                      transcript.
                    </Text>
                  )}
                  {isHighUtilization && !isCritical && (
                    <Text size="sm" c="orange" fw={500}>
                      ⚠️ Warning: High token usage ({deploymentInfo.utilizationPercentage}%).
                      Monitor for potential token limit issues.
                    </Text>
                  )}

                  {isExtended && !isHighUtilization && (
                    <Text size="sm" c="dimmed">
                      ✓ Extended context deployment can handle transcripts up to 1 million tokens.
                    </Text>
                  )}
                </Stack>
              </Alert>
            );
          })()
        )}

        {/* Template Selection (only show if no analysis in progress/complete) */}
        {!state.analysis && !state.loading && (
          <Stack gap="md" data-template-selection data-tour-id="template-selector">
            <div>
              <Title order={2} size="h2" mb="xs">
                Select Review Template
              </Title>
              <Text size="sm" c="dimmed">
                Choose a template and configure analysis strategy
              </Text>
            </div>

            {/* Search Input */}
            <TextInput
              placeholder="Search templates..."
              leftSection={<Search size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              styles={{ input: { minHeight: 44 } }}
            />

            {/* Category Selector with SegmentedControl - includes user-defined categories */}
            <SegmentedControl
              value={selectedCategory}
              onChange={setSelectedCategory}
              data={[
                { label: `Reviews (${categoryCounts.review})`, value: 'review' },
                { label: `Meetings (Legacy) (${categoryCounts.meeting})`, value: 'meeting' },
                { label: `Interviews (${categoryCounts.interview})`, value: 'interview' },
                // User-defined categories
                ...userSettings.customCategories.map(cat => ({
                  label: `${cat} (${categoryCounts[cat] || 0})`,
                  value: cat,
                })),
                { label: `My Templates (${categoryCounts.custom})`, value: 'custom' }
              ]}
              size="sm"
              style={{ minHeight: 44, overflowX: 'auto' }}
            />

            {/* Phase 3: Responsive Grid with SimpleGrid */}
            <SimpleGrid
              cols={{ base: 2, sm: 2, md: 3, lg: 4 }}
              spacing={{ base: 'xs', sm: 'sm', md: 'md' }}
              verticalSpacing={{ base: 'xs', sm: 'sm' }}
            >
              {filteredTemplates.map((template) => (
                <CompactTemplateCard
                  key={template.id}
                  template={template}
                  selected={selectedTemplateId === template.id}
                  onSelect={() => setSelectedTemplateId(template.id)}
                />
              ))}
            </SimpleGrid>

            {/* Phase 5: Selected Template Preview */}
            {selectedTemplate && (
              <Paper p="md" withBorder style={{ backgroundColor: 'rgba(68, 73, 156, 0.04)' }}>
                <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
                  <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs" wrap="nowrap">
                      <ThemeIcon size="sm" variant="light" color="blue" style={{ flexShrink: 0 }}>
                        <Info size={16} />
                      </ThemeIcon>
                      <Text size="sm" fw={600} style={{ wordBreak: 'break-word' }}>{selectedTemplate.name}</Text>
                    </Group>
                    <Text size="xs" c="dimmed" style={{ wordBreak: 'break-word' }}>{selectedTemplate.description}</Text>
                  </Stack>
                  <Button
                    size="xs"
                    variant="subtle"
                    rightSection={<ExternalLink size={14} />}
                    onClick={() => setViewingTemplate(selectedTemplate)}
                    style={{ minHeight: 36, flexShrink: 0 }}
                  >
                    Details
                  </Button>
                </Group>
              </Paper>
            )}

            {/* Supplemental Material Upload - only for templates that support it */}
            {selectedTemplate?.supportsSupplementalMaterial && transcript && (
              <SupplementalUpload
                enabled={supplementalUpload.isEnabled}
                onEnabledChange={supplementalUpload.setEnabled}
                documents={supplementalUpload.documents}
                pastedText={supplementalUpload.pastedText}
                pastedTextTokens={supplementalUpload.pastedTextTokens}
                totalTokens={supplementalUpload.totalTokens}
                isProcessing={supplementalUpload.isProcessing}
                onAddFiles={supplementalUpload.addFiles}
                onRemoveDocument={supplementalUpload.removeDocument}
                onPastedTextChange={supplementalUpload.setPastedText}
                transcriptTokens={estimateTokens(transcript.text)}
                disabled={state.loading}
              />
            )}

            <Divider />

            {/* Strategy Selector - Compact Mode */}
            {selectedTemplateId && transcript && (
              <StrategySelector
                data-tour-id="strategy-selector"
                transcriptText={transcript.text}
                value={selectedStrategy}
                onChange={setSelectedStrategy}
                runEvaluation={runEvaluation}
                onEvaluationChange={setRunEvaluation}
                compact
              />
            )}

            {/* Analyze Button */}
            <Box style={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                size="lg"
                data-tour-id="run-analysis-button"
                onClick={handleAnalyze}
                disabled={!selectedTemplateId}
                leftSection={<Sparkles size={20} />}
                styles={{ root: { minHeight: 44 } }}
              >
                {existingAnalyses.length > 0 ? 'Re-Analyze Transcript' : 'Analyze Transcript'}
              </Button>
            </Box>
          </Stack>
        )}

        {/* Analysis Progress */}
        {state.loading && state.progress && selectedTemplate && (
          <AnalysisProgressCard
            progress={state.progress}
            resolvedStrategy={state.resolvedStrategy}
            selectedStrategy={selectedStrategy}
            template={selectedTemplate}
            runEvaluation={runEvaluation}
            phasesExpanded={phasesExpanded}
            onPhasesExpandedChange={setPhasesExpanded}
            onCancel={handleCancel}
          />
        )}

        {/* Error State - Improved with Recovery Options */}
        {state.error && !state.loading && (
          <Card padding="lg" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-red-4)' }}>
            <Stack gap="md">
              <Group gap="sm" align="flex-start">
                <AlertCircle size={24} color="var(--mantine-color-red-6)" />
                <div style={{ flex: 1 }}>
                  <Title order={4} size="h5" c="red" mb="xs">
                    {state.error.includes('cancelled') ? 'Analysis Cancelled' : 'Analysis Failed'}
                  </Title>
                  <Text size="sm" c="dimmed" mb="sm">
                    {state.error}
                  </Text>

                  {/* Helpful suggestions based on error type */}
                  {!state.error.includes('cancelled') && (
                    <Box
                      p="md"
                      mb="md"
                      style={{
                        backgroundColor: 'rgba(250, 179, 174, 0.1)',
                        borderRadius: '8px',
                        border: '1px solid var(--mantine-color-red-2)',
                      }}
                    >
                      <Text size="sm" fw={500} mb="xs">
                        What to try:
                      </Text>
                      <Stack gap="xs">
                        <Group gap="xs">
                          <Text size="xs">•</Text>
                          <Text size="xs">Check your internet connection</Text>
                        </Group>
                        <Group gap="xs">
                          <Text size="xs">•</Text>
                          <Text size="xs">Try a different template with fewer sections</Text>
                        </Group>
                        <Group gap="xs">
                          <Text size="xs">•</Text>
                          <Text size="xs">Ensure the transcript isn&apos;t too long (check token usage above)</Text>
                        </Group>
                        {(state.error.includes('token') || state.error.includes('limit')) && (
                          <Group gap="xs">
                            <Text size="xs">•</Text>
                            <Text size="xs" fw={600}>The transcript may exceed AI model limits - consider shortening it</Text>
                          </Group>
                        )}
                      </Stack>
                    </Box>
                  )}

                  {/* Action Buttons */}
                  <Group gap="sm">
                    <Button
                      onClick={handleRetry}
                      color="red"
                      variant="filled"
                      leftSection={<RefreshCw size={16} />}
                      styles={{ root: { minHeight: 40 } }}
                    >
                      {state.error.includes('cancelled') ? 'Start New Analysis' : 'Retry Analysis'}
                    </Button>
                    {!state.error.includes('cancelled') && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Scroll to template selection
                          const templateSection = document.querySelector('[data-template-selection]');
                          if (templateSection) {
                            templateSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                          clearAnalysis();
                        }}
                        styles={{ root: { minHeight: 40 } }}
                      >
                        Try Different Template
                      </Button>
                    )}
                    <Button
                      component={Link}
                      href={`/transcripts/${transcriptId}`}
                      variant="subtle"
                      styles={{ root: { minHeight: 40 } }}
                    >
                      Back to Transcript
                    </Button>
                  </Group>
                </div>
              </Group>
            </Stack>
          </Card>
        )}

        {/* Analysis Results */}
        {state.analysis && transcript && selectedTemplate && (
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap">
              <Group gap="md">
                <Title order={2} size="h2">
                  Analysis Results
                </Title>
                {state.analysis.analysisStrategy && (
                  <StrategyBadge
                    strategy={state.analysis.analysisStrategy}
                    wasAutoSelected={state.analysis.metadata?.wasAutoSelected}
                    metadata={state.analysis.metadata}
                  />
                )}
              </Group>
              <AnalysisExportMenu
                analysis={state.analysis}
                transcript={transcript}
                template={selectedTemplate}
                onOpenOptions={openExportOptions}
                variant="outline"
              />
            </Group>

            <AnalysisViewer
              analysis={state.analysis}
              template={selectedTemplate}
              showDraftResults={evaluationView === 'draft'}
            />

            {/* Evaluation Display */}
            {state.analysis.evaluation && state.analysis.draftResults && (
              <EvaluationDisplay
                evaluation={state.analysis.evaluation}
                draftResults={state.analysis.draftResults}
                finalResults={state.analysis.results}
                currentView={evaluationView}
                onViewChange={setEvaluationView}
              />
            )}
          </Stack>
        )}
      </Stack>

      {/* Template Details Modal */}
      <Modal
        opened={!!viewingTemplate}
        onClose={() => setViewingTemplate(null)}
        title={
          <Group gap="sm">
            <ThemeIcon variant="light" size="lg" color="blue" radius="md">
              <Brain size={20} />
            </ThemeIcon>
            <Stack gap={0}>
              <Title order={3} size="h4">
                {viewingTemplate?.name}
              </Title>
              <Text size="xs" c="dimmed" fw={500}>
                TEMPLATE DETAILS
              </Text>
            </Stack>
          </Group>
        }
        size="lg"
        centered
        scrollAreaComponent={ScrollArea.Autosize}
        radius="md"
        padding="xl"
        styles={{
          header: { 
            paddingBottom: 20, 
            borderBottom: '1px solid var(--mantine-color-gray-2)',
            marginBottom: 0 
          },
          body: { 
            paddingTop: 24 
          },
          title: {
            width: '100%'
          }
        }}
      >
        {viewingTemplate && <TemplateDetail template={viewingTemplate} />}
      </Modal>

      {/* Export Options Modal */}
      {state.analysis && transcript && selectedTemplate && (
        <ExportOptionsModal
          opened={exportOptionsOpened}
          onClose={closeExportOptions}
          analysis={state.analysis}
          transcript={transcript}
          template={selectedTemplate}
        />
      )}
    </Container>
  );
}
