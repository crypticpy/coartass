/**
 * Conversation DB Operations (client-side only)
 */

import type { ChatMessage, Conversation } from "@/types/chat";
import { DatabaseError, getDatabase } from "./core";

export async function saveConversation(conversation: Conversation): Promise<string> {
  try {
    const db = getDatabase();

    // Ensure dates are Date objects
    const conversationToSave: Conversation = {
      ...conversation,
      createdAt: conversation.createdAt instanceof Date ? conversation.createdAt : new Date(conversation.createdAt),
      updatedAt: conversation.updatedAt instanceof Date ? conversation.updatedAt : new Date(conversation.updatedAt),
      // Ensure all message timestamps are Date objects
      messages: conversation.messages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
      })),
    };

    await db.conversations.put(conversationToSave);
    return conversation.id;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      throw new DatabaseError(
        "Storage quota exceeded. Please delete some conversations to free up space.",
        "QUOTA_EXCEEDED",
        error
      );
    }
    throw new DatabaseError(
      "Failed to save conversation",
      "SAVE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function getConversationByTranscript(
  transcriptId: string
): Promise<Conversation | undefined> {
  try {
    const db = getDatabase();
    return await db.conversations.where("transcriptId").equals(transcriptId).first();
  } catch (error) {
    throw new DatabaseError(
      `Failed to retrieve conversation for transcript ID: ${transcriptId}`,
      "GET_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function updateConversation(conversationId: string, messages: ChatMessage[]): Promise<void> {
  try {
    const db = getDatabase();

    // Ensure all message timestamps are Date objects
    const normalizedMessages = messages.map((msg) => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
    }));

    await db.conversations.update(conversationId, {
      messages: normalizedMessages,
      updatedAt: new Date(),
    });
  } catch (error) {
    throw new DatabaseError(
      `Failed to update conversation with ID: ${conversationId}`,
      "UPDATE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function deleteConversation(conversationId: string): Promise<void> {
  try {
    const db = getDatabase();
    await db.conversations.delete(conversationId);
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete conversation with ID: ${conversationId}`,
      "DELETE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function getAllConversations(): Promise<Conversation[]> {
  try {
    const db = getDatabase();
    return await db.conversations.orderBy("updatedAt").reverse().toArray();
  } catch (error) {
    throw new DatabaseError(
      "Failed to retrieve conversations",
      "GET_ALL_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

