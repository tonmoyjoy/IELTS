import { describe, expect, it } from "vitest";
import { BILLING_OPTIONS, effectivePlan, formatBdt, getBillingOption } from "@/lib/plans";

describe("plans", () => {
  it("prices match the published plans", () => {
    expect(BILLING_OPTIONS.map((o) => [o.id, o.amountBdt, o.days])).toEqual([
      ["pro-1m", 300, 30],
      ["pro-3m", 600, 90],
      ["pro-12m", 1500, 365],
    ]);
    // SSLCommerz minimum transaction is ৳10.
    expect(BILLING_OPTIONS.every((o) => o.amountBdt >= 10)).toBe(true);
    expect(getBillingOption("pro-forever")).toBeUndefined();
  });

  it("respects expiry", () => {
    const now = new Date("2026-11-08T00:00:00Z");
    expect(effectivePlan("pro", new Date("2026-12-01T00:00:00Z"), now)).toBe("pro");
    expect(effectivePlan("pro", new Date("2026-11-07T00:00:00Z"), now)).toBe("free");
    expect(effectivePlan("pro", null, now)).toBe("pro"); // manual grant
    expect(effectivePlan("free", new Date("2030-01-01"), now)).toBe("free");
    expect(effectivePlan(undefined, undefined, now)).toBe("free");
  });

  it("formats taka", () => {
    expect(formatBdt(1500)).toBe("৳1,500");
  });
});
