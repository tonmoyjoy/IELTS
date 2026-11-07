import { NextResponse } from "next/server";
import { handler } from "@/server/http/api";
import { assertSameOrigin } from "@/server/http/guards";
import { clearSessionCookie } from "@/server/auth/cookie";

export const POST = handler("auth.logout", async (req) => {
  assertSameOrigin(req);
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  clearSessionCookie(res);
  return res;
});
