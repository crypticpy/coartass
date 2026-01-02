'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Trash2,
  FileAudio,
  Loader2,
  ArrowRight,
  LayoutGrid,
  List,
  Download,
  Upload,
} from 'lucide-react';
import {
  Container,
  Title,
  Text,
  TextInput,
  Card,
  Button,
  Group,
  Stack,
  Skeleton,
  Box,
  Modal,
  Select,
  SegmentedControl,
  Paper,
  Checkbox,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSearchTranscripts } from '@/hooks/use-transcripts';
import { useDebounce } from '@/hooks/use-debounce';
import { deleteTranscript, deleteTranscriptsBulk, type TranscriptSortField } from '@/lib/db';
import { TranscriptCard, TranscriptTable } from '@/components/transcript';
import { ImportModal } from '@/components/package';
import type { Transcript } from '@/types/transcript';

type ViewMode = 'grid' | 'list';

const sortOptions = [
  { value: 'createdAt', label: 'Date Added' },
  { value: 'metadata.duration', label: 'Duration' },
  { value: 'filename', label: 'Filename' },
  { value: 'metadata.fileSize', label: 'File Size' },
];

function sortTranscripts(
  transcripts: Transcript[],
  sortBy: TranscriptSortField,
  sortOrder: 'asc' | 'desc'
): Transcript[] {
  return [...transcripts].sort((a, b) => {
      let aVal: string | number | Date;
      let bVal: string | number | Date;
  
      switch (sortBy) {
        case 'filename':
          aVal = a.filename.toLowerCase();
          bVal = b.filename.toLowerCase();
          break;
        case 'metadata.duration':
          aVal = a.metadata?.duration ?? 0;
          bVal = b.metadata?.duration ?? 0;
          break;
        case 'metadata.fileSize':
          aVal = a.metadata?.fileSize ?? 0;
          bVal = b.metadata?.fileSize ?? 0;
          break;
        case 'createdAt':
        default:
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
      }
  
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
}

export default function TranscriptsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const { transcripts: rawTranscripts, isLoading } = useSearchTranscripts(debouncedSearchTerm);

  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');
  const [sortBy, setSortBy] = React.useState<TranscriptSortField>('createdAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = React.useState(false);
  const [showImportModal, setShowImportModal] = React.useState(false);

  // Sort transcripts
  const transcripts = React.useMemo(
    () => sortTranscripts(rawTranscripts, sortBy, sortOrder),
    [rawTranscripts, sortBy, sortOrder]
  );

  // Clear selection when transcripts change
  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [rawTranscripts]);

  const handleSortChange = (field: TranscriptSortField) => {
    if (field === sortBy) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(transcripts.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await deleteTranscript(deleteId);
      notifications.show({
        title: 'Incident Deleted',
        message: 'The incident has been deleted successfully.',
        color: 'green',
      });
      setDeleteId(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteId);
        return next;
      });
    } catch (error) {
      console.error('Error deleting transcript:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete transcript. Please try again.',
        color: 'red',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await deleteTranscriptsBulk(ids);
      notifications.show({
        title: 'Incidents Deleted',
        message: `${ids.length} incident${ids.length !== 1 ? 's' : ''} deleted successfully.`,
        color: 'green',
      });
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
    } catch (error) {
      console.error('Error deleting transcripts:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete transcripts. Please try again.',
        color: 'red',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkExport = async () => {
    if (selectedIds.size === 0) return;

    const selectedTranscripts = transcripts.filter((t) => selectedIds.has(t.id));
    const exportData = selectedTranscripts.map((t) => ({
      id: t.id,
      filename: t.filename,
      text: t.text,
      summary: t.summary,
      createdAt: t.createdAt,
      duration: t.metadata?.duration,
      language: t.metadata?.language,
      segments: t.segments,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcripts-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notifications.show({
      title: 'Export Complete',
      message: `${selectedIds.size} incident${selectedIds.size !== 1 ? 's' : ''} exported.`,
      color: 'green',
    });
  };

  const handleImportSuccess = (transcriptId: string) => {
    setShowImportModal(false);
    router.push(`/transcripts/${transcriptId}`);
  };

  const showBulkActions = selectedIds.size > 0;

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header Section */}
        <Stack gap="xs">
          <Title order={1} size="h1">
            All Incidents
          </Title>
          <Text size="sm" c="dimmed">
            View and manage your radio traffic transcripts
          </Text>
        </Stack>

        {/* Toolbar */}
        <Group justify="space-between" wrap="wrap" gap="md">
          {/* Search */}
          <TextInput
            placeholder="Search incidents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftSection={<Search size={16} />}
            style={{ flex: 1, maxWidth: 400, minWidth: 200 }}
            styles={{
              input: { minHeight: 44 },
            }}
            data-tour-id="transcripts-search"
          />

          {/* Sort and View Controls */}
          <Group gap="sm">
            <Select
              value={sortBy}
              onChange={(val) => val && handleSortChange(val as TranscriptSortField)}
              data={sortOptions}
              style={{ width: 160 }}
              styles={{
                input: { minHeight: 44 },
              }}
              aria-label="Sort by"
              data-tour-id="transcripts-sort"
            />
            <SegmentedControl
              value={viewMode}
              onChange={(val) => setViewMode(val as ViewMode)}
              data={[
                {
                  value: 'grid',
                  label: <LayoutGrid size={18} />,
                },
                {
                  value: 'list',
                  label: <List size={18} />,
                },
              ]}
              styles={{
                root: { minHeight: 44 },
              }}
              aria-label="View mode"
            />
            <Button
              variant="light"
              leftSection={<Upload size={16} />}
              onClick={() => setShowImportModal(true)}
              styles={{ root: { minHeight: 44 } }}
            >
              Import
            </Button>
          </Group>
        </Group>

        {/* Bulk Actions Bar */}
        {showBulkActions && (
          <Paper p="sm" radius="md" withBorder bg="var(--mantine-color-blue-light)">
            <Group justify="space-between">
              <Group gap="sm">
                <Checkbox
                  checked={selectedIds.size === transcripts.length}
                  indeterminate={
                    selectedIds.size > 0 && selectedIds.size < transcripts.length
                  }
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  label={`${selectedIds.size} selected`}
                />
              </Group>
              <Group gap="sm">
                <Button
                  variant="light"
                  color="blue"
                  size="sm"
                  leftSection={<Download size={16} />}
                  onClick={handleBulkExport}
                >
                  Export
                </Button>
                <Button
                  variant="light"
                  color="red"
                  size="sm"
                  leftSection={<Trash2 size={16} />}
                  onClick={() => setShowBulkDeleteModal(true)}
                >
                  Delete
                </Button>
              </Group>
            </Group>
          </Paper>
        )}

        {/* Transcript Count */}
        {transcripts.length > 0 && !showBulkActions && (
          <Text size="sm" c="dimmed">
            {transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''} found
          </Text>
        )}

        {/* Transcripts List */}
        {isLoading ? (
          viewMode === 'grid' ? (
            <Box
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              }}
            >
              {[...Array(6)].map((_, i) => (
                <Card key={i} padding="lg" radius="md" withBorder>
                  <Stack gap="md">
                    <Skeleton height={24} width="75%" />
                    <Skeleton height={16} width="50%" />
                    <Skeleton height={16} width="100%" />
                    <Skeleton height={16} width="85%" />
                  </Stack>
                </Card>
              ))}
            </Box>
          ) : (
            <Card padding="lg" radius="md" withBorder>
              <Stack gap="md">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} height={48} />
                ))}
              </Stack>
            </Card>
          )
        ) : transcripts.length > 0 ? (
          viewMode === 'grid' ? (
            <Box
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              }}
            >
              {transcripts.map((transcript) => (
                <TranscriptCard
                  key={transcript.id}
                  transcript={transcript}
                  selected={selectedIds.has(transcript.id)}
                  onSelect={handleSelect}
                  onDelete={setDeleteId}
                  showCheckbox={showBulkActions}
                />
              ))}
            </Box>
          ) : (
            <Card padding={0} radius="md" withBorder>
              <TranscriptTable
                transcripts={transcripts}
                selectedIds={selectedIds}
                onSelectAll={handleSelectAll}
                onSelect={handleSelect}
                onDelete={setDeleteId}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSortChange}
              />
            </Card>
          )
        ) : (
          <Card padding="xl" radius="md" withBorder style={{ borderStyle: 'dashed' }}>
            <Stack align="center" gap="xl" py="xl">
              <Box
                style={{
                  borderRadius: '50%',
                  backgroundColor: 'var(--aph-blue-light)',
                  padding: 24,
                }}
              >
                <FileAudio size={64} color="var(--aph-blue)" />
              </Box>

              <Title order={2} size="h2" ta="center">
                {searchTerm ? 'No incidents found' : 'No incidents yet'}
              </Title>

              <Text c="dimmed" ta="center" size="md" style={{ maxWidth: 450 }}>
                {searchTerm
                  ? 'Try adjusting your search terms or clear the search to see all incidents.'
                  : 'No incidents available yet. Incidents will appear here once audio is uploaded.'}
              </Text>

              <Group gap="md">
                {!searchTerm && (
                  <Button
                    component={Link}
                    href="/templates"
                    size="lg"
                    variant="outline"
                    rightSection={<ArrowRight size={20} />}
                    styles={{ root: { minHeight: 44 } }}
                  >
                    Browse Templates
                  </Button>
                )}
                {searchTerm && (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setSearchTerm('')}
                    styles={{ root: { minHeight: 44 } }}
                  >
                    Clear Search
                  </Button>
                )}
              </Group>
            </Stack>
          </Card>
        )}

        {/* Single Delete Confirmation Dialog */}
        <Modal
          opened={!!deleteId}
          onClose={() => setDeleteId(null)}
          title="Delete Incident"
          centered
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Are you sure you want to delete this incident? This action cannot be undone.
              All associated analyses will also be deleted.
            </Text>

            <Group justify="flex-end" gap="sm" mt="md">
              <Button
                variant="outline"
                onClick={() => setDeleteId(null)}
                disabled={isDeleting}
                styles={{ root: { minHeight: 44 } }}
              >
                Cancel
              </Button>
              <Button
                color="red"
                onClick={handleDelete}
                disabled={isDeleting}
                leftSection={
                  isDeleting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : undefined
                }
                styles={{ root: { minHeight: 44 } }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Bulk Delete Confirmation Dialog */}
        <Modal
          opened={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          title="Delete Incidents"
          centered
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Are you sure you want to delete {selectedIds.size} incident
              {selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone. All
              associated analyses will also be deleted.
            </Text>

            <Group justify="flex-end" gap="sm" mt="md">
              <Button
                variant="outline"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isDeleting}
                styles={{ root: { minHeight: 44 } }}
              >
                Cancel
              </Button>
              <Button
                color="red"
                onClick={handleBulkDelete}
                disabled={isDeleting}
                leftSection={
                  isDeleting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : undefined
                }
                styles={{ root: { minHeight: 44 } }}
              >
                {isDeleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Import Package Modal */}
        <ImportModal
          opened={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={handleImportSuccess}
        />
      </Stack>
    </Container>
  );
}
