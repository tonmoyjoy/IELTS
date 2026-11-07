import { pingDb } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Readiness probe for load balancers, Docker and uptime monitors.
 * Deliberately reveals nothing about configuration.
 */
export async function GET() {
  const database = await pingDb();
  return Response.json(
    { status: database ? "ok" : "degraded", checks: { database: database ? "up" : "down" }, time: new Date().toISOString() },
    { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
