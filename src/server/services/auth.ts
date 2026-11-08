import { randomBytes } from "node:crypto";
import { connectDb } from "@/server/db";
import { User } from "@/server/models/User";
import { ApiError } from "@/server/http/api";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/server/auth/password";
import { createActionToken, hashActionToken } from "@/server/auth/tokens";
import { sendEmail, type EmailMessage } from "@/server/email/send-email";
import { accountExistsEmail, passwordResetEmail, verificationEmail } from "@/server/email/templates";
import { log } from "@/server/log";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Email failures must never change the response the client sees (that would leak account existence). */
async function deliver(message: EmailMessage, kind: string) {
  try {
    await sendEmail(message);
  } catch (error) {
    log.error("email.delivery_failed", { kind, error });
  }
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}

/**
 * Registration never reveals whether an email is already registered: the
 * response is identical, and the existing owner gets an email instead.
 */
export async function registerAccount(rawEmail: string, password: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  await connectDb();

  const existing = await User.findOne({ email }).select("emailVerified").lean();
  if (existing) {
    await burnPasswordCheck(password);
    if (existing.emailVerified) {
      await deliver(accountExistsEmail(email), "account_exists");
    } else {
      await issueVerification(email);
    }
    return;
  }

  const passwordHash = await hashPassword(password);
  const verify = createActionToken();
  try {
    await User.create({
      email,
      password: passwordHash,
      emailVerificationTokenHash: verify.hash,
      emailVerificationExpires: new Date(Date.now() + VERIFY_TTL_MS),
    });
  } catch (error) {
    if (isDuplicateKey(error)) return; // concurrent registration for the same email
    throw error;
  }
  await deliver(verificationEmail(email, verify.token), "verification");
}

async function issueVerification(email: string) {
  const verify = createActionToken();
  const updated = await User.updateOne(
    { email, emailVerified: false },
    {
      $set: {
        emailVerificationTokenHash: verify.hash,
        emailVerificationExpires: new Date(Date.now() + VERIFY_TTL_MS),
      },
    }
  );
  if (updated.matchedCount > 0) await deliver(verificationEmail(email, verify.token), "verification");
}

export async function resendVerification(rawEmail: string): Promise<void> {
  await connectDb();
  await issueVerification(normalizeEmail(rawEmail));
}

export async function verifyEmailToken(token: string): Promise<void> {
  await connectDb();
  // Atomic match-and-consume: a token can only ever be used once.
  const result = await User.updateOne(
    {
      emailVerificationTokenHash: hashActionToken(token),
      emailVerificationExpires: { $gt: new Date() },
    },
    {
      $set: { emailVerified: true },
      $unset: { emailVerificationTokenHash: 1, emailVerificationExpires: 1 },
    }
  );
  if (result.matchedCount === 0) {
    throw new ApiError(400, "INVALID_TOKEN", "This verification link is invalid or has expired.");
  }
}

export type AuthenticatedAccount = { id: string; tokenVersion: number };

export async function authenticate(rawEmail: string, password: string): Promise<AuthenticatedAccount> {
  const email = normalizeEmail(rawEmail);
  await connectDb();
  const user = await User.findOne({ email }).select("+password emailVerified tokenVersion");

  if (!user) {
    await burnPasswordCheck(password);
    throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");
  }
  if (!(await verifyPassword(password, user.password))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");
  }
  if (!user.emailVerified) {
    throw new ApiError(
      403,
      "EMAIL_NOT_VERIFIED",
      "Please verify your email address first. We can send you a new link."
    );
  }

  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  return { id: String(user._id), tokenVersion: user.tokenVersion ?? 0 };
}

export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  await connectDb();
  const reset = createActionToken();
  const result = await User.updateOne(
    { email },
    {
      $set: {
        passwordResetTokenHash: reset.hash,
        passwordResetExpires: new Date(Date.now() + RESET_TTL_MS),
      },
    }
  );
  if (result.matchedCount > 0) await deliver(passwordResetEmail(email, reset.token), "password_reset");
}

/**
 * Consumes a reset token, sets the new password and revokes every existing
 * session by bumping the token version. Completing a reset also proves inbox
 * ownership, so the email is marked verified.
 */
export async function resetPassword(token: string, password: string): Promise<void> {
  await connectDb();
  const passwordHash = await hashPassword(password);
  const result = await User.updateOne(
    {
      passwordResetTokenHash: hashActionToken(token),
      passwordResetExpires: { $gt: new Date() },
    },
    {
      $set: { password: passwordHash, emailVerified: true },
      $unset: {
        passwordResetTokenHash: 1,
        passwordResetExpires: 1,
        emailVerificationTokenHash: 1,
        emailVerificationExpires: 1,
      },
      $inc: { tokenVersion: 1 },
    }
  );
  if (result.matchedCount === 0) {
    throw new ApiError(400, "INVALID_TOKEN", "This reset link is invalid or has expired.");
  }
}

export async function updateTargetBand(userId: string, targetBand: number): Promise<void> {
  await connectDb();
  await User.updateOne({ _id: userId }, { $set: { targetBand } });
}

/**
 * Signs in (or up) with a Google identity whose email Google has verified.
 *
 * Linking rules:
 * - Already linked (same Google id) → sign in.
 * - Existing *verified* account with that email → link and sign in.
 * - Existing *unverified* account → someone may have pre-registered this
 *   email to hijack it later, so its password is replaced with a random one
 *   and all its sessions are revoked before linking. The real owner can set
 *   a password any time with "Forgot password".
 * - No account → create a verified account with an unusable random password.
 */
export async function signInWithGoogle(identity: { sub: string; email: string }): Promise<AuthenticatedAccount> {
  const email = normalizeEmail(identity.email);
  await connectDb();

  const linked = await User.findOne({ googleId: identity.sub }).select("tokenVersion").lean();
  if (linked) {
    await User.updateOne({ _id: linked._id }, { $set: { lastLoginAt: new Date() } });
    return { id: String(linked._id), tokenVersion: linked.tokenVersion ?? 0 };
  }

  const existing = await User.findOne({ email }).select("emailVerified tokenVersion googleId").lean();
  if (existing) {
    if (existing.googleId && existing.googleId !== identity.sub) {
      throw new ApiError(409, "GOOGLE_ACCOUNT_MISMATCH", "This email is already linked to a different Google account.");
    }
    if (existing.emailVerified) {
      await User.updateOne({ _id: existing._id }, { $set: { googleId: identity.sub, lastLoginAt: new Date() } });
      return { id: String(existing._id), tokenVersion: existing.tokenVersion ?? 0 };
    }
    const nextVersion = (existing.tokenVersion ?? 0) + 1;
    await User.updateOne(
      { _id: existing._id },
      {
        $set: {
          googleId: identity.sub,
          emailVerified: true,
          password: await hashPassword(randomBytes(32).toString("base64url")),
          tokenVersion: nextVersion,
          lastLoginAt: new Date(),
        },
        $unset: { emailVerificationTokenHash: 1, emailVerificationExpires: 1, passwordResetTokenHash: 1, passwordResetExpires: 1 },
      }
    );
    return { id: String(existing._id), tokenVersion: nextVersion };
  }

  try {
    const created = await User.create({
      email,
      password: await hashPassword(randomBytes(32).toString("base64url")),
      emailVerified: true,
      googleId: identity.sub,
      lastLoginAt: new Date(),
    });
    return { id: String(created._id), tokenVersion: 0 };
  } catch (error) {
    if (isDuplicateKey(error)) return signInWithGoogle(identity); // raced with another sign-in
    throw error;
  }
}
