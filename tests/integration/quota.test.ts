import mongoose from "mongoose";
import { beforeAll, describe, expect, it } from "vitest";
import { getUsageSummary, releaseQuota, reserveQuota } from "@/server/billing/quota";
import { signInAs } from "./session-helpers";
import { PLANS } from "@/lib/plans";

/**
 * FerretDB (a MongoDB-compatible server sometimes used for local runs) does
 * not make single-document updates atomic, so concurrency guarantees can only
 * be verified against real MongoDB. CI always uses real MongoDB.
 */
let atomicBackend = true;
beforeAll(async () => {
  const info = await mongoose.connection.db!.admin().command({ buildInfo: 1 });
  atomicBackend = !("ferretdbVersion" in info);
});

describe("daily quota", () => {
  it("stops at the limit", async () => {
    const userId = await signInAs("serial@example.com");
    const limit = PLANS.free.dailyLimits.writing;
    for (let i = 0; i < limit; i += 1) await reserveQuota(userId, "free", "writing");
    await expect(reserveQuota(userId, "free", "writing")).rejects.toMatchObject({ status: 429, code: "QUOTA_EXCEEDED" });
  });

  it("never lets concurrent requests exceed the limit (real MongoDB only)", async (ctx) => {
    if (!atomicBackend) ctx.skip();
    const userId = await signInAs("racer@example.com");
    const limit = PLANS.free.dailyLimits.writing;
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => reserveQuota(userId, "free", "writing")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(limit);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected.every((r) => (r.reason as { code?: string }).code === "QUOTA_EXCEEDED")).toBe(true);
    expect((await getUsageSummary(userId, "free")).features.writing).toMatchObject({ used: limit, remaining: 0 });
  });

  it("refunds a reservation and keeps features independent", async () => {
    const userId = await signInAs("refund@example.com");
    await reserveQuota(userId, "free", "speaking");
    await releaseQuota(userId, "speaking");
    await releaseQuota(userId, "speaking"); // never goes negative
    const usage = await getUsageSummary(userId, "free");
    expect(usage.features.speaking.used).toBe(0);
    expect(usage.features.writing.used).toBe(0);
  });

  it("applies the plan's limits", async () => {
    const userId = await signInAs("pro@example.com", { plan: "pro" });
    for (let i = 0; i < PLANS.free.dailyLimits.writing + 1; i += 1) await reserveQuota(userId, "pro", "writing");
    expect((await getUsageSummary(userId, "pro")).features.writing.limit).toBe(PLANS.pro.dailyLimits.writing);
  });
});
