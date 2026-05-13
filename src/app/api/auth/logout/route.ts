import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth/constants";
import { requireSameOrigin } from "@/lib/security/request-guards";

export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
