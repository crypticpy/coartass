import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Template } from "@/types/template";

type TemplateInput = Omit<Template, "id" | "createdAt">;

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

async function sha256Hex16(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  const hashArray = Array.from(new Uint8Array(digest));
  const fullHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return fullHex.substring(0, 16);
}

function stableStringify(value: unknown): string {
  function sortKeysDeep(input: unknown): unknown {
    if (Array.isArray(input)) {
      return input.map(sortKeysDeep);
    }
    if (input && typeof input === "object") {
      const record = input as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(record).sort()) {
        sorted[key] = sortKeysDeep(record[key]);
      }
      return sorted;
    }
    return input;
  }

  return JSON.stringify(sortKeysDeep(value));
}

async function computeHashV2(template: TemplateInput): Promise<string> {
  const contentForHash = {
    name: template.name,
    description: template.description,
    icon: template.icon,
    category: template.category,
    outputs: template.outputs,
    supportsSupplementalMaterial: template.supportsSupplementalMaterial || false,
    sections: template.sections.map((section) => ({
      id: section.id,
      name: section.name,
      prompt: section.prompt,
      extractEvidence: section.extractEvidence,
      outputFormat: section.outputFormat,
      dependencies: section.dependencies || [],
    })),
  };

  // Must match scripts/build-templates.mjs and lib/template-sync.ts (stableStringify).
  const stableJson = stableStringify(contentForHash);
  return sha256Hex16(stableJson);
}

async function computeHashLegacyV1(template: TemplateInput): Promise<string> {
  const contentForHash = {
    name: template.name,
    description: template.description,
    icon: template.icon,
    category: template.category,
    outputs: template.outputs,
    supportsSupplementalMaterial: template.supportsSupplementalMaterial || false,
    sections: template.sections.map((section) => ({
      id: section.id,
      name: section.name,
      prompt: section.prompt,
      extractEvidence: section.extractEvidence,
      outputFormat: section.outputFormat,
      dependencies: section.dependencies || [],
    })),
  };

  // Legacy v1: JSON replacer array filtered nested keys. Kept to test sync migration.
  const legacyJson = JSON.stringify(contentForHash, Object.keys(contentForHash).sort());
  return sha256Hex16(legacyJson);
}

const generatedTemplatesMock = vi.hoisted(() => {
  return {
    TEMPLATE_BUNDLE_VERSION: "test-bundle-v2",
    CURRENT_SCHEMA_VERSION: 1,
    BUILT_IN_TEMPLATES: [] as TemplateInput[],
  };
});

const dbState = vi.hoisted(() => {
  const templates = {
    items: [] as Template[],
    filter: (predicate: (t: Template) => boolean) => {
      return {
        toArray: async () => templates.items.filter(predicate),
        first: async () => templates.items.find(predicate),
      };
    },
    add: async (template: Template) => {
      templates.items.push(template);
      return template.id;
    },
    update: async (id: string, changes: Partial<Template>) => {
      const idx = templates.items.findIndex((t) => t.id === id);
      if (idx === -1) return 0;
      templates.items[idx] = { ...templates.items[idx], ...changes } as Template;
      return 1;
    },
  };

  return { templates };
});

vi.mock("@/lib/generated/templates", () => generatedTemplatesMock);
vi.mock("@/lib/db", () => {
  return { getDatabase: () => dbState };
});

import { synchronizeTemplates } from "@/lib/template-sync";

