import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { TestResult } from "@/lib/models/TestResult";
import { getSessionUserId } from "@/lib/auth/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDb();
  const tests = await TestResult.find({ user: userId }).sort({ date: 1 }).lean();

  return NextResponse.json({
    tests: tests.map((t) => ({
      id: String(t._id),
      transcript: t.transcript,
      bandScore: t.bandScore,
      breakdown: t.breakdown,
      summary: t.summary,
      date: t.date,
    })),
  });
}
