import { User } from "@/server/models/User";
import { hashPassword } from "@/server/auth/password";
import { signSessionToken } from "@/server/auth/jwt";
import { sessionCookieName } from "@/server/auth/cookie";
import { cookieJar } from "./state";
import type { PlanId } from "@/lib/plans";

/** Creates a verified user and signs them in by setting the session cookie. */
export async function signInAs(email: string, options: { plan?: PlanId } = {}) {
  const user = await User.create({
    email,
    password: await hashPassword("password for tests"),
    emailVerified: true,
    plan: options.plan ?? "free",
  });
  cookieJar.set(sessionCookieName(), await signSessionToken(String(user._id), 0));
  return String(user._id);
}
