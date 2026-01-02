"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Button,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { RubricBuilder } from "@/components/rtass/rubric-builder";
import { getRtassRubricTemplate, saveRtassRubricTemplate } from "@/lib/db";
import type { RtassRubricTemplate } from "@/types/rtass";

/**
 * Edit Rubric Page
 *
 * Form for editing existing custom RTASS rubric templates
 */
export default function EditRubricPage() {
  const router = useRouter();
  const params = useParams();
  const rubricId = params.id as string;

  const [rubric, setRubric] = useState<RtassRubricTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch rubric on mount
  useEffect(() => {
    async function fetchRubric() {
      try {
        const data = await getRtassRubricTemplate(rubricId);
        if (!data) {
          setError("Rubric not found");
        } else {
          setRubric(data);
        }
      } catch (err) {
        console.error("Error fetching rubric:", err);
        setError(err instanceof Error ? err.message : "Failed to load rubric");
      } finally {
        setIsLoading(false);
      }
    }

    if (rubricId) {
      fetchRubric();
    }
  }, [rubricId]);

  const handleSave = async (updatedRubric: RtassRubricTemplate) => {
    await saveRtassRubricTemplate(updatedRubric);
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

        {/* Loading State */}
        {isLoading && (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        )}

        {/* Error State */}
        {error && (
          <Alert color="red" icon={<AlertCircle size={16} />} title="Error">
            {error}
          </Alert>
        )}

        {/* Content */}
        {!isLoading && !error && rubric && (
          <>
            {/* Page Title */}
            <div>
              <Title order={1}>Edit Rubric</Title>
              <Text c="dimmed" size="sm" mt="xs">
                Update &quot;{rubric.name}&quot;
              </Text>
            </div>

            {/* Rubric Builder */}
            <RubricBuilder
              initialRubric={rubric}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </>
        )}
      </Stack>
    </Container>
  );
}
