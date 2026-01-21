"use client";

import { Github, BookOpen, History } from "lucide-react";
import Link from "next/link";
import { Container, Text, Box } from "@mantine/core";

/**
 * Footer component with app version and helpful links
 * Simple, minimal design that stays at the bottom of the page
 * MIGRATED TO MANTINE
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();
  const appVersion = "0.14.1";

  return (
    <>
      <Box
        component="footer"
        style={{
          borderTop: "1px solid var(--mantine-color-default-border)",
          backgroundColor: "var(--mantine-color-body)",
        }}
      >
        <Container size="xl">
          <Box className="footer-content" py="md">
            <Text
              size="sm"
              c="dimmed"
              style={{
                textAlign: "center",
              }}
            >
              RTASS v{appVersion} &copy; {currentYear}
            </Text>

            <Box className="footer-links">
              <Link
                href="/docs"
                className="footer-link"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  textDecoration: "none",
                  color: "var(--mantine-color-dimmed)",
                  fontSize: "var(--mantine-font-size-sm)",
                  transition: "color 0.2s",
                }}
              >
                <BookOpen size={16} />
                Docs
              </Link>
              <Link
                href="/docs/version-history"
                className="footer-link"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  textDecoration: "none",
                  color: "var(--mantine-color-dimmed)",
                  fontSize: "var(--mantine-font-size-sm)",
                  transition: "color 0.2s",
                }}
              >
                <History size={16} />
                Changelog
              </Link>
              <a
                href="https://github.com/your-org/austin-rtass"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  textDecoration: "none",
                  color: "var(--mantine-color-dimmed)",
                  fontSize: "var(--mantine-font-size-sm)",
                  transition: "color 0.2s",
                }}
              >
                <Github size={16} />
                GitHub
              </a>
            </Box>
          </Box>
        </Container>
      </Box>
      <style jsx>{`
        :global(.footer-content) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }
        :global(.footer-links) {
          display: flex;
          gap: 1.5rem;
        }
        @media (min-width: 768px) {
          :global(.footer-content) {
            flex-direction: row;
            justify-content: space-between;
          }
        }
        :global(.footer-link:hover) {
          color: var(--mantine-color-text) !important;
        }
      `}</style>
    </>
  );
}
