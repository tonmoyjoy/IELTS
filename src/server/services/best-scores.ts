import "server-only";
import { Types } from "mongoose";
import { connectDb } from "@/server/db";
import { PracticeAttempt } from "@/server/models/PracticeAttempt";
import type { IeltsModule } from "@/lib/modules";

/** Best band per content item for one module, for "your best" badges on practice lists. */
export async function getBestScores(userId: string, module: IeltsModule): Promise<Map<string, number>> {
  await connectDb();
  const rows = (await PracticeAttempt.find({ user: new Types.ObjectId(userId), module })
    .select("contentId score")
    .limit(1000)
    .lean()) as Array<{ contentId?: string | null; score: number }>;
  const best = new Map<string, number>();
  for (const row of rows) {
    if (!row.contentId) continue;
    best.set(row.contentId, Math.max(best.get(row.contentId) ?? 0, row.score));
  }
  return best;
}
