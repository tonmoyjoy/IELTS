import "server-only";
import { getEnv } from "@/server/env";
import { ApiError } from "@/server/http/api";

/**
 * Minimal SSLCommerz v4 client: session initiation and order validation.
 * One integration covers bKash, Nagad, Rocket, internet banking and
 * Visa/Mastercard/Amex on the gateway's hosted payment page.
 *
 * Docs: https://sandbox-gw.sslcommerz.com/docs (initiation, IPN) and
 *       https://sandbox-gw.sslcommerz.com/doc/v4/order-validation.html
 */

const HOSTS = {
  sandbox: "https://sandbox.sslcommerz.com",
  live: "https://securepay.sslcommerz.com",
} as const;

export function isPaymentConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.SSLCOMMERZ_STORE_ID && env.SSLCOMMERZ_STORE_PASSWORD);
}

function credentials() {
  const env = getEnv();
  if (!env.SSLCOMMERZ_STORE_ID || !env.SSLCOMMERZ_STORE_PASSWORD) {
    throw new ApiError(503, "PAYMENTS_UNAVAILABLE", "Online payments are not available yet. Please try again later.");
  }
  return {
    storeId: env.SSLCOMMERZ_STORE_ID,
    storePassword: env.SSLCOMMERZ_STORE_PASSWORD,
    host: (env.SSLCOMMERZ_BASE_URL ?? HOSTS[env.SSLCOMMERZ_MODE]).replace(/\/+$/, ""),
  };
}

export type InitSessionInput = {
  tranId: string;
  amount: number;
  productName: string;
  customer: { name: string; email: string; phone: string };
  urls: { success: string; fail: string; cancel: string; ipn: string };
};

export async function initSession(input: InitSessionInput): Promise<{ gatewayUrl: string; sessionKey: string }> {
  const { storeId, storePassword, host } = credentials();
  const body = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePassword,
    total_amount: input.amount.toFixed(2),
    currency: "BDT",
    tran_id: input.tranId,
    success_url: input.urls.success,
    fail_url: input.urls.fail,
    cancel_url: input.urls.cancel,
    ipn_url: input.urls.ipn,
    emi_option: "0",
    cus_name: input.customer.name,
    cus_email: input.customer.email,
    cus_phone: input.customer.phone,
    cus_add1: "N/A",
    cus_city: "Dhaka",
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    num_of_item: "1",
    product_name: input.productName,
    product_category: "Education",
    product_profile: "non-physical-goods",
  });

  const res = await fetch(`${host}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => null)) as
    | { status?: string; GatewayPageURL?: string; sessionkey?: string; failedreason?: string }
    | null;

  if (!res.ok || data?.status !== "SUCCESS" || !data.GatewayPageURL) {
    throw new Error(`SSLCommerz init failed (${res.status}): ${data?.failedreason ?? "no gateway URL"}`);
  }
  return { gatewayUrl: data.GatewayPageURL, sessionKey: data.sessionkey ?? "" };
}

export type ValidationResult = {
  status: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  currency_type?: string;
  currency?: string;
  card_type?: string;
  bank_tran_id?: string;
  risk_level?: string;
};

/** Server-to-server confirmation; the only source of truth for a payment. */
export async function validatePayment(valId: string): Promise<ValidationResult> {
  const { storeId, storePassword, host } = credentials();
  const url = new URL(`${host}/validator/api/validationserverAPI.php`);
  url.search = new URLSearchParams({
    val_id: valId,
    store_id: storeId,
    store_passwd: storePassword,
    format: "json",
    v: "1",
  }).toString();

  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const data = (await res.json().catch(() => null)) as ValidationResult | null;
  if (!res.ok || !data || typeof data.status !== "string") {
    throw new Error(`SSLCommerz validation failed (${res.status})`);
  }
  return data;
}
