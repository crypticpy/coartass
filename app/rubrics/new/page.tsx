"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { ArrowLeft } from "lucide-react";
import { RubricBuilder } from "@/components/rtass/rubric-builder";
import { saveRtassRubricTemplate } from "@/lib/db";
import type { RtassRubricTemplate } from "@/types/rtass";

/**
 * New Rubric Page
 *
 * Form for creating new custom RTASS rubric templates
 */
export default function NewRubricPage() {
  const router = useRouter();

  const handleSave = async (rubric: RtassRubricTemplate) => {
    await saveRtassRubricTemplate(rubric);
    router.push("/rubrics");
  };

  const handleCancel = () => {
    router.push("/rubrics");
  };

  return (
    <Container size="lg" py={{ base: "md", md: "xl" }}>
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Link href="/rubrics">
            <Button variant="subtle" leftSection={<ArrowLeft size={16} />}>
              Back to Rubrics
            </Button>
          </Link>
        </Group>

        {/* Page Title */}
        <div>
          <Title order={1}>Create New Rubric</Title>
          <Text c="dimmed" size="sm" mt="xs">
            Build a custom RTASS rubric template for radio traffic analysis
          </Text>
        </div>

        {/* Rubric Builder */}
        <RubricBuilder onSave={handleSave} onCancel={handleCancel} />
      </Stack>
    </Container>
  );
}
