/**
 * Chat Type Definitions
 *
 * Types for the transcript Q&A chat feature with CLIENT-SIDE ONLY storage.
 * All conversation data is stored in browser IndexedDB - never on the server.
 *
 * Privacy Model:
 * - Conversations stored in user's browser IndexedDB
 * - API endpoint is completely STATELESS (stores nothing)
 * - Chat data never persisted server-side
 */

/**
 * A single message in a conversation between user and assistant.
 *
 * Messages are immutable once created and stored in the conversation's
 * message array in chronological order.
 */
export interface ChatMessage {
  /** Unique identifier for this message */
  id: string;

  /** Role of the message sender */
  role: 'user' | 'assistant';

  /** The message content/text */
  content: string;

  /** When the message was created */
  timestamp: Date;

  /** Model name that generated this response (assistant messages only) */
  model?: string;
}

/**
 * A conversation thread for Q&A about a specific transcript.
 *
 * Stored in browser IndexedDB and linked to a transcript via transcriptId.
 * One conversation per transcript (1:1 relationship).
 */
export interface Conversation {
  /** Unique identifier for this conversation */
  id: string;

  /** Foreign key to the transcript this conversation is about */
  transcriptId: string;

  /** Array of messages in chronological order (oldest first) */
  messages: ChatMessage[];

  /** When the conversation was first created */
  createdAt: Date;

  /** When the conversation was last updated (new message added) */
  updatedAt: Date;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request body for the stateless chat API endpoint.
 *
 * The endpoint receives all context in each request (stateless design).
 * Transcript text is sent with every request to provide context for the LLM.
 */
export interface ChatRequest {
  /** ID of the transcript being discussed */
  transcriptId: string;

  /** Full transcript text (sent with each request for LLM context) */
  transcriptText: string;

  /** The user's question */
  question: string;

  /** Optional conversation history for multi-turn context */
  conversationHistory?: ChatMessage[];
}

/**
 * Success response from the chat API endpoint.
 */
export interface ChatResponse {
  /** The assistant's answer to the question */
  answer: string;

  /** The model/deployment that generated the response */
  model: string;
}

/**
 * Error information from the chat API endpoint.
 */
export interface ChatError {
  /** Type of error that occurred */
  type: 'validation' | 'token_limit' | 'api_failure' | 'unknown';

  /** Human-readable error message */
  message: string;

  /** Optional additional error details */
  details?: Record<string, unknown>;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Helper type for creating a new conversation (before ID and timestamps).
 */
export type ConversationInput = Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Helper type for creating a new message (before ID and timestamp).
 */
export type ChatMessageInput = Omit<ChatMessage, 'id' | 'timestamp'>;

/**
 * Status of a chat operation (for UI loading states).
 */
export type ChatStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Configuration options for chat behavior.
 */
export interface ChatConfig {
  /** Maximum number of messages to include in conversation history */
  maxHistoryMessages?: number;

  /** Maximum tokens to allow in a single request */
  maxTokens?: number;

  /** Whether to include conversation history in API calls */
  includeHistory?: boolean;
}

/**
 * Default chat configuration.
 *
 * Note: maxHistoryMessages is set to 20 to prevent token limit errors
 * when sending conversation history to the API. The full history is
 * still stored in IndexedDB for display purposes.
 */
export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  maxHistoryMessages: 20, // Matches use-chat.ts implementation (prevents token overflow)
  maxTokens: 100000, // Conservative limit (~400k chars)
  includeHistory: true,
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a value is a valid ChatMessage.
 *
 * @param value - Value to check
 * @returns True if value is a ChatMessage
 */
export function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const msg = value as ChatMessage;
  return (
    typeof msg.id === 'string' &&
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string' &&
    msg.timestamp instanceof Date
  );
}

/**
 * Type guard to check if a value is a valid Conversation.
 *
 * @param value - Value to check
 * @returns True if value is a Conversation
 */
export function isConversation(value: unknown): value is Conversation {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const conv = value as Conversation;
  return (
    typeof conv.id === 'string' &&
    typeof conv.transcriptId === 'string' &&
    Array.isArray(conv.messages) &&
    conv.messages.every(isChatMessage) &&
    conv.createdAt instanceof Date &&
    conv.updatedAt instanceof Date
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate the estimated token count for a conversation.
 *
 * Uses the same approximation as token-utils.ts (1 token ≈ 4 characters).
 * Includes transcript text, all messages, and system prompt overhead.
 *
 * @param transcriptText - The full transcript text
 * @param messages - Array of conversation messages
 * @returns Estimated total token count
 */
export function estimateConversationTokens(
  transcriptText: string,
  messages: ChatMessage[]
): number {
  // System prompt overhead (approximate)
  const systemPromptTokens = 200;

  // Transcript tokens
  const transcriptTokens = Math.ceil(transcriptText.length / 4);

  // Message tokens
  const messageTokens = messages.reduce((sum, msg) => {
    return sum + Math.ceil(msg.content.length / 4);
  }, 0);

  return systemPromptTokens + transcriptTokens + messageTokens;
}

/**
 * Format a timestamp for display in the chat UI.
 *
 * @param timestamp - The timestamp to format
 * @returns Formatted string (e.g., "2:30 PM" or "Yesterday 2:30 PM")
 */
export function formatMessageTimestamp(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Same day - just show time
  if (diff < oneDayMs && now.getDate() === timestamp.getDate()) {
    return timestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // Yesterday
  if (diff < 2 * oneDayMs) {
    return `Yesterday ${timestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }

  // Older - show date and time
  return timestamp.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Get the last message in a conversation.
 *
 * @param conversation - The conversation
 * @returns The last message, or undefined if no messages
 */
export function getLastMessage(conversation: Conversation): ChatMessage | undefined {
  if (conversation.messages.length === 0) {
    return undefined;
  }
  return conversation.messages[conversation.messages.length - 1];
}

/**
 * Count messages by role in a conversation.
 *
 * @param conversation - The conversation
 * @returns Object with user and assistant message counts
 */
export function countMessagesByRole(conversation: Conversation): {
  user: number;
  assistant: number;
} {
  return conversation.messages.reduce(
    (counts, msg) => {
      if (msg.role === 'user') {
        counts.user++;
      } else {
        counts.assistant++;
      }
      return counts;
    },
    { user: 0, assistant: 0 }
  );
}
