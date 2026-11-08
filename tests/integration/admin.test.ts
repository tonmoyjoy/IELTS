import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import * as paymentAction from "@/app/api/admin/payments/[id]/route";
import * as userAction from "@/app/api/admin/users/[id]/route";
import { Payment, type PaymentStatus } from "@/server/models/Payment";
import { User } from "@/server/models/User";
import { AdminAuditLog } from "@/server/models/AdminAuditLog";
import { getRevenueStats, listAdminPayments, searchUsers } from "@/server/services/admin";
import { resetEnvCache } from "@/server/env";
import { call, cookieJar } from "./helpers";
import { signInAs } from "./session-helpers";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAILS", "Boss@Example.com, second@example.com");
  resetEnvCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

async function customerWithPayment(status: PaymentStatus, extra: Record<string, unknown> = {}) {
  const customer = await User.create({ email: `c${Date.now()}${Math.random()}@example.com`, password: "x", emailVerified: true });
  const payment = await Payment.create({
    user: customer._id,
    tranId: `IPS${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    optionId: "pro-1m",
    days: 30,
    amount: 300,
    status,
    ...extra,
  });
  return { customer, payment };
}

describe("admin access", () => {
  it("is invisible (404) to signed-in non-admins and anonymous users", async () => {
    const { payment, customer } = await customerWithPayment("review");
    expect((await call(paymentAction.POST, { json: { action: "approve" }, params: { id: String(payment._id) } })).status).toBe(404);
    await signInAs("student@example.com");
    const res = await call(paymentAction.POST, { json: { action: "approve" }, params: { id: String(payment._id) } });
    expect(res.status).toBe(404);
    const grant = await call(userAction.POST, { json: { action: "grant", days: 30 }, params: { id: String(customer._id) } });
    expect(grant.status).toBe(404);
    expect((await Payment.findById(payment._id).lean())?.status).toBe("review");
  });

  it("requires same-origin requests even for admins", async () => {
    await signInAs("boss@example.com");
    const { payment } = await customerWithPayment("review");
    const res = await call(paymentAction.POST, {
      json: { action: "approve" },
      params: { id: String(payment._id) },
      headers: { origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
  });
});

describe("payment review", () => {
  it("approving grants Pro once and is audit-logged", async () => {
    await signInAs("boss@example.com");
    const { payment, customer } = await customerWithPayment("review", { riskLevel: "1" });
    const res = await call(paymentAction.POST, { json: { action: "approve", note: "Checked in panel" }, params: { id: String(payment._id) } });
    expect(res.status).toBe(200);

    const user = await User.findById(customer._id).lean();
    expect(user?.plan).toBe("pro");
    expect(user!.planExpiresAt!.getTime() - Date.now()).toBeGreaterThan(29 * DAY);
    expect((await Payment.findById(payment._id).lean())?.status).toBe("paid");

    const again = await call(paymentAction.POST, { json: { action: "approve" }, params: { id: String(payment._id) } });
    expect(again.status).toBe(409);
    const log = await AdminAuditLog.findOne({ action: "payment.approve" }).lean();
    expect(log).toMatchObject({ adminEmail: "boss@example.com", note: "Checked in panel" });
  });

  it("rejecting marks the payment failed without granting Pro", async () => {
    await signInAs("boss@example.com");
    const { payment, customer } = await customerWithPayment("review");
    expect((await call(paymentAction.POST, { json: { action: "reject" }, params: { id: String(payment._id) } })).status).toBe(200);
    expect((await Payment.findById(payment._id).lean())?.status).toBe("failed");
    expect((await User.findById(customer._id).lean())?.plan).toBe("free");
  });

  it("refuses to touch settled payments", async () => {
    await signInAs("boss@example.com");
    const { payment } = await customerWithPayment("cancelled");
    expect((await call(paymentAction.POST, { json: { action: "approve" }, params: { id: String(payment._id) } })).status).toBe(409);
    expect((await call(paymentAction.POST, { json: { action: "reject" }, params: { id: new Types.ObjectId().toString() } })).status).toBe(404);
  });
});

describe("manual Pro", () => {
  it("grants, extends and revokes Pro", async () => {
    await signInAs("second@example.com");
    const customer = await User.create({ email: "gift@example.com", password: "x", emailVerified: true });
    const id = String(customer._id);

    expect((await call(userAction.POST, { json: { action: "grant", days: 30 }, params: { id } })).status).toBe(200);
    const first = (await User.findById(id).lean())!.planExpiresAt!.getTime();
    await call(userAction.POST, { json: { action: "grant", days: 7 }, params: { id } });
    expect((await User.findById(id).lean())!.planExpiresAt!.getTime()).toBe(first + 7 * DAY);

    expect((await call(userAction.POST, { json: { action: "revoke", note: "Refunded" }, params: { id } })).status).toBe(200);
    const revoked = await User.findById(id).lean();
    expect(revoked?.plan).toBe("free");
    expect(revoked?.planExpiresAt).toBeUndefined();
    expect(await AdminAuditLog.countDocuments({ targetUser: customer._id })).toBe(3);
  });

  it("validates input", async () => {
    await signInAs("boss@example.com");
    const customer = await User.create({ email: "v@example.com", password: "x" });
    expect((await call(userAction.POST, { json: { action: "grant", days: 0 }, params: { id: String(customer._id) } })).status).toBe(400);
    expect((await call(userAction.POST, { json: { action: "delete" }, params: { id: String(customer._id) } })).status).toBe(400);
  });
});

describe("reporting", () => {
  it("summarises revenue and finds payments by email or reference", async () => {
    const { payment, customer } = await customerWithPayment("paid", { paidAt: new Date() });
    await customerWithPayment("paid", { paidAt: new Date(Date.now() - 40 * DAY), amount: 1500, optionId: "pro-12m", days: 365 });
    await customerWithPayment("failed");
    cookieJar.clear();

    const stats = await getRevenueStats();
    expect(stats.revenue).toEqual({ today: 300, last30Days: 300, allTime: 1800 });
    expect(stats.byOption[0]).toMatchObject({ optionId: "pro-12m", amount: 1500 });

    expect((await listAdminPayments({ q: payment.tranId })).rows.map((r) => r.id)).toEqual([String(payment._id)]);
    expect((await listAdminPayments({ q: customer.email.slice(0, 6) })).rows.some((r) => r.id === String(payment._id))).toBe(true);
    expect((await listAdminPayments({ status: "failed" })).rows).toHaveLength(1);
    expect((await listAdminPayments({ q: ".*" })).rows).toHaveLength(0); // regex characters are escaped
    expect((await searchUsers(customer.email)).map((u) => u.id)).toEqual([String(customer._id)]);
  });
});
