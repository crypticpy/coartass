/**
 * Department Selector Component
 *
 * Dropdown for selecting City of Austin department
 * - Organizes transcripts by department
 * - Remembers last selected department (localStorage)
 * - Bilingual (English/Spanish)
 * - Mobile-optimized with 48px touch targets
 */

"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { Select, Badge, Group, Text, Stack, rem } from "@mantine/core";
import {
  AUSTIN_DEPARTMENTS,
  getStoredDepartment,
  setStoredDepartment,
} from "@/lib/departments";
import { useTranslations } from "next-intl";
import { getStoredLocale } from "@/lib/locale";

/**
 * Props for DepartmentSelector component
 */
export interface DepartmentSelectorProps {
  /** Currently selected department ID */
  value?: string;
  /** Callback when department changes */
  onValueChange: (departmentId: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Department Selector Component
 *
 * Provides a searchable dropdown for selecting City of Austin departments.
 * Automatically remembers the user's last selection.
 *
 * @example
 * ```tsx
 * <DepartmentSelector
 *   value={department}
 *   onValueChange={setDepartment}
 *   disabled={isUploading}
 * />
 * ```
 */
export function DepartmentSelector({
  value,
  onValueChange,
  disabled = false,
  className,
}: DepartmentSelectorProps) {
  const t = useTranslations('upload');
  const [locale, setLocale] = React.useState<'en' | 'es'>('en');

  // Get current locale
  React.useEffect(() => {
    const currentLocale = getStoredLocale();
    setLocale(currentLocale as 'en' | 'es');
  }, []);

  // Load stored department preference on mount
  React.useEffect(() => {
    if (!value) {
      const storedDept = getStoredDepartment();
      if (storedDept) {
        onValueChange(storedDept);
      }
    }
  }, [value, onValueChange]);

  /**
   * Handle department selection
   * Saves to localStorage and triggers callback
   */
  const handleValueChange = React.useCallback(
    (newValue: string | null) => {
      if (!newValue) return;

      // Save to localStorage
      setStoredDepartment(newValue);

      // Trigger callback
      onValueChange(newValue);
    },
    [onValueChange]
  );

  // Prepare select data with custom rendering
  const selectData = AUSTIN_DEPARTMENTS.map((dept) => ({
    value: dept.id,
    label: locale === 'es' ? dept.nameEs : dept.name,
  }));

  return (
    <Stack gap="xs" className={className}>
      <Group gap="xs">
        <Building2 style={{ width: rem(16), height: rem(16) }} />
        <Text size="sm" fw={500}>
          {t('departmentLabel') || 'Department'}
        </Text>
      </Group>

      <Select
        value={value}
        onChange={handleValueChange}
        disabled={disabled}
        data={selectData}
        placeholder={t('departmentPlaceholder') || 'Select your department...'}
        searchable
        clearable={false}
        styles={{
          input: {
            minHeight: rem(44),
          },
          option: {
            minHeight: rem(44),
            display: 'flex',
            alignItems: 'center',
          },
        }}
        renderOption={({ option }) => {
          const dept = AUSTIN_DEPARTMENTS.find(d => d.id === option.value);
          if (!dept) return null;

          return (
            <Group gap="sm" wrap="nowrap">
              <Text size="xl" style={{ lineHeight: 1 }}>
                {dept.icon}
              </Text>
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Text fw={500} truncate>
                  {locale === 'es' ? dept.nameEs : dept.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {dept.abbreviation}
                </Text>
              </Stack>
            </Group>
          );
        }}
      />

      {value && (
        <Group gap="xs" mt={4}>
          {(() => {
            const selectedDept = AUSTIN_DEPARTMENTS.find(d => d.id === value);
            if (!selectedDept) return null;
            return (
              <>
                <Text size="xs" c="dimmed">Selected:</Text>
                <Badge variant="outline" size="sm">
                  {selectedDept.abbreviation}
                </Badge>
              </>
            );
          })()}
        </Group>
      )}

      <Text size="xs" c="dimmed">
        {t('departmentHelp') || 'This helps organize your recordings by department.'}
      </Text>
    </Stack>
  );
}