describe("template synchronization", () => {
  beforeEach(() => {
    (globalThis as unknown as { window?: object }).window = {};
    (globalThis as unknown as { localStorage?: Storage }).localStorage = new MemoryStorage();
    dbState.templates.items = [];
    generatedTemplatesMock.BUILT_IN_TEMPLATES.length = 0;
  });

  it("updates a built-in template when bundle changes and user has not modified it", async () => {
    const base: TemplateInput = {
      name: "MEF Questionnaire Completion (Phase 2)",
      description: "Test template",
      icon: "ClipboardCheck",
      category: "interview",
      isCustom: false,
      schemaVersion: 1,
      bundleCreatedAt: new Date("2025-01-01T00:00:00.000Z"),
      outputs: ["summary", "action_items"],
      sections: [
        {
          id: "s1",
          name: "Section 1",
          prompt: "Prompt",
          extractEvidence: true,
          outputFormat: "bullet_points",
        },
      ],
    };

    const oldBundleTemplate: TemplateInput = {
      ...base,
      supportsSupplementalMaterial: false,
    };
    const newBundleTemplate: TemplateInput = {
      ...base,
      supportsSupplementalMaterial: true,
    };

    const oldHash = await computeHashLegacyV1(oldBundleTemplate);
    const newHash = await computeHashV2(newBundleTemplate);

    // Bundle exports reflect the *new* template version.
    generatedTemplatesMock.BUILT_IN_TEMPLATES.push({
      ...newBundleTemplate,
      contentHash: newHash,
    });

    // Stored template reflects the *old* template version and was last synced with old hash.
    const stored: Template = {
      ...oldBundleTemplate,
      id: "t-1",
      createdAt: new Date("2025-01-02T00:00:00.000Z"),
      contentHash: oldHash,
      bundleVersion: "test-bundle-v1",
      lastSyncedAt: new Date("2025-01-02T00:00:00.000Z"),
    };
    dbState.templates.items = [stored];

    // Simulate the previous buggy state: localStorage says bundle/schema match already.
    localStorage.setItem("template-bundle-version", "test-bundle-v2");
    localStorage.setItem("template-schema-version", "1");
    // NOTE: we intentionally do NOT set template-sync-engine-version so the new code re-syncs.

    const result = await synchronizeTemplates();

    expect(result.stats.updated).toBe(1);
    expect(result.stats.skippedUserModified).toBe(0);

    const updated = dbState.templates.items[0];
    expect(updated.supportsSupplementalMaterial).toBe(true);
    expect(updated.contentHash).toBe(newHash);
    expect(updated.bundleVersion).toBe("test-bundle-v2");
    expect(localStorage.getItem("template-sync-engine-version")).toBe("2");
  });

  it("skips updating when the built-in template has user modifications", async () => {
    const base: TemplateInput = {
      name: "MEF Analysis Report (Phase 3)",
      description: "Test template",
      icon: "FileBarChart",
      category: "interview",
      isCustom: false,
      schemaVersion: 1,
      bundleCreatedAt: new Date("2025-01-01T00:00:00.000Z"),
      outputs: ["summary"],
      sections: [
        {
          id: "s1",
          name: "Section 1",
          prompt: "Prompt",
          extractEvidence: true,
          outputFormat: "bullet_points",
        },
      ],
    };

    const oldBundleTemplate: TemplateInput = { ...base, supportsSupplementalMaterial: false };
    const newBundleTemplate: TemplateInput = { ...base, supportsSupplementalMaterial: true };

    const oldHash = await computeHashLegacyV1(oldBundleTemplate);
    const newHash = await computeHashV2(newBundleTemplate);

    generatedTemplatesMock.BUILT_IN_TEMPLATES.push({
      ...newBundleTemplate,
      contentHash: newHash,
    });

    // User modified description after last sync (stored.contentHash remains oldHash)
    const stored: Template = {
      ...oldBundleTemplate,
      id: "t-2",
      createdAt: new Date("2025-01-02T00:00:00.000Z"),
      description: "User modified description",
      contentHash: oldHash,
      bundleVersion: "test-bundle-v1",
      lastSyncedAt: new Date("2025-01-02T00:00:00.000Z"),
    };
    dbState.templates.items = [stored];

    localStorage.setItem("template-bundle-version", "test-bundle-v2");
    localStorage.setItem("template-schema-version", "1");

    const result = await synchronizeTemplates();

    expect(result.stats.updated).toBe(0);
    expect(result.stats.skippedUserModified).toBe(1);
    expect(dbState.templates.items[0].supportsSupplementalMaterial).toBe(false);
    expect(localStorage.getItem("template-sync-engine-version")).toBe("2");
  });
});
