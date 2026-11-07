import { isIP } from "node:net";
import { getEnv } from "@/server/env";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return isIP(trimmed) ? trimmed : null;
}

/**
 * Resolves the client IP from proxy headers without trusting anything the
 * client could forge.
 *
 * - If CLIENT_IP_HEADER is configured (e.g. `cf-connecting-ip`), only that
 *   header is used.
 * - Otherwise X-Forwarded-For is read from the right: each trusted proxy
 *   appends the address it saw, so the entry TRUST_PROXY_HOPS from the end is
 *   the last hop no client can spoof. A client-supplied leftmost value is
 *   ignored.
 */
export function getClientIp(headers: Headers): string {
  const env = getEnv();

  if (env.CLIENT_IP_HEADER) {
    return clean(headers.get(env.CLIENT_IP_HEADER)) ?? "unknown";
  }

  const hops = env.TRUST_PROXY_HOPS;
  if (hops === 0) return "unknown";

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    const index = chain.length - hops;
    // Fewer entries than trusted hops means the chain is not the one our
    // proxies built; never fall back to a client-controlled entry.
    const ip = index >= 0 ? clean(chain[index]) : null;
    if (ip) return ip;
  }

  return clean(headers.get("x-real-ip")) ?? "unknown";
}
