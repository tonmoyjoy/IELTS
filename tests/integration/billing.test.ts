import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as checkout from "@/app/api/billing/checkout/route";
import * as success from "@/app/api/billing/sslcommerz/success/route";
import * as cancel from "@/app/api/billing/sslcommerz/cancel/route";
import * as ipn from "@/app/api/billing/sslcommerz/ipn/route";
import * as me from "@/app/api/auth/me/route";
import { Payment } from "@/server/models/Payment";
import { User } from "@/server/models/User";
import { confirmPayment } from "@/server/billing/payments";
import { resetEnvCache } from "@/server/env";
import { call } from "./helpers";
import { signInAs } from "./session-helpers";

const DAY = 24 * 60 * 60 * 1000;

type Validation = Record<string, string>;
let validations: Record<string, Validation> = {};
let initResponse: Record<string, string> = {};
let lastInit: URLSearchParams | null = null;

function configure() {
  vi.stubEnv("SSLCOMMERZ_STORE_ID", "teststore");
  vi.stubEnv("SSLCOMMERZ_STORE_PASSWORD", "secret");
  vi.stubEnv("SSLCOMMERZ_MODE", "sandbox");
  resetEnvCache();
}

beforeEach(() => {
  validations = {};
  initResponse = { status: "SUCCESS", GatewayPageURL: "https://sandbox.sslcommerz.com/pay/abc", sessionkey: "SK1" };
  lastInit = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/gwprocess/v4/api.php")) {
        lastInit = new URLSearchParams(String(init?.body));
        return Response.json(initResponse);
      }
      if (url.pathname.endsWith("/validator/api/validationserverAPI.php")) {
        expect(url.searchParams.get("store_passwd")).toBe("secret");
        return Response.json(validations[url.searchParams.get("val_id") ?? ""] ?? { status: "INVALID_TRANSACTION" });
      }
      throw new Error(`Unexpected fetch ${url}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetEnvCache();
});

async function startPayment(optionId = "pro-1m") {
  const res = await call(checkout.POST, { json: { optionId, name: "Rahim Uddin", phone: "01712345678" } });
  expect(res.status).toBe(200);
  const payment = await Payment.findOne({}).sort({ createdAt: -1 }).lean();
  return { res, payment: payment! };
}

function valid(tranId: string, amount: string, extra: Validation = {}): string {
  const valId = `VAL-${tranId}`;
  validations[valId] = { status: "VALID", tran_id: tranId, amount, currency_type: "BDT", card_type: "BKASH-BKash", risk_level: "0", ...extra };
  return valId;
}

describe("checkout", () => {
  it("is unavailable until the store is configured", async () => {
    await signInAs("noconfig@example.com");
    const res = await call(checkout.POST, { json: { optionId: "pro-1m", name: "Rahim", phone: "01712345678" } });
    expect(res.status).toBe(503);
  });

  it("creates a pending payment priced on the server and returns the gateway URL", async () => {
    configure();
    await signInAs("buyer@example.com");
    const res = await call(checkout.POST, {
      json: { optionId: "pro-12m", name: "Rahim", phone: "+880 1712-345678", amount: 1 },
    });
    expect(res.body.url).toBe("https://sandbox.sslcommerz.com/pay/abc");
    const payment = await Payment.findOne({}).lean();
    expect(payment).toMatchObject({ status: "pending", amount: 1500, days: 365, currency: "BDT", sessionKey: "SK1" });
    expect(lastInit?.get("total_amount")).toBe("1500.00");
    expect(lastInit?.get("cus_phone")).toBe("+8801712345678");
    expect(lastInit?.get("success_url")).toMatch(/\/api\/billing\/sslcommerz\/success$/);
    expect(lastInit?.get("product_profile")).toBe("non-physical-goods");
  });

  it("rejects bad phone numbers and unknown plans", async () => {
    configure();
    await signInAs("typo@example.com");
    expect((await call(checkout.POST, { json: { optionId: "pro-1m", name: "Rahim", phone: "12345" } })).status).toBe(400);
    expect((await call(checkout.POST, { json: { optionId: "pro-forever", name: "Rahim", phone: "01712345678" } })).status).toBe(400);
  });

  it("marks the payment failed when the gateway refuses the session", async () => {
    configure();
    await signInAs("refused@example.com");
    initResponse = { status: "FAILED", failedreason: "Store is inactive" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(checkout.POST, { json: { optionId: "pro-1m", name: "Rahim", phone: "01712345678" } });
    expect(res.status).toBe(502);
    expect((await Payment.findOne({}).lean())?.status).toBe("failed");
  });
});

describe("payment confirmation", () => {
  beforeEach(configure);

  it("activates Pro once, even when the redirect and the IPN both arrive", async () => {
    const userId = await signInAs("payer@example.com");
    const { payment } = await startPayment("pro-1m");
    const valId = valid(payment.tranId, "300.00");

    const redirect = await call(success.POST, {
      body: new URLSearchParams({ val_id: valId, tran_id: payment.tranId, status: "VALID" }),
      headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://sandbox.sslcommerz.com" },
    });
    expect(redirect.status).toBe(303);
    expect(redirect.headers.get("location")).toMatch(/\/billing\?payment=success$/);

    const user1 = await User.findById(userId).lean();
    expect(user1?.plan).toBe("pro");
    const firstExpiry = user1!.planExpiresAt!.getTime();
    expect(firstExpiry - Date.now()).toBeGreaterThan(29 * DAY);
    expect(firstExpiry - Date.now()).toBeLessThanOrEqual(30 * DAY);

    const notification = await call(ipn.POST, {
      body: new URLSearchParams({ val_id: valId, tran_id: payment.tranId, status: "VALID" }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(notification.status).toBe(200);
    expect(String(notification.body.raw)).toBe("already_paid");
    expect((await User.findById(userId).lean())!.planExpiresAt!.getTime()).toBe(firstExpiry);

    const stored = await Payment.findById(payment._id).lean();
    expect(stored).toMatchObject({ status: "paid", cardType: "BKASH-BKash" });
    expect((await call(me.GET)).body.user).toMatchObject({ plan: "pro" });
  });

  it("extends from the current expiry when buying again", async () => {
    const userId = await signInAs("loyal@example.com");
    const existing = new Date(Date.now() + 10 * DAY);
    await User.updateOne({ _id: userId }, { $set: { plan: "pro", planExpiresAt: existing } });
    const { payment } = await startPayment("pro-3m");
    expect(await confirmPayment(valid(payment.tranId, "600.00"), payment.tranId)).toBe("paid");
    const after = (await User.findById(userId).lean())!.planExpiresAt!.getTime();
    expect(after).toBe(existing.getTime() + 90 * DAY);
  });

  it("holds payments whose amount or currency does not match", async () => {
    const userId = await signInAs("tamper@example.com");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { payment } = await startPayment("pro-12m");
    expect(await confirmPayment(valid(payment.tranId, "15.00"), payment.tranId)).toBe("review");
    expect((await User.findById(userId).lean())?.plan).toBe("free");
    expect((await Payment.findById(payment._id).lean())?.status).toBe("review");

    const second = await startPayment("pro-1m");
    expect(await confirmPayment(valid(second.payment.tranId, "300.00", { currency_type: "USD" }), second.payment.tranId)).toBe("review");
  });

  it("holds high-risk payments for manual review", async () => {
    const userId = await signInAs("risky@example.com");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { payment } = await startPayment("pro-1m");
    expect(await confirmPayment(valid(payment.tranId, "300.00", { risk_level: "1" }), payment.tranId)).toBe("review");
    expect((await User.findById(userId).lean())?.plan).toBe("free");
  });

  it("rejects forged callbacks", async () => {
    const userId = await signInAs("victim@example.com");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { payment } = await startPayment("pro-1m");

    // Unknown val_id: the gateway says INVALID_TRANSACTION.
    const forged = await call(success.POST, {
      body: new URLSearchParams({ val_id: "made-up", tran_id: payment.tranId, status: "VALID" }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(forged.headers.get("location")).toMatch(/payment=failed$/);

    // A real val_id for a different transaction cannot be replayed onto this one.
    const other = valid("SOMEONE-ELSES-TRAN", "300.00");
    expect(await confirmPayment(other, payment.tranId)).toBe("rejected");
    expect((await User.findById(userId).lean())?.plan).toBe("free");
  });

  it("still honours a valid payment after a cancel callback", async () => {
    const userId = await signInAs("changedmind@example.com");
    const { payment } = await startPayment("pro-1m");
    const res = await call(cancel.POST, {
      body: new URLSearchParams({ tran_id: payment.tranId }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(res.headers.get("location")).toMatch(/payment=cancelled$/);
    expect((await Payment.findById(payment._id).lean())?.status).toBe("cancelled");

    expect(await confirmPayment(valid(payment.tranId, "300.00"), payment.tranId)).toBe("paid");
    expect((await User.findById(userId).lean())?.plan).toBe("pro");
  });

  it("expired Pro falls back to Free limits", async () => {
    const userId = await signInAs("lapsed@example.com");
    await User.updateOne({ _id: userId }, { $set: { plan: "pro", planExpiresAt: new Date(Date.now() - 1000) } });
    const profile = await call(me.GET);
    expect(profile.body.user).toMatchObject({ plan: "free", planExpiresAt: null });
    expect((profile.body.usage as { plan: string }).plan).toBe("free");
  });
});
