/**
 * Template DB Operations
 */

import type { Template } from "@/types/template";
import { DatabaseError, getDatabase } from "./core";

export async function saveTemplate(template: Template): Promise<string> {
  try {
    const db = getDatabase();

    // Ensure dates are Date objects
    const templateToSave: Template = {
      ...template,
      createdAt: template.createdAt instanceof Date ? template.createdAt : new Date(template.createdAt),
    };

    await db.templates.put(templateToSave);
    return template.id;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      throw new DatabaseError(
        "Storage quota exceeded. Please delete some templates to free up space.",
        "QUOTA_EXCEEDED",
        error
      );
    }
    throw new DatabaseError(
      "Failed to save template",
      "SAVE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function getTemplate(id: string): Promise<Template | undefined> {
  try {
    const db = getDatabase();
    return await db.templates.get(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to retrieve template with ID: ${id}`,
      "GET_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function getAllTemplates(): Promise<Template[]> {
  try {
    const db = getDatabase();
    return await db.templates.toArray();
  } catch (error) {
    throw new DatabaseError(
      "Failed to retrieve templates",
      "GET_ALL_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  try {
    const db = getDatabase();

    // Check if template exists and is custom
    const template = await db.templates.get(id);

    if (!template) {
      throw new DatabaseError(`Template with ID ${id} not found`, "NOT_FOUND");
    }

    if (!template.isCustom) {
      throw new DatabaseError(
        "Cannot delete built-in templates. Only custom templates can be deleted.",
        "NOT_CUSTOM"
      );
    }

    // Use a transaction to ensure both deletions succeed or fail together
    await db.transaction("rw", [db.templates, db.analyses], async () => {
      // Delete the template
      await db.templates.delete(id);

      // Delete all associated analyses
      await db.analyses.where("templateId").equals(id).delete();
    });
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(
      `Failed to delete template with ID: ${id}`,
      "DELETE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

