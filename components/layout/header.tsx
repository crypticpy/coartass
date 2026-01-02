"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Moon, Sun, Settings } from "lucide-react";
import {
  Burger,
  Group,
  Button,
  Drawer,
  Stack,
  ActionIcon,
  useMantineColorScheme,
  useComputedColorScheme,
  Container,
  Box,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { SettingsDialog } from "./settings-dialog";

/**
 * Navigation link item
 */
interface NavItem {
  href: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "Upload Audio" },
  { href: "/record", label: "Record" },
  { href: "/recordings", label: "Recordings" },
  { href: "/transcripts", label: "Incidents" },
  { href: "/templates", label: "Templates" },
  { href: "/rubrics", label: "Rubrics" },
  { href: "/docs", label: "Docs" },
];

/**
 * Header component with navigation, settings, and dark mode toggle
 * Responsive with mobile menu drawer
 * MIGRATED TO MANTINE
 */
export default function Header() {
  const pathname = usePathname();
  const { setColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [mobileMenuOpened, { toggle: toggleMobileMenu, close: closeMobileMenu }] = useDisclosure(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setColorScheme(colorScheme === "dark" ? "light" : "dark");
  };

  return (
    <>
      <Box component="header" className="coa-header-root">
        <Container size="xl" style={{ padding: "0 1rem" }}>
          <Group h={64} justify="space-between">
            {/* Logo/Brand */}
            <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
              <Group gap="sm">
                <Box style={{ display: "flex", alignItems: "center" }}>
<Image
                    src="/images/austin-fire-logo.png"
                    alt="Austin Fire Department"
                    width={80}
                    height={80}
                    className="coa-header-logo"
                  priority
                  style={{
                      objectFit: "contain",
                    }}
                  />
                </Box>
                <Text
                  size="lg"
                  fw={700}
                  visibleFrom="sm"
                  className="coa-header-tagline"
                >
                  RTASS
                </Text>
              </Group>
            </Link>

            {/* Desktop Navigation */}
            <Group gap="xs" visibleFrom="md">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-tour-id={`nav-${item.href.replace('/', '') || 'home'}`}
                    className={`nav-link ${isActive ? "nav-link-active" : ""}`}
                    style={{
                      textDecoration: "none",
                    }}
                  >
                    <Text
                      component="span"
                      size="sm"
                      fw={600}
                      className={isActive ? "nav-text-active" : "nav-text"}
                    >
                      {item.label}
                    </Text>
                  </Link>
                );
              })}
            </Group>

            {/* Desktop Actions */}
            <Group gap="xs" visibleFrom="md">
              <ActionIcon
                variant="default"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                size="lg"
                className="touch-target-sm header-action-icon"
              >
                {mounted && (colorScheme === "dark" ? (
                  <Sun size={20} />
                ) : (
                  <Moon size={20} />
                ))}
              </ActionIcon>
              <ActionIcon
                variant="default"
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Settings"
                size="lg"
                className="touch-target-sm header-action-icon"
              >
                <Settings size={20} />
              </ActionIcon>
            </Group>

            {/* Mobile Actions */}
            <Group gap="xs" hiddenFrom="md">
              <ActionIcon
                variant="default"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                size="lg"
                className="touch-target header-action-icon"
              >
                {mounted && (colorScheme === "dark" ? (
                  <Sun size={20} />
                ) : (
                  <Moon size={20} />
                ))}
              </ActionIcon>
              <Burger
                opened={mobileMenuOpened}
                onClick={toggleMobileMenu}
                aria-label="Open menu"
                size="sm"
                className="touch-target"
              />
            </Group>
          </Group>
        </Container>
      </Box>

      {/* Mobile Menu Drawer */}
      <Drawer
        opened={mobileMenuOpened}
        onClose={closeMobileMenu}
        position="right"
        size="xs"
        padding="md"
        title={<Text fw={600}>Navigation</Text>}
      >
        <Stack gap="xs" mt="lg">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="mobile-nav-link"
              style={{ textDecoration: 'none', color: 'inherit' }}
              onClick={closeMobileMenu}
            >
              <div
                className={pathname === item.href ? 'mobile-nav-item-active' : 'mobile-nav-item'}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--mantine-radius-md)',
                  minHeight: 48,
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: pathname === item.href ? 'var(--mantine-color-primary-light)' : 'transparent',
                  color: pathname === item.href ? 'var(--mantine-color-primary-filled)' : 'inherit',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {item.label}
              </div>
            </Link>
          ))}
          <Box mt="md" pt="md" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
            <Button
              variant="light"
              leftSection={<Settings size={16} />}
              fullWidth
              onClick={() => {
                closeMobileMenu();
                setIsSettingsOpen(true);
              }}
              style={{ minHeight: 48 }}
            >
              Settings
            </Button>
          </Box>
        </Stack>
      </Drawer>

      {/* Settings Dialog */}
      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />

      {/* CSS for hover effects */}
      <style jsx>{`
        :global(.coa-header-root) {
          background-color: rgba(255, 255, 255, 0.95);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: background-color 0.3s ease, border-color 0.3s ease;
        }
        :global(html[data-mantine-color-scheme='dark'] .coa-header-root) {
          background-color: rgba(34, 37, 78, 0.95);
          border-bottom-color: rgba(255, 255, 255, 0.1);
        }
        :global(.coa-header-tagline) {
          border-left: 1px solid rgba(0, 0, 0, 0.2);
          padding-left: 1rem;
          margin-left: 0.5rem;
          color: var(--mantine-color-gray-8);
        }
        :global(html[data-mantine-color-scheme='dark'] .coa-header-tagline) {
          border-left-color: rgba(255, 255, 255, 0.3);
          color: rgba(255, 255, 255, 0.9);
        }
        /* Nav link pill styling with background + underline */
        :global(.nav-link) {
          padding: 8px 14px;
          border-radius: var(--mantine-radius-md);
          transition: background-color 0.15s ease;
          position: relative;
        }
        :global(.nav-link:hover) {
          background-color: var(--mantine-color-gray-1);
        }
        :global(.nav-link-active) {
          background-color: rgba(68, 73, 156, 0.1);
        }
        :global(.nav-link-active::after) {
          content: '';
          position: absolute;
          bottom: 2px;
          left: 14px;
          right: 14px;
          height: 2px;
          background-color: var(--mantine-color-aphBlue-6);
          border-radius: 1px;
        }
        /* Dark mode nav link */
        :global(html[data-mantine-color-scheme='dark'] .nav-link:hover) {
          background-color: rgba(255, 255, 255, 0.1);
        }
        :global(html[data-mantine-color-scheme='dark'] .nav-link-active) {
          background-color: rgba(255, 255, 255, 0.15);
        }
        :global(html[data-mantine-color-scheme='dark'] .nav-link-active::after) {
          background-color: #fff;
        }
        :global(.nav-text),
        :global(.nav-text-active) {
          transition: color 0.15s ease;
          cursor: pointer;
        }
        :global(.nav-text) {
          color: var(--mantine-color-gray-7);
        }
        :global(.nav-text-active) {
          color: var(--mantine-color-aphBlue-6);
        }
        :global(html[data-mantine-color-scheme='dark'] .nav-text) {
          color: rgba(255, 255, 255, 0.7);
        }
        :global(html[data-mantine-color-scheme='dark'] .nav-text-active) {
          color: #fff;
        }
        :global(.nav-link:hover .nav-text) {
          color: var(--mantine-color-text) !important;
        }
        /* Action icons styling */
        :global(.header-action-icon) {
          border-color: var(--mantine-color-gray-3) !important;
        }
        :global(.header-action-icon:hover) {
          background-color: var(--mantine-color-gray-1) !important;
          border-color: var(--mantine-color-gray-4) !important;
        }
        :global(html[data-mantine-color-scheme='dark'] .header-action-icon) {
          border-color: rgba(255, 255, 255, 0.2) !important;
          background-color: transparent !important;
        }
        :global(html[data-mantine-color-scheme='dark'] .header-action-icon:hover) {
          background-color: rgba(255, 255, 255, 0.1) !important;
          border-color: rgba(255, 255, 255, 0.3) !important;
        }
        :global(.mobile-nav-link:hover .mobile-nav-item:not(.mobile-nav-item-active)) {
          background-color: var(--mantine-color-gray-1) !important;
        }
        :global(.coa-header-logo) {
          transition: filter 120ms ease;
          filter: drop-shadow(0 6px 12px rgba(34, 37, 78, 0.15));
        }
        :global(html[data-mantine-color-scheme='dark'] .coa-header-logo) {
          filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.55));
        }
      `}</style>
    </>
  );
}
