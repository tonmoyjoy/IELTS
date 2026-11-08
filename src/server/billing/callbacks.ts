import "server-only";
import { getAppUrl } from "@/server/env";
import { log } from "@/server/log";
import { confirmPayment, markPaymentClosed } from "@/server/billing/payments";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { getClientIp } from "@/server/http/client-ip";

/** Each callback costs a gateway round-trip, so cap how often one IP can trigger them. */
async function allowed(req: Request, kind: string, limit: number): Promise<boolean> {
  try {
    await enforceRateLimit([{ key: `billing:${kind}:${getClientIp(req.headers)}`, limit, windowSeconds: 10 * 60 }]);
    return true;
  } catch {
    return false;
  }
}

/**
 * SSLCommerz posts the customer's browser back to these URLs with a
 * cross-site form POST, so they cannot use the session cookie or the
 * same-origin guard. Nothing posted is trusted: success is confirmed with
 * the gateway's validation API.
 */

async function readForm(req: Request): Promise<Record<string, string>> {
  try {
    const form = await req.formData();
    const out: Record<string, string> = {};
    for (const [key, value] of form.entries()) if (typeof value === "string") out[key] = value.slice(0, 200);
    return out;
  } catch {
    return {};
  }
}

function backToBilling(status: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: `${getAppUrl()}/billing?payment=${status}`, "Cache-Control": "no-store" },
  });
}

export async function handleSuccess(req: Request) {
  if (!(await allowed(req, "success", 30))) return backToBilling("pending");
  const form = await readForm(req);
  if (!form.val_id) return backToBilling("failed");
  try {
    const outcome = await confirmPayment(form.val_id, form.tran_id);
    return backToBilling(outcome === "paid" || outcome === "already_paid" ? "success" : outcome === "review" ? "review" : "failed");
  } catch (error) {
    // Gateway unreachable: the IPN will settle it; tell the user we're confirming.
    log.error("billing.success_callback_failed", { tranId: form.tran_id, error });
    return backToBilling("pending");
  }
}

export async function handleClosed(req: Request, status: "failed" | "cancelled") {
  const form = await readForm(req);
  await markPaymentClosed(form.tran_id ?? "", status).catch((error) => log.error("billing.close_failed", { error }));
  return backToBilling(status);
}

export async function handleIpn(req: Request) {
  if (!(await allowed(req, "ipn", 300))) return new Response("slow down", { status: 429 });
  const form = await readForm(req);
  if (form.status === "VALID" && form.val_id) {
    try {
      const outcome = await confirmPayment(form.val_id, form.tran_id);
      return new Response(outcome, { status: 200 });
    } catch (error) {
      log.error("billing.ipn_failed", { tranId: form.tran_id, error });
      return new Response("retry", { status: 500 });
    }
  }
  if (form.status === "FAILED" || form.status === "CANCELLED" || form.status === "EXPIRED") {
    await markPaymentClosed(form.tran_id ?? "", form.status === "FAILED" ? "failed" : "cancelled");
  }
  return new Response("ok", { status: 200 });
}
