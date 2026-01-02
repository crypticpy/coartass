'use client';

import {
  Stack,
  Title,
  Text,
  Paper,
  Badge,
  Group,
  List,
  ThemeIcon,
  Divider,
  Box,
  Anchor,
  Alert,
} from "@mantine/core";
import {
  Rocket,
  Bug,
  Sparkles,
  Shield,
  FileText,
  Zap,
  Check,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface ChangeItem {
  type: 'feature' | 'fix' | 'improvement' | 'security' | 'docs' | 'breaking';
  description: string;
  details?: string[];
}

interface VersionEntry {
  version: string;
  date: string;
  title: string;
  highlights?: string;
  changes: ChangeItem[];
}

const typeConfig = {
  feature: { icon: Sparkles, color: 'green', label: 'New Feature' },
  fix: { icon: Bug, color: 'red', label: 'Bug Fix' },
  improvement: { icon: Zap, color: 'blue', label: 'Improvement' },
  security: { icon: Shield, color: 'orange', label: 'Security' },
  docs: { icon: FileText, color: 'gray', label: 'Documentation' },
  breaking: { icon: AlertTriangle, color: 'red', label: 'Breaking Change' },
};

function ChangeTypeIcon({ type }: { type: ChangeItem['type'] }) {
  const config = typeConfig[type];
  const Icon = config.icon;
  return (
    <ThemeIcon size={20} variant="light" color={config.color} radius="xl">
      <Icon size={12} />
    </ThemeIcon>
  );
}

function VersionCard({ entry }: { entry: VersionEntry }) {
  return (
    <Paper p="lg" withBorder radius="md" id={`v${entry.version.replace(/\./g, '-')}`}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Group gap="sm">
            <Badge size="lg" variant="filled" color="aphBlue">
              v{entry.version}
            </Badge>
            <Title order={3} size="h4">
              {entry.title}
            </Title>
          </Group>
          <Group gap="xs">
            <Clock size={14} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed">
              {entry.date}
            </Text>
          </Group>
        </Group>

        {entry.highlights && (
          <Text size="sm" c="dimmed" fs="italic">
            {entry.highlights}
          </Text>
        )}

        <Divider />

        <List spacing="sm" size="sm">
          {entry.changes.map((change, index) => (
            <List.Item
              key={index}
              icon={<ChangeTypeIcon type={change.type} />}
            >
              <Stack gap={4}>
                <Group gap="xs">
                  <Badge size="xs" variant="light" color={typeConfig[change.type].color}>
                    {typeConfig[change.type].label}
                  </Badge>
                  <Text size="sm" fw={500}>
                    {change.description}
                  </Text>
                </Group>
                {change.details && change.details.length > 0 && (
                  <List size="xs" withPadding>
                    {change.details.map((detail, detailIndex) => (
                      <List.Item key={detailIndex}>
                        <Text size="xs" c="dimmed">
                          {detail}
                        </Text>
                      </List.Item>
                    ))}
                  </List>
                )}
              </Stack>
            </List.Item>
          ))}
        </List>
      </Stack>
    </Paper>
  );
}

const versionHistory: VersionEntry[] = [
  {
    version: '0.12.5',
    date: '2025-12-31',
    title: 'Azure AD CSP Fix',
    highlights: 'Fixed Content Security Policy blocking Azure AD authentication.',
    changes: [
      {
        type: 'fix',
        description: 'CSP Azure AD Login Support',
        details: [
          'Added login.windows.net and login.microsoftonline.com to connect-src',
          'Fixes RSC payload fetch failures during Azure AD authentication',
        ],
      },
    ],
  },
  {
    version: '0.12.4',
    date: '2025-12-31',
    title: 'Changelog & Deployment Update',
    highlights: 'Added version history entries for recent fixes.',
    changes: [
      {
        type: 'docs',
        description: 'Changelog Updates',
        details: [
          'Added version history for v0.12.1, v0.12.2, v0.12.3 fixes',
          'Documented large file transcription improvements',
        ],
      },
    ],
  },
  {
    version: '0.12.3',
    date: '2025-12-31',
    title: 'Large File Transcription Fix',
    highlights: 'Critical fix ensuring long audio and video files are properly split when duration detection fails.',
    changes: [
      {
        type: 'fix',
        description: 'Force Split for Large Files',
        details: [
          'Files >10MB now force-trigger audio splitting regardless of detected duration',
          'Fallback duration estimation from file size (MP3 at 64kbps = ~8KB/sec)',
          'Applies to both video AND audio files (Teams recordings, long meetings)',
          'Fixes 503 timeouts for 70+ minute meeting recordings',
        ],
      },
    ],
  },
  {
    version: '0.12.2',
    date: '2025-12-31',
    title: 'Audio Splitting Threshold',
    highlights: 'Lowered audio splitting threshold to prevent API timeouts.',
    changes: [
      {
        type: 'improvement',
        description: 'Reduced Splitting Threshold',
        details: [
          'MAX_WHISPER_DURATION lowered from 20 minutes to 10 minutes',
          'Ensures audio chunks complete within diarization API timeout',
          'Prevents "danger zone" where 10-20 minute files weren\'t split',
        ],
      },
    ],
  },
  {
    version: '0.12.1',
    date: '2025-12-31',
    title: 'Diarization Timeout Increase',
    highlights: 'Extended API timeout for long audio transcription.',
    changes: [
      {
        type: 'fix',
        description: 'Extended Diarization Timeout',
        details: [
          'Increased timeout from 2 minutes to 5 minutes (300 seconds)',
          'Supports longer audio chunks during transcription with speaker diarization',
          'Prevents 503 errors after ~6 minutes (3 retries × 2 min timeout)',
        ],
      },
    ],
  },
  {
    version: '0.12.0',
    date: '2025-12-30',
    title: 'YAML Templates & Analysis Polish',
    highlights: 'Major template system refactor with YAML-based configuration, plus analysis output formatting improvements for cleaner copy/paste.',
    changes: [
      {
        type: 'feature',
        description: 'YAML Template System',
        details: [
          'Templates now defined in YAML files for easier customization',
          'Build-time template compilation with validation',
          'Structured section definitions with output format hints',
          'Backward-compatible with existing JSON templates',
        ],
      },
      {
        type: 'improvement',
        description: 'Executive Summary Timestamp Stripping',
        details: [
          'Timestamps removed from Executive Summary for clean copy/paste',
          'Timestamps preserved in detailed sections and action items for reference',
          'Applied consistently across all export formats (PDF, DOCX, TXT)',
          'JSON export unchanged for programmatic data interchange',
        ],
      },
      {
        type: 'improvement',
        description: 'Structured Data Formatting',
        details: [
          'Pipe-delimited key-value pairs rendered as styled badges',
          'Q&A format detection with distinct question/answer styling',
          'Improved bullet point and nested list rendering',
          'Better handling of section content variations',
        ],
      },
      {
        type: 'improvement',
        description: 'Mic Level Check UX',
        details: [
          'Debounced auto-advance to prevent accidental skips',
          'Requires 2 seconds of sustained good audio levels',
          'Clearer feedback during level detection',
        ],
      },
      {
        type: 'fix',
        description: 'Docker Build Template Support',
        details: [
          'Fixed build-templates.mjs exclusion from Docker context',
          'Added data/templates/ directory to build context',
          'Ensures YAML templates compile correctly in container builds',
        ],
      },
      {
        type: 'improvement',
        description: 'Visual Polish',
        details: [
          'Warm eggshell background for improved readability',
          'Consistent styling across analysis viewer components',
        ],
      },
    ],
  },
  {
    version: '0.11.0',
    date: '2025-12-29',
    title: 'Package Export/Import & GPT-5.2 Progress',
    highlights: 'Export transcripts with analyses as portable packages, improved progress tracking, and robust AI output handling.',
    changes: [
      {
        type: 'feature',
        description: 'Package Export/Import System',
        details: [
          'Export transcripts with all analyses as a single .mtpackage file',
          'Import packages to restore transcripts and analyses on any device',
          'Comprehensive Zod validation ensures data integrity on import',
          'Supports sharing transcripts between team members',
        ],
      },
      {
        type: 'improvement',
        description: 'GPT-5.2 Progress Tracking',
        details: [
          'Extracted AnalysisProgressCard component for cleaner code',
          'Phase timeline shows strategy-specific progress stages',
          'Real-time progress updates with time remaining estimates',
          'Accessibility improvements with proper ARIA attributes',
        ],
      },
      {
        type: 'fix',
        description: 'AI Evidence Repair',
        details: [
          'Malformed AI evidence arrays now automatically repaired before saving',
          'Handles null, undefined, and incomplete evidence objects from AI',
          'Prevents "Invalid input" errors during package import',
          'Evidence normalized with sensible defaults (empty text filtered out)',
        ],
      },
      {
        type: 'improvement',
        description: 'Validation Schema Robustness',
        details: [
          'Optional fields accept both null and undefined (.nullish())',
          'Required fields use transforms to provide defaults',
          'Prevents schema validation failures from AI output variations',
        ],
      },
    ],
  },
  {
    version: '0.10.1',
    date: '2025-12-28',
    title: 'Demo Data Isolation',
    highlights: 'Critical fix preventing tour demo data from polluting user transcript lists.',
    changes: [
      {
        type: 'fix',
        description: 'Demo Data Cleanup',
        details: [
          'Tour demo data now automatically cleaned up when tour ends',
          'Demo data cleared before loading to prevent accumulation',
          'Component unmount cleanup for interrupted tours',
          'Filtered demo transcripts from all user-facing lists',
        ],
      },
      {
        type: 'improvement',
        description: 'Tour Robustness',
        details: [
          'Added beforeunload handler for interrupted tours',
          'Added visibility change detection during tours',
          'Demo data helpers (hasDemoData, getDemoDataCount, clearAllDemoData)',
        ],
      },
    ],
  },
  {
    version: '0.10.0',
    date: '2025-12-28',
    title: 'Recording Performance & Mic Level Check',
    highlights: 'Major performance optimizations for constrained hardware plus pre-recording microphone verification.',
    changes: [
      {
        type: 'feature',
        description: 'Pre-recording Microphone Level Check',
        details: [
          'Real-time LED-style audio level visualization before recording',
          'Auto-advance after 2 seconds of good audio levels detected',
          'Detects muted microphones, low audio levels, and permission issues',
          'Browser-specific error messages with clear remediation steps',
          '"Skip this check" preference saved to localStorage',
          'Full keyboard accessibility (Enter to continue, Escape to cancel)',
        ],
      },
      {
        type: 'improvement',
        description: 'Recording Performance Optimizations',
        details: [
          'Audio visualization throttled from 60fps to 15fps (75% CPU reduction)',
          'Timer updates reduced from 100ms to 1000ms intervals',
          'MediaRecorder bitrate capped at 96kbps for efficient storage',
          '30-minute recording duration warning to prevent memory issues',
        ],
      },
      {
        type: 'improvement',
        description: 'Comprehensive Test Coverage',
        details: [
          '54 new tests added (75 total tests passing)',
          'MediaRecorder, MediaDevices, and Web Audio API mocks',
          'Tests for throttling, cleanup, accessibility, and error handling',
        ],
      },
      {
        type: 'feature',
        description: 'Version History Page',
        details: [
          'Comprehensive changelog accessible from footer',
          'Categorized changes by type (features, fixes, security, etc.)',
        ],
      },
    ],
  },
  {
    version: '0.9.9',
    date: '2025-12-28',
    title: 'Interactive Documentation System',
    highlights: 'Guided tours with auto-loading demo data for learning the application.',
    changes: [
      {
        type: 'feature',
        description: 'Interactive Tour Guides',
        details: [
          'Step-by-step spotlight tours for all major features',
          'Auto-loading demo transcripts and analyses for tours',
          'Tour system with keyboard navigation support',
        ],
      },
      {
        type: 'feature',
        description: 'Documentation Hub',
        details: [
          'Architecture & Security reference page',
          'Best Practices guide for better transcriptions',
          'Accessible from navigation and footer',
        ],
      },
      {
        type: 'docs',
        description: 'Comprehensive Security Documentation',
        details: [
          'Audio segmentation security (5-min chunks at silence boundaries)',
          'Filename obfuscation with UUIDs before transmission',
          'Client-side only reassembly of complete transcripts',
          'Infrastructure control documentation (Azure backbone)',
        ],
      },
    ],
  },
  {
    version: '0.9.8',
    date: '2025-12-28',
    title: 'FFmpeg WASM Support',
    highlights: 'Fixed Content Security Policy for client-side audio processing.',
    changes: [
      {
        type: 'fix',
        description: 'CSP Configuration for FFmpeg WASM',
        details: [
          'Added wasm-unsafe-eval for WebAssembly compilation',
          'Added blob: to script-src for WASM worker scripts',
          'Fixed middleware CSP override that blocked FFmpeg',
        ],
      },
    ],
  },
  {
    version: '0.9.7',
    date: '2025-12-28',
    title: 'Evidence Citations',
    highlights: 'LLM-powered citation extraction linking analysis to transcript evidence.',
    changes: [
      {
        type: 'feature',
        description: 'Transcript Evidence Citations',
        details: [
          'View Supporting Evidence feature for analysis sections',
          'GPT-4.1-mini powered citation extraction',
          'Links each analysis finding to specific transcript excerpts',
        ],
      },
      {
        type: 'security',
        description: 'Production Hardening',
        details: [
          'DoS protection with input size limits on citations endpoint',
          'Rate limiter memory leak fix with periodic cleanup',
          'Log sanitization to prevent injection attacks',
          'Request correlation IDs for debugging',
        ],
      },
    ],
  },
  {
    version: '0.9.6',
    date: '2025-12-28',
    title: 'Analysis Improvements',
    highlights: 'Parallel section processing and timeout resilience.',
    changes: [
      {
        type: 'improvement',
        description: 'Parallel Analysis Processing',
        details: [
          'Dependency-aware parallel section execution',
          '504 gateway timeout prevention with time tracking',
          'Extended context support for transcripts over 256k tokens',
        ],
      },
      {
        type: 'fix',
        description: 'Memory and Stability Fixes',
        details: [
          'XHR and AbortSignal event listener cleanup',
          'Chat history truncation to prevent token overflow',
          'Video element resource cleanup on timeout',
        ],
      },
    ],
  },
  {
    version: '0.9.5',
    date: '2025-12-28',
    title: 'MP4 Video Support',
    highlights: 'Support for Microsoft Teams and other video recording formats.',
    changes: [
      {
        type: 'feature',
        description: 'MP4 Video File Support',
        details: [
          'Teams meeting recordings now supported',
          'Audio extracted automatically from video files',
        ],
      },
    ],
  },
  {
    version: '0.9.4',
    date: '2025-12-28',
    title: 'CSP Security Fixes',
    highlights: 'Content Security Policy fixes for audio playback.',
    changes: [
      {
        type: 'fix',
        description: 'Audio Playback CSP Fix',
        details: [
          'Added blob: to connect-src for WaveSurfer audio fetch',
          'Fixed evidence timestamp parsing for [time1]-[time2] format',
        ],
      },
    ],
  },
  {
    version: '0.9.3',
    date: '2025-12-26',
    title: 'Security Architecture & Robustness',
    highlights: 'Comprehensive security documentation, CSP implementation, and transcription pipeline hardening.',
    changes: [
      {
        type: 'security',
        description: 'Security Architecture Implementation',
        details: [
          'CSP headers with configurable CORS policy',
          'ISO-friendly security architecture documentation',
          'Security review feedback addressed',
        ],
      },
      {
        type: 'improvement',
        description: 'Transcription Pipeline Robustness',
        details: [
          'Comprehensive recording and transcription audit',
          'Error handling improvements across the pipeline',
          'Docker compose command updated (deprecated docker-compose removed)',
        ],
      },
      {
        type: 'docs',
        description: 'Versioned Tag Deployment',
        details: [
          'Use package.json version for Docker tags instead of :latest',
          ':latest tag caching causes silent stale deployments',
          'Added verification commands for deployment status',
        ],
      },
    ],
  },
  {
    version: '0.9.2',
    date: '2025-12-10',
    title: 'Timestamp Fix',
    highlights: 'Critical fix for timestamp preservation in analysis.',
    changes: [
      {
        type: 'fix',
        description: 'Timestamp NaN in Evaluation Pass',
        details: [
          'Fixed timestamps becoming NaN after self-evaluation pass',
          'Added strict timestamp validation for nested arrays',
          'Added timestamp recovery from draft results',
        ],
      },
    ],
  },
  {
    version: '0.9.1',
    date: '2025-12-09',
    title: 'Upload & Timestamp Improvements',
    highlights: 'Better upload progress tracking, timestamp handling, and transcription UX.',
    changes: [
      {
        type: 'fix',
        description: 'Upload Progress Status',
        details: [
          'Fixed UI stuck on "Uploading..." during transcription',
          'Changed multi-part messages to "Uploading X audio chunks..."',
        ],
      },
      {
        type: 'fix',
        description: 'Timestamp Preservation',
        details: [
          'Fixed self-evaluation wiping out timestamps',
          'Enhanced extraction with explicit conversion rules',
        ],
      },
      {
        type: 'improvement',
        description: 'Transcription UX',
        details: [
          'Audio duration validation before upload',
          'Better error messages for invalid files',
          'CI workflow fixes for reliable builds',
        ],
      },
      {
        type: 'security',
        description: 'Security Updates',
        details: [
          'Updated base Docker image for CVE vulnerabilities',
          'Recording pipeline unification',
        ],
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2025-11-25',
    title: 'Initial Production Release',
    highlights: 'First public release with full transcription and analysis capabilities.',
    changes: [
      {
        type: 'feature',
        description: 'Audio Transcription',
        details: [
          'Whisper and GPT-4o Transcribe model support',
          'Multi-language transcription',
          'Speaker diarization',
          'Large file automatic splitting',
        ],
      },
      {
        type: 'feature',
        description: 'AI-Powered Analysis',
        details: [
          'Customizable analysis templates',
          'Action items, decisions, and key points extraction',
          'Extended context support for long transcripts',
        ],
      },
      {
        type: 'feature',
        description: 'Live Recording',
        details: [
          'Microphone recording mode',
          'System audio capture (browser tabs, Zoom, Teams)',
          'Commentary mode (mic + system audio)',
        ],
      },
      {
        type: 'feature',
        description: 'Export & Chat',
        details: [
          'PDF, Markdown, and text exports',
          'Q&A chat interface for transcript queries',
        ],
      },
      {
        type: 'feature',
        description: 'Privacy & Deployment',
        details: [
          'Local-only data storage (IndexedDB)',
          'Docker deployment with Azure Container Apps',
          'Azure OpenAI and standard OpenAI support',
          'Azure Bicep infrastructure templates',
        ],
      },
      {
        type: 'feature',
        description: 'User Interface',
        details: [
          'Dark mode with full theme support',
          'Transcript table view with sorting and filtering',
          'Next.js 15 with App Router',
          'Mantine v8 component library',
        ],
      },
    ],
  },
];

export default function VersionHistoryPage() {
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Group gap="md">
          <ThemeIcon size="xl" variant="light" color="aphBlue" radius="md">
            <Rocket size={24} />
          </ThemeIcon>
          <Box>
            <Title order={1}>Version History</Title>
            <Text c="dimmed" size="lg">
              What&apos;s new in Meeting Transcriber
            </Text>
          </Box>
        </Group>
      </Stack>

      <Alert variant="light" color="aphGreen" icon={<Check size={20} />}>
        <Text size="sm">
          <strong>Current Version:</strong> {versionHistory[0].version} ({versionHistory[0].date})
          {' - '}
          {versionHistory[0].title}
        </Text>
      </Alert>

      {/* Quick Navigation */}
      <Paper p="md" withBorder radius="md" bg="gray.0">
        <Stack gap="sm">
          <Text size="sm" fw={600}>
            Jump to version:
          </Text>
          <Group gap="xs">
            {versionHistory.map((entry) => (
              <Anchor
                key={entry.version}
                href={`#v${entry.version.replace(/\./g, '-')}`}
                size="sm"
              >
                <Badge variant="outline" color="aphBlue" style={{ cursor: 'pointer' }}>
                  v{entry.version}
                </Badge>
              </Anchor>
            ))}
          </Group>
        </Stack>
      </Paper>

      {/* Version Entries */}
      <Stack gap="lg">
        {versionHistory.map((entry) => (
          <VersionCard key={entry.version} entry={entry} />
        ))}
      </Stack>

      {/* Footer Note */}
      <Paper p="lg" withBorder radius="md" bg="aphBlue.0">
        <Stack gap="sm">
          <Group gap="sm">
            <FileText size={20} color="var(--mantine-color-aphBlue-6)" />
            <Text size="sm" fw={600}>
              About This Changelog
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            This changelog follows{' '}
            <Anchor href="https://keepachangelog.com" target="_blank" rel="noopener noreferrer">
              Keep a Changelog
            </Anchor>{' '}
            format and{' '}
            <Anchor href="https://semver.org" target="_blank" rel="noopener noreferrer">
              Semantic Versioning
            </Anchor>
            . Changes are categorized as features, fixes, improvements, security updates, and documentation.
          </Text>
        </Stack>
      </Paper>
    </Stack>
  );
}
