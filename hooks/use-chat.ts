/**
 * Custom hook for managing Q&A chat conversations with transcripts
 *
 * Provides real-time updates when conversations change via IndexedDB.
 * All conversation data is stored CLIENT-SIDE ONLY in browser storage.
 *
 * Privacy Model:
 * - Conversations stored in browser IndexedDB (user's device only)
 * - API endpoint is stateless (stores nothing on server)
 * - Chat history persists across page reloads
 * - User can delete conversations at any time
 *
 * Features:
 * - Live reactive updates via useLiveQuery
 * - Automatic conversation creation on first message
 * - Message persistence in IndexedDB
 * - Error handling and loading states
 * - Clear and delete conversation functions
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  getConversationByTranscript,
  saveConversation,
  updateConversation,
  deleteConversation as dbDeleteConversation,
} from '@/lib/db';
import type { ChatMessage, Conversation, ChatError } from '@/types/chat';
import { createLogger } from '@/lib/logger';

const log = createLogger('useChat');
const conversationInfoLog = createLogger('useConversationInfo');

/**
 * Maximum number of messages to include in API requests.
 * Full history remains in IndexedDB for display; only API payload is truncated.
 * This prevents token limit errors with long conversations.
 */
const MAX_HISTORY_MESSAGES = 20;

/**
 * Return type for the useChat hook
 */
export interface UseChatReturn {
  /** Array of messages in chronological order */
  messages: ChatMessage[];

  /** Whether a message is currently being sent/received */
  loading: boolean;

  /** Error message if the last operation failed */
  error: string | null;

  /** Database error from useLiveQuery (null if no error) */
  dbError: Error | null;

  /** ID of the conversation (null if no conversation exists yet) */
  conversationId: string | null;

  /** Send a question and receive an answer */
  sendMessage: (question: string) => Promise<void>;

  /** Clear all messages in the conversation (soft reset) */
  clearConversation: () => Promise<void>;

  /** Delete the conversation permanently */
  deleteConversation: () => Promise<void>;

  /** Whether the conversation exists */
  hasConversation: boolean;
}

