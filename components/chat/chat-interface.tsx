/**
 * Chat Interface Component
 *
 * Complete chat UI for Q&A conversations about transcripts.
 * Features message list, input area, loading states, and error handling.
 */

'use client';

import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Textarea,
  Button,
  Alert,
  Box,
  ScrollArea,
  ActionIcon,
  Tooltip,
  Modal,
} from '@mantine/core';
import {
  Send,
  MessageCircle,
  Trash2,
  Download,
  Copy,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useChat } from '@/hooks/use-chat';
import { formatMessageTimestamp } from '@/types/chat';
import type { Transcript } from '@/types/transcript';
import type { ChatMessage } from '@/types/chat';

export interface ChatInterfaceProps {
  /** ID of the transcript to chat about */
  transcriptId: string;

  /** The transcript object for context */
  transcript: Transcript;
}

/**
 * Format seconds as MM:SS timestamp
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format transcript segments with timestamps for chat context
 * e.g., "[0:00] Attention Fire Department..."
 *
 * This is critical for firefighters to reference specific times
 * during their Q&A sessions about radio traffic.
 */
function formatTranscriptWithTimestamps(transcript: Transcript): string {
  if (!transcript.segments || transcript.segments.length === 0) {
    return transcript.text;
  }

  return transcript.segments
    .map(segment => `[${formatTimestamp(segment.start)}] ${segment.text}`)
    .join('\n');
}

/**
 * Main chat interface component
 *
 * Features:
 * - Message list with auto-scroll
 * - User and AI message bubbles
 * - Typing indicator during loading
 * - Empty state with suggestions
 * - Error handling with retry
 * - Clear conversation with confirmation
 * - Export chat history
 * - Character counter
 * - Enter to send, Shift+Enter for new line
 */
