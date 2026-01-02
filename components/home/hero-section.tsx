"use client";

import Link from "next/link";
import { Upload, Mic, FileText } from "lucide-react";
import { Button, Card, Badge, Tooltip, Text, Title, Group, Stack } from "@mantine/core";

interface HeroSectionProps {
  isLoadingConfig: boolean;
  isConfigured: boolean;
  onConfigureClick: () => void;
}

export function HeroSection({ isLoadingConfig, isConfigured, onConfigureClick }: HeroSectionProps) {
  return (
    <div className="hero-animate">
      <Card
        padding="xl"
        radius="lg"
        withBorder={false}
        shadow="md"
        style={{
          background: 'linear-gradient(135deg, #44499C 0%, #22254E 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Animated Background Elements - Removed animation for better readability */}
        <div
          style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%)',
            zIndex: 0,
          }}
        />

        <Stack align="center" gap="lg" style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-item-animate" style={{ animationDelay: '0.1s' }}>
            <Badge
              size="lg"
              variant="light"
              style={{
              background: 'rgba(255, 255, 255, 0.92)',
              color: 'var(--mantine-color-aphBlue-7)',
              border: '1px solid rgba(255, 255, 255, 0.65)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600,
              }}
            >
              Fireground Radio Transcription & Scoring
            </Badge>
          </div>

          <div className="hero-item-animate" style={{ animationDelay: '0.2s' }}>
            <Title
              order={1}
              ta="center"
              style={{
                color: 'white',
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                lineHeight: 1.2,
                maxWidth: '900px',
              }}
            >
              Turn Radio Traffic into{" "}
              <span style={{
                color: '#4ADE80', // Lightened green for better contrast against dark blue
                fontWeight: 700,
                textShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                Actionable Scorecards
              </span>
            </Title>
          </div>

          <div className="hero-item-animate" style={{ animationDelay: '0.3s' }}>
            <Text
              size="lg"
              ta="center"
              maw={800}
              style={{ 
                color: 'rgba(255, 255, 255, 0.95)', // Increased opacity
                lineHeight: 1.6,
                textShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
            >
              Upload fireground radio traffic and let AI transcribe and generate an evidence-linked training review. Powered by Azure OpenAI.
            </Text>
          </div>

          <div className="hero-item-animate" style={{ animationDelay: '0.4s' }}>
            <Group gap="md" mt="lg" style={{ width: '100%', justifyContent: 'center' }} wrap="wrap">
              {isLoadingConfig ? (
                <>
                  <Button size="lg" variant="outline" disabled styles={{ root: { minHeight: 48, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.3)', color: 'white' } }}>
                    <Upload size={20} style={{ marginRight: 8 }} />
                    Loading...
                  </Button>
                  <Button size="lg" variant="outline" disabled styles={{ root: { minHeight: 48, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.3)', color: 'white' } }}>
                    <Mic size={20} style={{ marginRight: 8 }} />
                    Loading...
                  </Button>
                </>
              ) : isConfigured ? (
                <>
                  <Link href="/upload" style={{ textDecoration: 'none' }}>
                    <Button
                      size="lg"
                      variant="outline"
                      leftSection={<Upload size={20} />}
                      styles={{
                        root: {
                          minHeight: 48,
                          borderWidth: 2,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          color: 'white',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            background: 'rgba(255, 255, 255, 0.15)',
                            borderColor: 'rgba(255, 255, 255, 0.6)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                          },
                        },
                      }}
                    >
                      Upload Audio
                    </Button>
                  </Link>
                  <Link href="/record" style={{ textDecoration: 'none' }}>
                    <Button
                      size="lg"
                      variant="outline"
                      leftSection={<Mic size={20} />}
                      styles={{
                        root: {
                          minHeight: 48,
                          borderWidth: 2,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          color: 'white',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            background: 'rgba(255, 255, 255, 0.15)',
                            borderColor: 'rgba(255, 255, 255, 0.6)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                          },
                        },
                      }}
                    >
                      Record Audio
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Tooltip
                    label={
                      <Stack gap={4}>
                        <Text size="sm" fw={500}>API Configuration Required</Text>
                        <Text size="xs">Click to view setup instructions for configuring your OpenAI API credentials.</Text>
                      </Stack>
                    }
                    multiline
                    maw={300}
                  >
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={onConfigureClick}
                      leftSection={<Upload size={20} />}
                      styles={{
                        root: {
                          minHeight: 48,
                          borderWidth: 2,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          color: 'white',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            background: 'rgba(255, 255, 255, 0.15)',
                            borderColor: 'rgba(255, 255, 255, 0.6)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                          },
                        },
                      }}
                    >
                      Upload Audio
                    </Button>
                  </Tooltip>
                  <Tooltip
                    label={
                      <Stack gap={4}>
                        <Text size="sm" fw={500}>API Configuration Required</Text>
                        <Text size="xs">Click to view setup instructions for configuring your OpenAI API credentials.</Text>
                      </Stack>
                    }
                    multiline
                    maw={300}
                  >
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={onConfigureClick}
                      leftSection={<Mic size={20} />}
                      styles={{
                        root: {
                          minHeight: 48,
                          borderWidth: 2,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          color: 'white',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            background: 'rgba(255, 255, 255, 0.15)',
                            borderColor: 'rgba(255, 255, 255, 0.6)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                          },
                        },
                      }}
                    >
                      Record Audio
                    </Button>
                  </Tooltip>
                </>
              )}

              <Link href="/templates" style={{ textDecoration: 'none' }}>
                <Button
                  size="lg"
                  variant="outline"
                  leftSection={<FileText size={20} />}
                  styles={{
                    root: {
                      minHeight: 48,
                      borderWidth: 2,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      color: 'white',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: 'rgba(255, 255, 255, 0.95)',
                        borderColor: 'white',
                        color: 'var(--mantine-color-aphBlue-7)',
                        transform: 'translateY(-3px)',
                        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)',
                      },
                    },
                  }}
                >
                  Review Templates
                </Button>
              </Link>
            </Group>
          </div>
        </Stack>
      </Card>
    </div>
  );
}
