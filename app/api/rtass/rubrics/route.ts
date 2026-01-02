import { z } from "zod";
import path from "path";
import { promises as fs } from "fs";
import { successResponse, errorResponse } from "@/lib/api-utils";

const rubricSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  jurisdiction: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1).optional(),
  sections: z.array(z.unknown()).min(1),
  scoring: z.unknown(),
  llm: z.unknown(),
});

function isSafeRubricFilename(filename: string): boolean {
  if (!/^[a-z0-9._-]+\.json$/i.test(filename)) return false;
  if (filename.endsWith(".schema.json")) return false;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return false;
  return true;
}

export async function GET(request: Request) {
  try {
    const dir = path.join(process.cwd(), "data", "rtass-rubrics");
    const url = new URL(request.url);
    const file = url.searchParams.get("file");

    if (file) {
      if (!isSafeRubricFilename(file)) {
        return errorResponse("Invalid rubric file", 400, { type: "invalid_file" });
      }

      const filePath = path.join(dir, file);
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const rubric = rubricSchema.parse(parsed);
      return successResponse(rubric);
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });

    const rubrics = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".json")) continue;
      if (entry.name.endsWith(".schema.json")) continue;

      const filePath = path.join(dir, entry.name);
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const rubric = rubricSchema.parse(parsed);

      rubrics.push({
        id: rubric.id,
        name: rubric.name,
        description: rubric.description,
        version: rubric.version,
        jurisdiction: rubric.jurisdiction,
        tags: rubric.tags,
        createdAt: rubric.createdAt,
        updatedAt: rubric.updatedAt,
        _sourceFile: entry.name,
      });
    }

    rubrics.sort((a, b) => a.name.localeCompare(b.name));
    return successResponse(rubrics);
  } catch (error) {
    return errorResponse("Failed to load RTASS rubrics", 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