export function ChatInterface({ transcriptId, transcript }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [
    clearModalOpened,
    { open: openClearModal, close: closeClearModal },
  ] = useDisclosure(false);

  // Format transcript with timestamps for chat context
  // This is critical for firefighters to reference specific times in radio traffic
  const transcriptTextWithTimestamps = useMemo(
    () => formatTranscriptWithTimestamps(transcript),
    [transcript]
  );

  // Use chat hook with timestamped transcript
  const {
    messages,
    loading,
    error,
    sendMessage,
    clearConversation,
  } = useChat(transcriptId, transcriptTextWithTimestamps);

  // Refs
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    // Use setTimeout to ensure DOM has fully updated before scrolling
    const timeoutId = setTimeout(() => {
      scrollSentinelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [messages, loading]);

  // Handle send message
  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();

    if (!trimmedInput || loading) {
      return;
    }

    // Clear input immediately for better UX
    setInput('');

    try {
      await sendMessage(trimmedInput);
    } catch (err) {
      // Error is already handled by useChat hook
      console.error('[ChatInterface] Send error:', err);
    }
  }, [input, loading, sendMessage]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter to send (without Shift)
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Handle clear conversation
  const handleClearConversation = useCallback(async () => {
    try {
      await clearConversation();
      closeClearModal();
      notifications.show({
        title: 'Conversation Cleared',
        message: 'Your chat history has been cleared successfully.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Clear Failed',
        message: err instanceof Error ? err.message : 'Failed to clear conversation',
        color: 'red',
      });
    }
  }, [clearConversation, closeClearModal]);

  // Handle export conversation
  const handleExportConversation = useCallback(() => {
    try {
      const exportData = {
        transcriptId: transcript.id,
        transcriptFilename: transcript.filename,
        exportedAt: new Date().toISOString(),
        messageCount: messages.length,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
        })),
      };

      const jsonContent = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chat-${transcript.filename.replace(/\.[^/.]+$/, '')}-${
        new Date().toISOString().split('T')[0]
      }.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notifications.show({
        title: 'Export Successful',
        message: 'Chat history exported as JSON',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Export Failed',
        message: err instanceof Error ? err.message : 'Failed to export conversation',
        color: 'red',
      });
    }
  }, [transcript, messages]);

  // Character count and warning
  const characterCount = input.length;
  const maxCharacters = 500;
  const showCharacterWarning = characterCount > maxCharacters;

  // Check if input is empty or too long
  const isSendDisabled = !input.trim() || loading || showCharacterWarning;

  return (
    <Stack gap="md">
      {/* Header with actions */}
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <MessageCircle size={20} style={{ color: 'var(--logo-blue)' }} />
          <Text size="lg" fw={600}>
            Ask Questions
          </Text>
          {messages.length > 0 && (
            <Text size="sm" c="dimmed">
              ({messages.length} {messages.length === 1 ? 'message' : 'messages'})
            </Text>
          )}
        </Group>

        {messages.length > 0 && (
          <Group gap="xs">
            <Tooltip label="Export chat history">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={handleExportConversation}
                aria-label="Export chat history"
              >
                <Download size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Clear conversation">
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={openClearModal}
                aria-label="Clear conversation"
              >
                <Trash2 size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>

      {/* Chat messages container */}
      <Paper
        withBorder
        radius="md"
        style={{
          height: '500px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Messages */}
        <ScrollArea
          ref={scrollAreaRef}
          style={{ flex: 1 }}
          p="md"
          type="auto"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          {messages.length === 0 && !loading ? (
            <EmptyState />
          ) : (
            <Stack gap="md">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {loading && <TypingIndicator />}
              <div ref={scrollSentinelRef} style={{ height: 1 }} />
            </Stack>
          )}
        </ScrollArea>

        {/* Error alert */}
        {error && (
          <Box px="md" pb="md">
            <Alert
              color="red"
              variant="light"
              icon={<AlertCircle size={16} />}
              title="Error"
              withCloseButton
              onClose={() => {
                // Error clearing is handled by the hook
              }}
            >
              <Text size="sm">{error}</Text>
              <Button
                size="xs"
                variant="light"
                color="red"
                mt="xs"
                onClick={() => {
                  if (input.trim()) {
                    handleSend();
                  }
                }}
                disabled={!input.trim()}
              >
                Retry
              </Button>
            </Alert>
          </Box>
        )}

        {/* Input area */}
        <Box
          p="md"
          style={{
            borderTop: '1px solid var(--mantine-color-default-border)',
            backgroundColor: 'var(--mantine-color-default)',
          }}
        >
          <Stack gap="xs">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about this transcript..."
              minRows={2}
              maxRows={5}
              autosize
              disabled={loading}
              styles={{
                input: {
                  fontSize: '14px',
                  lineHeight: 1.5,
                },
              }}
              aria-label="Message input"
            />

            <Group justify="space-between" align="center">
              <Group gap="xs">
                <Text
                  size="xs"
                  c={showCharacterWarning ? 'red' : 'dimmed'}
                  fw={showCharacterWarning ? 600 : 400}
                >
                  {characterCount} / {maxCharacters}
                </Text>
                {showCharacterWarning && (
                  <Text size="xs" c="red">
                    Message too long
                  </Text>
                )}
              </Group>

              <Group gap="xs" wrap="nowrap">
                {/* Short hint for small screens */}
                <Text
                  size="xs"
                  c="dimmed"
                  style={{ whiteSpace: 'nowrap' }}
                  hiddenFrom="sm"
                >
                  Enter to send
                </Text>
                {/* Full hint for larger screens */}
                <Text
                  size="xs"
                  c="dimmed"
                  style={{ whiteSpace: 'nowrap' }}
                  visibleFrom="sm"
                >
                  Press Enter to send, Shift+Enter for new line
                </Text>
                <Button
                  size="sm"
                  leftSection={loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  onClick={handleSend}
                  disabled={isSendDisabled}
                  aria-label="Send message"
                >
                  {loading ? 'Sending...' : 'Send'}
                </Button>
              </Group>
            </Group>
          </Stack>
        </Box>
      </Paper>

      {/* Clear conversation modal */}
      <Modal
        opened={clearModalOpened}
        onClose={closeClearModal}
        title="Clear Conversation?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to clear all messages in this conversation? This action
            cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeClearModal}>
              Cancel
            </Button>
            <Button color="red" onClick={handleClearConversation}>
              Clear Conversation
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

/**
 * Message bubble component
 * Displays a single message with timestamp and copy functionality
 */
interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUser = message.role === 'user';

  // Cleanup copy feedback timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[MessageBubble] Copy failed:', err);
    }
  }, [message.content]);

  return (
    <Box
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        alignItems: 'flex-start',
        width: '100%',
      }}
    >
      <Box
        style={{
          maxWidth: '75%',
          minWidth: '200px',
        }}
      >
        {/* Model label for AI messages */}
        {!isUser && message.model && (
          <Text size="xs" c="dimmed" mb={4} fw={500}>
            {message.model}
          </Text>
        )}
        <Paper
          p="md"
          radius="md"
          style={{
            backgroundColor: isUser
              ? 'var(--logo-blue)'
              : 'var(--mantine-color-gray-1)',
            color: isUser ? 'white' : 'var(--mantine-color-text)',
            wordBreak: 'break-word',
          }}
        >
          <Text
            size="sm"
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              color: isUser ? 'white' : 'inherit',
            }}
          >
            {message.content}
          </Text>
        </Paper>

        <Group
          justify={isUser ? 'flex-end' : 'space-between'}
          mt="xs"
          px="xs"
          gap="xs"
        >
          <Text size="xs" c="dimmed">
            {formatMessageTimestamp(message.timestamp)}
          </Text>

          {!isUser && (
            <Tooltip label={copied ? 'Copied!' : 'Copy message'}>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={handleCopy}
                aria-label="Copy message"
              >
                {copied ? (
                  <Check size={14} style={{ color: 'var(--compliant-green)' }} />
                ) : (
                  <Copy size={14} />
                )}
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Box>
    </Box>
  );
});

