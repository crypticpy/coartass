import Dexie from "dexie";
import type { RtassScorecard } from "@/types/rtass";
import { DatabaseError, getDatabase } from "./core";

export async function saveRtassScorecard(scorecard: RtassScorecard): Promise<void> {
  try {
    const db = getDatabase();
    await db.rtassScorecards.put(scorecard);
  } catch (error) {
    throw new DatabaseError(
      "Failed to save RTASS scorecard",
      "SAVE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function getRtassScorecardsByTranscript(
  transcriptId: string
): Promise<RtassScorecard[]> {
  try {
    const db = getDatabase();
    return await db.rtassScorecards
      .where("[transcriptId+createdAt]")
      .between([transcriptId, Dexie.minKey], [transcriptId, Dexie.maxKey])
      .reverse()
      .toArray();
  } catch (error) {
    throw new DatabaseError(
      "Failed to get RTASS scorecards for transcript",
      "GET_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function getRtassScorecard(id: string): Promise<RtassScorecard | undefined> {
  try {
    const db = getDatabase();
    return await db.rtassScorecards.get(id);
  } catch (error) {
    throw new DatabaseError(
      "Failed to get RTASS scorecard",
      "GET_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}

export async function deleteRtassScorecard(id: string): Promise<void> {
  try {
    const db = getDatabase();
    await db.rtassScorecards.delete(id);
  } catch (error) {
    throw new DatabaseError(
      "Failed to delete RTASS scorecard",
      "DELETE_FAILED",
      error instanceof Error ? error : undefined
    );
  }
}
