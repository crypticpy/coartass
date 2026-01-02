"use client";

import Link from "next/link";
import { Card, Text, Title, Badge, Stack, ThemeIcon, Box, Button } from "@mantine/core";
import { Play } from "lucide-react";

interface DocsCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  badge?: string;
  onStartTour?: () => void;
}

export function DocsCard({
  title,
  description,
  icon,
  href,
  badge,
  onStartTour,
}: DocsCardProps) {
  const cardContent = (
    <Card
      padding="lg"
      radius="md"
      withBorder
      style={{
        cursor: href ? "pointer" : "default",
        transition: "all 150ms ease",
        height: "100%",
      }}
      className={href ? "hover:shadow-md hover:-translate-y-0.5" : ""}
    >
      <Stack gap="md" style={{ height: "100%" }}>
        <Box style={{ position: "relative" }}>
          <ThemeIcon
            size="xl"
            radius="md"
            variant="light"
            color="aphBlue"
          >
            {icon}
          </ThemeIcon>
          {badge && !onStartTour && (
            <Badge
              size="sm"
              variant="light"
              color="gray"
              style={{
                position: "absolute",
                top: 0,
                right: 0,
              }}
            >
              {badge}
            </Badge>
          )}
        </Box>

        <Stack gap="xs" style={{ flex: 1 }}>
          <Title order={4} size="h5">
            {title}
          </Title>
          <Text size="sm" c="dimmed" lineClamp={2}>
            {description}
          </Text>
        </Stack>

        {onStartTour && (
          <Button
            variant="light"
            color="aphBlue"
            leftSection={<Play size={16} />}
            onClick={onStartTour}
            fullWidth
          >
            Start Tour
          </Button>
        )}
      </Stack>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
