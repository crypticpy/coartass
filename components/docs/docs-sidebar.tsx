"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { NavLink, Stack, Text } from "@mantine/core";
import { BookOpen, Shield, Lightbulb } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: "Overview",
    href: "/docs",
    icon: <BookOpen size={18} />,
  },
  {
    label: "Architecture & Security",
    href: "/docs/architecture",
    icon: <Shield size={18} />,
  },
  {
    label: "Best Practices",
    href: "/docs/best-practices",
    icon: <Lightbulb size={18} />,
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600} c="dimmed" tt="uppercase" mb="xs">
        Documentation
      </Text>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <NavLink
            key={item.href}
            component={Link}
            href={item.href}
            label={item.label}
            leftSection={item.icon}
            active={isActive}
            variant="light"
            color="aphBlue"
            style={{
              borderRadius: "var(--mantine-radius-md)",
            }}
          />
        );
      })}
    </Stack>
  );
}
