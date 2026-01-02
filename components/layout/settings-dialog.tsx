"use client";

import * as React from "react";
import { Trash2, HardDrive, CheckCircle2, XCircle, AlertCircle, ExternalLink } from "lucide-react";
import { Modal, Button, Text, Badge, Card, Alert, Stack, Group, Loader } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { clearAllPreferences } from "@/lib/storage";
import { getStorageEstimate, deleteDatabase } from "@/lib/db";
import type { ConfigStatusResponse } from "@/app/api/config/status/route";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Settings dialog for viewing configuration status and managing application data
 *
 * SECURITY: This dialog is now READ-ONLY for API configuration.
 * All API keys and credentials must be configured via server-side environment variables.
 */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [configStatus, setConfigStatus] = React.useState<ConfigStatusResponse | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = React.useState(false);
  const [storageUsage, setStorageUsage] = React.useState("");
  const [isLoadingStorage, setIsLoadingStorage] = React.useState(false);
  const [isClearingData, setIsClearingData] = React.useState(false);

  // Load configuration status and storage info when dialog opens
  // RACE CONDITION FIX: Added cancellation for async operations
  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadData = async () => {
      // Load configuration status with cancellation check
      setIsLoadingConfig(true);
      try {
        const response = await fetch('/api/config/status');
        if (cancelled) return;

        const data: ConfigStatusResponse = await response.json();
        if (!cancelled) {
          setConfigStatus(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading configuration status:", error);
          setConfigStatus({
            configured: false,
            provider: 'none',
            error: 'Failed to load configuration status',
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConfig(false);
        }
      }

      // Load storage usage with cancellation check
      setIsLoadingStorage(true);
      try {
        const estimate = await getStorageEstimate();
        if (cancelled) return;

        if (estimate.quotaFormatted) {
          setStorageUsage(
            `${estimate.usageFormatted} / ${estimate.quotaFormatted} (${estimate.percentUsed?.toFixed(1)}%)`
          );
        } else {
          setStorageUsage(estimate.usageFormatted);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading storage usage:", error);
          setStorageUsage("Unable to determine storage usage");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStorage(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleClearAllData = async () => {
    setIsClearingData(true);
    try {
      // Clear localStorage preferences
      clearAllPreferences();

      // Delete IndexedDB database
      await deleteDatabase();

      notifications.show({
        title: "Data Cleared",
        message: "All local data has been cleared successfully.",
        color: "green",
      });

      onOpenChange(false);

      // Reload the page to reinitialize the database
      window.location.reload();
    } catch (error) {
      console.error("Error clearing data:", error);
      notifications.show({
        title: "Error",
        message: "Failed to clear data. Please try again.",
        color: "red",
      });
    } finally {
      setIsClearingData(false);
    }
  };

  const openClearDataConfirmation = () => {
    modals.openConfirmModal({
      title: 'Are you absolutely sure?',
      centered: true,
      children: (
        <Text size="sm">
          This action cannot be undone. This will permanently delete all your
          transcripts, templates, analyses, and local settings from this device.
          Your API configuration (environment variables) will not be affected.
        </Text>
      ),
      labels: { confirm: 'Clear All Data', cancel: 'Cancel' },
      confirmProps: { color: 'red', loading: isClearingData },
      onConfirm: handleClearAllData,
    });
  };

  const getStatusIcon = () => {
    if (isLoadingConfig) {
      return <Loader size={20} />;
    }
    if (configStatus?.configured) {
      return <CheckCircle2 size={20} style={{ color: 'var(--mantine-color-green-6)' }} />;
    }
    return <XCircle size={20} style={{ color: 'var(--mantine-color-red-6)' }} />;
  };

  const getProviderLabel = () => {
    if (!configStatus) return 'Unknown';
    if (configStatus.provider === 'azure') return 'Azure OpenAI';
    if (configStatus.provider === 'openai') return 'OpenAI';
    return 'Not Configured';
  };

  return (
    <Modal
      opened={open}
      onClose={() => onOpenChange(false)}
      title="Settings"
      size="lg"
      padding="xl"
      styles={{
        body: { maxHeight: '80vh', overflowY: 'auto' },
      }}
    >
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          View API configuration status and manage application data.
        </Text>

        {/* Configuration Status Section */}
        <Card withBorder shadow="sm" padding="lg">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Text size="lg" fw={600}>API Configuration</Text>
              {getStatusIcon()}
            </Group>

            <Text size="sm" c="dimmed">
              OpenAI API configuration is managed via environment variables
            </Text>

            {isLoadingConfig ? (
              <Group justify="center" py="xl">
                <Loader size="lg" />
              </Group>
            ) : configStatus?.configured ? (
              <Stack gap="md">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Status</Text>
                  <Badge color="green">Configured</Badge>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" fw={500}>Provider</Text>
                  <Text size="sm" c="dimmed">{getProviderLabel()}</Text>
                </Group>

                {configStatus.endpointHost && (
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>Endpoint</Text>
                    <Text size="sm" c="dimmed" ff="monospace">
                      {configStatus.endpointHost}
                    </Text>
                  </Group>
                )}

                {configStatus.whisperDeployment && (
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>Whisper Deployment</Text>
                    <Text size="sm" c="dimmed" ff="monospace">
                      {configStatus.whisperDeployment}
                    </Text>
                  </Group>
                )}

                {configStatus.analysisDeployment && (
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>Analysis Deployment</Text>
                    <Text size="sm" c="dimmed" ff="monospace">
                      {configStatus.analysisDeployment}
                    </Text>
                  </Group>
                )}
              </Stack>
            ) : (
              <Alert icon={<AlertCircle size={16} />} title="Not Configured" color="red">
                {configStatus?.error || 'OpenAI API is not configured'}
              </Alert>
            )}

            {/* Configuration Instructions */}
            <Alert icon={<AlertCircle size={16} />} title="How to Configure API Credentials" color="blue" mt="md">
              <Stack gap="md">
                <Text size="sm" fw={500}>
                  For security, API keys must be configured via environment variables.
                </Text>

                <Stack gap="sm">
                  <Text size="sm" fw={500}>Step-by-step setup:</Text>
                  <ol style={{ fontSize: 'var(--mantine-font-size-sm)', marginLeft: '1rem' }}>
                    <li>
                      In your project root, copy{" "}
                      <Text component="code" size="xs" px={6} py={2} style={{
                        backgroundColor: 'var(--mantine-color-default)',
                        borderRadius: 'var(--mantine-radius-sm)',
                        fontFamily: 'monospace'
                      }}>
                        .env.local.example
                      </Text>{" "}
                      to{" "}
                      <Text component="code" size="xs" px={6} py={2} style={{
                        backgroundColor: 'var(--mantine-color-default)',
                        borderRadius: 'var(--mantine-radius-sm)',
                        fontFamily: 'monospace'
                      }}>
                        .env.local
                      </Text>
                    </li>
                    <li>
                      Open <Text component="code" size="xs" px={6} py={2} style={{
                        backgroundColor: 'var(--mantine-color-default)',
                        borderRadius: 'var(--mantine-radius-sm)',
                        fontFamily: 'monospace'
                      }}>.env.local</Text> and add your API credentials:
                      <ul style={{ marginTop: '0.25rem', marginLeft: '1rem', fontSize: 'var(--mantine-font-size-xs)', color: 'var(--mantine-color-dimmed)' }}>
                        <li>For Azure OpenAI: Set AZURE_OPENAI_* variables</li>
                        <li>For OpenAI: Set OPENAI_API_KEY variable</li>
                      </ul>
                    </li>
                    <li>Save the file and restart your development server</li>
                    <li>Refresh this page to verify the configuration</li>
                  </ol>
                </Stack>

                <Stack gap="xs">
                  <a
                    href="https://learn.microsoft.com/en-us/azure/ai-services/openai/quickstart"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 'var(--mantine-font-size-xs)', color: 'var(--mantine-color-blue-6)', textDecoration: 'none' }}
                  >
                    <Group gap={4}>
                      <ExternalLink size={12} />
                      <span>Azure OpenAI Setup Guide</span>
                    </Group>
                  </a>
                  <a
                    href="https://platform.openai.com/docs/quickstart"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 'var(--mantine-font-size-xs)', color: 'var(--mantine-color-blue-6)', textDecoration: 'none' }}
                  >
                    <Group gap={4}>
                      <ExternalLink size={12} />
                      <span>OpenAI API Documentation</span>
                    </Group>
                  </a>
                </Stack>
              </Stack>
            </Alert>
          </Stack>
        </Card>

        {/* Storage Usage Section */}
        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <HardDrive size={16} />
              <Text size="sm" fw={500}>Local Storage Usage</Text>
            </Group>
            {isLoadingStorage ? (
              <Loader size="sm" />
            ) : (
              <Text size="sm" c="dimmed">{storageUsage}</Text>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            Transcripts and analyses stored locally in your browser
          </Text>
        </Stack>

        {/* Clear All Data Section */}
        <Stack gap="xs">
          <Button
            color="red"
            leftSection={<Trash2 size={16} />}
            onClick={openClearDataConfirmation}
            fullWidth
            styles={{ root: { minHeight: 44 } }}
          >
            Clear All Local Data
          </Button>
          <Text size="xs" c="dimmed" ta="center">
            This will delete all transcripts, templates, and local settings
          </Text>
        </Stack>

        {/* Footer */}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => onOpenChange(false)} styles={{ root: { minHeight: 44 } }}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
