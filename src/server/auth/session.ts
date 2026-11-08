import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { connectDb } from "@/server/db";
import { User } from "@/server/models/User";
import { verifySessionToken } from "@/server/auth/jwt";
import { sessionCookieName } from "@/server/auth/cookie";
import { ApiError } from "@/server/http/api";
import { effectivePlan, type PlanId } from "@/lib/plans";

export type SessionUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  plan: PlanId;
  /** ISO date the paid plan ends, if any. */
  planExpiresAt: string | null;
  targetBand: number;
};

/**
 * Resolves the signed-in user. Verifies the JWT signature, then confirms the
 * account still exists and the token version has not been revoked.
 * Cached per request so layouts and pages share one lookup.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  await connectDb();
  const user = await User.findById(new Types.ObjectId(claims.sub))
    .select("email emailVerified plan planExpiresAt targetBand tokenVersion")
    .lean();
  if (!user || (user.tokenVersion ?? 0) !== claims.tv) return null;

  return {
    id: String(user._id),
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    plan: effectivePlan(user.plan, user.planExpiresAt),
    planExpiresAt: user.planExpiresAt && effectivePlan(user.plan, user.planExpiresAt) === "pro" ? user.planExpiresAt.toISOString() : null,
    targetBand: user.targetBand ?? 7,
  };
});

/** Route handlers: 401 unless signed in with a verified email. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  if (!user.emailVerified) {
    throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Please verify your email address to continue.");
  }
  return user;
}

/** Server components: redirect to sign-in unless signed in. */
export async function requirePageUser(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?from=${encodeURIComponent(returnTo)}`);
  return user;
}
