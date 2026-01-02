'use client';

import {
  Stack,
  Title,
  Text,
  Paper,
  List,
  ThemeIcon,
  Group,
  Alert,
} from "@mantine/core";
import {
  Volume2,
  Mic,
  MessageSquare,
  ClipboardList,
  FileAudio,
  Sparkles,
  Lightbulb,
} from "lucide-react";

interface TipSectionProps {
  title: string;
  icon: React.ReactNode;
  tips: string[];
}

function TipSection({ title, icon, tips }: TipSectionProps) {
  return (
    <Paper p="lg" withBorder radius="md">
      <Stack gap="md">
        <Group gap="sm">
          <ThemeIcon size="lg" variant="light" color="aphBlue">
            {icon}
          </ThemeIcon>
          <Title order={3} size="h4">
            {title}
          </Title>
        </Group>
        <List spacing="sm" size="sm">
          {tips.map((tip, index) => (
            <List.Item key={index}>{tip}</List.Item>
          ))}
        </List>
      </Stack>
    </Paper>
  );
}

export default function BestPracticesPage() {
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={1}>Best Practices for Better Transcriptions</Title>
        <Text c="dimmed" size="lg">
          Tips and recommendations to get the most accurate results
        </Text>
      </Stack>

      <Alert
        variant="light"
        color="aphBlue"
        icon={<Lightbulb size={20} />}
        title="Quick Tip"
      >
        The quality of your transcription depends heavily on the quality of your
        audio recording. Following these best practices can significantly
        improve accuracy.
      </Alert>

      <Stack gap="lg">
        <TipSection
          title="Recording Environment"
          icon={<Volume2 size={20} />}
          tips={[
            "Choose a quiet location with minimal background noise",
            "Avoid rooms with echo or hard surfaces that reflect sound",
            "Close windows and doors during recording",
            "Turn off or move away from noisy equipment (fans, AC units)",
            "Consider using acoustic panels or soft furnishings to reduce echo",
          ]}
        />

        <TipSection
          title="Microphone Placement"
          icon={<Mic size={20} />}
          tips={[
            "Position the microphone 6-12 inches from speakers",
            "For group meetings, use a central omnidirectional microphone",
            "Avoid placing the mic near laptop fans or AC vents",
            "Use a pop filter to reduce plosive sounds (p, b, t sounds)",
            "Consider using a dedicated USB microphone for better quality",
          ]}
        />

        <TipSection
          title="Speaking Clearly"
          icon={<MessageSquare size={20} />}
          tips={[
            "Speak at a moderate, steady pace",
            "Avoid talking over each other in group settings",
            "State your name before speaking (helps with speaker identification)",
            "Pause briefly between speakers to help with segmentation",
            "Avoid mumbling or trailing off at the end of sentences",
          ]}
        />

        <TipSection
          title="Meeting Structure"
          icon={<ClipboardList size={20} />}
          tips={[
            "Start with introductions and a clear statement of the meeting purpose",
            "Summarize key points periodically throughout the meeting",
            "End with clear action items and next steps",
            "Repeat important names, dates, and numbers for accuracy",
            "Use an agenda to keep the meeting organized and on track",
          ]}
        />

        <TipSection
          title="File Formats"
          icon={<FileAudio size={20} />}
          tips={[
            "Recommended formats: MP3, M4A, WAV for best compatibility",
            "Supported formats: MP4, WebM, OGG, FLAC, AAC",
            "Files over 25MB are automatically split for processing",
            "Higher bitrate recordings generally produce better results",
            "Avoid heavily compressed or low-quality audio files",
          ]}
        />

        <TipSection
          title="Getting Better Analysis Results"
          icon={<Sparkles size={20} />}
          tips={[
            "Choose the right template for your meeting type (e.g., standup, interview)",
            "Use custom templates for specialized or recurring meeting types",
            "Review and edit transcripts before running analysis if there are errors",
            "Longer transcripts may take more time but produce more detailed analysis",
            "Try different analysis strategies for complex or lengthy meetings",
          ]}
        />
      </Stack>
    </Stack>
  );
}
