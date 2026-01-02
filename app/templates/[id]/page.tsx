"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Container, Button, Group, Alert, Loader, Stack, Text } from "@mantine/core";
import { ArrowLeft, Edit, AlertCircle } from "lucide-react";
import { TemplateDetail } from "@/components/templates/template-detail";
import { useTemplate } from "@/hooks/use-templates";

/**
 * Template Detail Page
 *
 * Displays full details of a single template (built-in or custom).
 * Uses the existing TemplateDetail component for consistent rendering.
 */
export default function TemplateDetailPage() {
  const params = useParams();
  const templateId = params.id as string;

  const { template, isLoading, error } = useTemplate(templateId);

  // Loading state
  if (isLoading) {
    return (
      <Container size="xl" py={{ base: 'md', md: 'xl' }}>
        <Stack align="center" py={64}>
          <Loader size="lg" />
          <Text c="dimmed">Loading template...</Text>
        </Stack>
      </Container>
    );
  }

  // Error or not found state
  if (error || !template) {
    return (
      <Container size="xl" py={{ base: 'md', md: 'xl' }}>
        <Alert icon={<AlertCircle size={16} />} title="Template Not Found" color="red">
          {error || "The requested template could not be found."}
        </Alert>
        <Group mt="xl">
          <Link href="/templates">
            <Button variant="default" leftSection={<ArrowLeft size={16} />}>
              Back to Templates
            </Button>
          </Link>
        </Group>
      </Container>
    );
  }

  return (
    <Container size="xl" py={{ base: 'md', md: 'xl' }}>
      <Stack gap="xl">
        {/* Navigation Header */}
        <Group justify="space-between" align="center">
          <Link href="/templates">
            <Button variant="subtle" leftSection={<ArrowLeft size={16} />}>
              Back to Templates
            </Button>
          </Link>

          {/* Only show edit button for custom templates */}
          {template.isCustom && (
            <Link href={`/templates/${template.id}/edit`}>
              <Button variant="default" leftSection={<Edit size={16} />}>
                Edit Template
              </Button>
            </Link>
          )}
        </Group>

        {/* Template Detail Component */}
        <TemplateDetail template={template} />
      </Stack>
    </Container>
  );
}
