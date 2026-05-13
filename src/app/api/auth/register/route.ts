import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { signAuthToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE } from "@/lib/auth/constants";
import { authErrorResponse } from "@/lib/api/auth-errors";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { requireSameOrigin } from "@/lib/security/request-guards";
import { createActionToken, getAppUrl } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/send-email";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    const limited = await rateLimit(`register:${getClientIp(req)}`, {
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Expected a JSON body with email and password" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return authErrorResponse(parsed.error, "register");
    }

    const email = parsed.data.email.toLowerCase().trim();
    const { password } = parsed.data;
    await connectDb();

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyToken = createActionToken();
    const verificationUrl = `${getAppUrl()}/verify-email?token=${verifyToken.token}`;
    const user = await User.create({
      email,
      password: passwordHash,
      emailVerificationTokenHash: verifyToken.hash,
      emailVerificationExpires: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });

    const emailResult = await sendEmail({
      to: email,
      subject: "Verify your IELTS Practice Studio account",
      html: `<p>Welcome to IELTS Practice Studio.</p><p>Verify your email here: <a href="${verificationUrl}">${verificationUrl}</a></p><p>This link expires in 24 hours.</p>`,
    });

    const token = await signAuthToken(String(user._id), user.email);
    const res = NextResponse.json({
      ok: true,
      message: emailResult.sent
        ? "Registration successful. Check your email to verify your account."
        : "Registration successful. Email service is not configured, so use the verification link below.",
      verificationUrl: emailResult.sent ? undefined : verificationUrl,
      user: { id: String(user._id), email: user.email, emailVerified: user.emailVerified },
    });
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e: unknown) {
    return authErrorResponse(e, "register");
  }
}