/**
 * Typing indicator component
 * Shows skeleton lines and animated dots while AI is generating response
 */
function TypingIndicator() {
  return (
    <Box
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        width: '100%',
      }}
    >
      <Box style={{ maxWidth: '75%', minWidth: '200px' }}>
        <Text size="xs" c="dimmed" mb={4} fw={500}>
          AI is thinking...
        </Text>
        <Paper
          p="md"
          radius="md"
          style={{
            backgroundColor: 'var(--mantine-color-gray-1)',
            minWidth: '200px',
          }}
        >
          {/* Skeleton lines to indicate content is loading */}
          <Box
            style={{
              height: 14,
              width: '85%',
              borderRadius: 4,
              backgroundColor: 'var(--mantine-color-gray-3)',
              marginBottom: 8,
              animation: 'skeleton-pulse 1.5s ease-in-out infinite',
            }}
          />
          <Box
            style={{
              height: 14,
              width: '65%',
              borderRadius: 4,
              backgroundColor: 'var(--mantine-color-gray-3)',
              marginBottom: 12,
              animation: 'skeleton-pulse 1.5s ease-in-out infinite',
              animationDelay: '0.1s',
            }}
          />
          {/* Animated dots */}
          <Group gap="xs">
            <Box
              className="typing-dot"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--mantine-color-gray-6)',
                animation: 'typing 1.4s infinite',
                animationDelay: '0s',
              }}
            />
            <Box
              className="typing-dot"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--mantine-color-gray-6)',
                animation: 'typing 1.4s infinite',
                animationDelay: '0.2s',
              }}
            />
            <Box
              className="typing-dot"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--mantine-color-gray-6)',
                animation: 'typing 1.4s infinite',
                animationDelay: '0.4s',
              }}
            />
          </Group>
        </Paper>
      </Box>

      <style jsx>{`
        @keyframes typing {
          0%,
          60%,
          100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-8px);
          }
        }
        @keyframes skeleton-pulse {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </Box>
  );
}

/**
 * Empty state component
 * Shows when there are no messages yet
 */
function EmptyState() {
  const suggestions = [
    'What are the key takeaways from this transcript?',
    'Summarize the main discussion points',
    'What action items were mentioned?',
    'Who were the main speakers?',
  ];

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '350px',
        padding: '2rem',
      }}
    >
      <Stack align="center" gap="xl" style={{ maxWidth: 500 }}>
        <Box
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            backgroundColor: 'var(--mantine-color-aphBlue-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MessageCircle size={40} style={{ color: 'var(--logo-blue)' }} />
        </Box>

        <Stack align="center" gap="xs">
          <Text size="xl" fw={600} ta="center">
            Ask me anything about this transcript
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            I can help you understand the content, find specific information, or summarize
            key points.
          </Text>
        </Stack>

        <Stack gap="xs" w="100%">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" ta="center">
            Try asking:
          </Text>
          <Stack gap="xs">
            {suggestions.map((suggestion, idx) => (
              <Paper
                key={idx}
                p="sm"
                radius="md"
                withBorder
                style={{
                  cursor: 'default',
                  backgroundColor: 'var(--mantine-color-default)',
                  borderColor: 'var(--mantine-color-default-border)',
                }}
              >
                <Text size="sm" c="dimmed" ta="center">
                  &quot;{suggestion}&quot;
                </Text>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
