/**
 * Home Page
 *
 * Landing page for the Austin RTASS application.
 * Displays hero section with quick actions and recent transcripts.
 */

"use client";

import * as React from "react";
import { Container, Stack, Space } from "@mantine/core";
import { HeroSection } from "@/components/home/hero-section";
import { RecentTranscripts } from "@/components/home/recent-transcripts";
import { useTranscripts } from "@/hooks/use-transcripts";
import { notifications } from "@mantine/notifications";

export default function HomePage() {
  const [isConfigured, setIsConfigured] = React.useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = React.useState(true);

  // Load recent transcripts (limit to 6 for homepage)
  const { transcripts, isLoading: isLoadingTranscripts } = useTranscripts();
  const recentTranscripts = React.useMemo(
    () => transcripts.slice(0, 6),
    [transcripts]
  );

  // Check if OpenAI is configured
  React.useEffect(() => {
    const checkConfig = async () => {
      try {
        const response = await fetch("/api/transcribe");
        const data = await response.json();
        setIsConfigured(data.success);
      } catch (error) {
        console.error("Failed to check configuration:", error);
        setIsConfigured(false);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    checkConfig();
  }, []);

  const handleConfigureClick = () => {
    notifications.show({
      title: "Configuration Required",
      message: "Please set up your Azure OpenAI credentials in the .env.local file.",
      color: "blue",
      autoClose: 5000,
    });
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <HeroSection
          isLoadingConfig={isLoadingConfig}
          isConfigured={isConfigured}
          onConfigureClick={handleConfigureClick}
        />

        <Space h="md" />

        <RecentTranscripts
          transcripts={recentTranscripts}
          isLoading={isLoadingTranscripts}
          isLoadingConfig={isLoadingConfig}
          isConfigured={isConfigured}
          onConfigureClick={handleConfigureClick}
        />
      </Stack>
    </Container>
  );
}