/**
 * Hook to manage chat conversation for a transcript
 *
 * Handles:
 * - Loading existing conversation from IndexedDB
 * - Sending messages to stateless API endpoint
 * - Saving responses to IndexedDB
 * - Reactive updates when conversation changes
 * - Error handling and loading states
 *
 * @param transcriptId - ID of the transcript to chat about
 * @param transcriptText - Full text of the transcript (sent with each API call)
 * @returns Chat interface with messages, loading state, and actions
 *
 * @example
 * ```tsx
 * function ChatInterface({ transcript }) {
 *   const {
 *     messages,
 *     loading,
 *     error,
 *     sendMessage,
 *     clearConversation,
 *   } = useChat(transcript.id, transcript.text);
 *
 *   return (
 *     <div>
 *       {messages.map(msg => (
 *         <Message key={msg.id} message={msg} />
 *       ))}
 *       {loading && <Spinner />}
 *       {error && <ErrorAlert message={error} />}
 *       <ChatInput onSend={sendMessage} disabled={loading} />
 *       <Button onClick={clearConversation}>Clear History</Button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useChat(
  transcriptId: string,
  transcriptText: string
): UseChatReturn {
  // Local state for loading, errors, and database errors
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbError, setDbError] = useState<Error | null>(null);

  // Load conversation from IndexedDB with reactive updates and explicit error tracking
  const conversation = useLiveQuery(
    async () => {
      try {
        setDbError(null);
        return await getConversationByTranscript(transcriptId);
      } catch (error) {
        log.error('Error loading conversation', {
          message: error instanceof Error ? error.message : String(error),
        });
        setDbError(error instanceof Error ? error : new Error(String(error)));
        return undefined;
      }
    },
    [transcriptId],
    undefined // Default value while loading
  );

  // Optimistic UI: store pending user message to show immediately
  const [pendingUserMessage, setPendingUserMessage] = useState<ChatMessage | null>(null);

  // Ref to track if we're currently processing a message (prevents duplicate sends)
  const processingRef = useRef(false);

  // Clear error when conversation changes (e.g., after successful send)
  useEffect(() => {
    if (conversation && error) {
      setError(null);
    }
  }, [conversation, error]);

  /**
   * Send a message and receive a response
   *
   * Flow:
   * 1. Add user message to local state
   * 2. Call stateless API endpoint
   * 3. Add assistant response to messages
   * 4. Save updated conversation to IndexedDB
   */
  const sendMessage = useCallback(async (question: string) => {
    // Prevent duplicate sends
    if (processingRef.current) {
      log.warn('Already processing a message, ignoring duplicate send');
      return;
    }

    // Validate input
    if (!question.trim()) {
      setError('Question cannot be empty');
      return;
    }

    processingRef.current = true;
    setLoading(true);
    setError(null);

    // Create user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question.trim(),
      timestamp: new Date(),
    };

    // Show user message immediately (optimistic UI)
    setPendingUserMessage(userMessage);

    try {
      // Truncate conversation history for API payload to prevent token limit errors
      // Full history remains in IndexedDB for display; only API payload is truncated
      const fullHistory = conversation?.messages || [];
      const truncatedHistory = fullHistory.slice(-MAX_HISTORY_MESSAGES);

      log.debug('Sending message', {
        transcriptId,
        questionLength: question.length,
        conversationMessageCount: fullHistory.length,
        truncatedMessageCount: truncatedHistory.length,
        wasTruncated: fullHistory.length > MAX_HISTORY_MESSAGES,
      });

      // Call API with truncated history
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcriptId,
          transcriptText,
          question: question.trim(),
          conversationHistory: truncatedHistory,
        }),
      });

      // Handle error responses
      if (!response.ok) {
        let errorData: { error: ChatError };
        try {
          errorData = await response.json();
        } catch {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const chatError = errorData.error;
        log.error('API error', { type: chatError.type, message: chatError.message });

        // Log detailed validation errors for debugging
        if (chatError.type === 'validation' && chatError.details) {
          log.error('Validation error details', { details: chatError.details });
        }

        // Provide user-friendly error messages
        if (chatError.type === 'token_limit') {
          throw new Error(
            'The conversation is too long. Try clearing the conversation history to continue.'
          );
        } else if (chatError.type === 'validation') {
          throw new Error('Invalid request. Please try again.');
        } else if (chatError.type === 'api_failure') {
          throw new Error(
            chatError.message || 'Failed to get response from AI. Please try again.'
          );
        } else {
          throw new Error(chatError.message || 'An error occurred. Please try again.');
        }
      }

      // Parse success response
      const { data } = await response.json();

      if (!data?.answer) {
        throw new Error('Received invalid response from server');
      }

      // Create assistant message with model info
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        model: data.model, // Include model name from API response
      };

      // Update messages array
      const updatedMessages = [
        ...(conversation?.messages || []),
        userMessage,
        assistantMessage,
      ];

      log.debug('Message sent successfully, saving to IndexedDB', {
        messageCount: updatedMessages.length,
        hasExistingConversation: !!conversation,
        model: data.model,
      });

      // Save to IndexedDB
      if (conversation) {
        // Update existing conversation
        await updateConversation(conversation.id, updatedMessages);
      } else {
        // Create new conversation
        const newConversation: Conversation = {
          id: crypto.randomUUID(),
          transcriptId,
          messages: updatedMessages,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await saveConversation(newConversation);
      }

      // Clear pending message now that it's saved to DB
      setPendingUserMessage(null);
      log.debug('Conversation saved successfully');
    } catch (err) {
      log.error('Error sending message', {
        message: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Keep pending message visible on error so user can see what they sent
    } finally {
      setLoading(false);
      processingRef.current = false;
    }
  }, [transcriptId, transcriptText, conversation]);

  /**
   * Clear all messages from the conversation (soft reset)
   *
   * Keeps the conversation record but empties the messages array.
   * Useful for starting a fresh Q&A session without losing the conversation ID.
   */
  const clearConversation = useCallback(async () => {
    if (!conversation) {
      log.warn('No conversation to clear');
      return;
    }

    try {
      log.debug('Clearing conversation', { conversationId: conversation.id });
      await updateConversation(conversation.id, []);
      setPendingUserMessage(null); // Clear any pending message too
      setError(null);
    } catch (err) {
      log.error('Error clearing conversation', {
        message: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : 'Failed to clear conversation');
    }
  }, [conversation]);

  /**
   * Delete the conversation permanently
   *
   * Removes the conversation from IndexedDB entirely.
   * A new conversation will be created on the next message.
   */
  const deleteConversation = useCallback(async () => {
    if (!conversation) {
      log.warn('No conversation to delete');
      return;
    }

    try {
      log.debug('Deleting conversation', { conversationId: conversation.id });
      await dbDeleteConversation(conversation.id);
      setError(null);
    } catch (err) {
      log.error('Error deleting conversation', {
        message: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
    }
  }, [conversation]);

  // Compute displayed messages: DB messages + pending user message (optimistic UI)
  // Only add pending message if it's not already in DB (prevents duplicate key error during race condition)
  const dbMessages = conversation?.messages || [];
  const pendingNotInDb = pendingUserMessage && !dbMessages.some(m => m.id === pendingUserMessage.id);
  const displayedMessages = pendingNotInDb
    ? [...dbMessages, pendingUserMessage]
    : dbMessages;

  return {
    messages: displayedMessages,
    loading,
    error,
    dbError,
    conversationId: conversation?.id || null,
    sendMessage,
    clearConversation,
    deleteConversation,
    hasConversation: !!conversation,
  };
}

/**
 * Return type for the useConversationInfo hook
 */
export interface UseConversationInfoReturn {
  /** The conversation data (undefined if not found or loading) */
  conversation: Conversation | undefined;
  /** Database error from useLiveQuery (null if no error) */
  dbError: Error | null;
  /** Whether the hook is still loading initial data */
  isLoading: boolean;
}

/**
 * Hook to get basic conversation info without the full chat interface
 *
 * Useful for displaying conversation metadata in lists or previews.
 * Provides explicit error tracking to distinguish loading from error states.
 *
 * @param transcriptId - ID of the transcript
 * @returns Object with conversation data, error state, and loading state
 *
 * @example
 * ```tsx
 * function ConversationPreview({ transcriptId }) {
 *   const { conversation, dbError, isLoading } = useConversationInfo(transcriptId);
 *
 *   if (isLoading) {
 *     return <p>Loading...</p>;
 *   }
 *
 *   if (dbError) {
 *     return <p>Error: {dbError.message}</p>;
 *   }
 *
 *   if (!conversation) {
 *     return <p>No conversation yet</p>;
 *   }
 *
 *   return (
 *     <div>
 *       <p>{conversation.messages.length} messages</p>
 *       <p>Last updated: {conversation.updatedAt.toLocaleString()}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useConversationInfo(transcriptId: string): UseConversationInfoReturn {
  const [dbError, setDbError] = useState<Error | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const conversation = useLiveQuery(
    async () => {
      try {
        setDbError(null);
        const result = await getConversationByTranscript(transcriptId);
        setHasLoaded(true);
        return result;
      } catch (error) {
        conversationInfoLog.error('Error loading conversation', {
          message: error instanceof Error ? error.message : String(error),
        });
        setDbError(error instanceof Error ? error : new Error(String(error)));
        setHasLoaded(true);
        return undefined;
      }
    },
    [transcriptId],
    undefined
  );

  return {
    conversation,
    dbError,
    isLoading: !hasLoaded && conversation === undefined && dbError === null,
  };
}
