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

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    const limited = await rateLimit(`login:${getClientIp(req)}`, {
      limit: 10,
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
      return authErrorResponse(parsed.error, "login");
    }

    const email = parsed.data.email.toLowerCase().trim();
    const { password } = parsed.data;
    await connectDb();

    const user = await User.findOne({ email }).select("+password").exec();
    if (!user?.password) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await signAuthToken(String(user._id), user.email);
    const res = NextResponse.json({
      ok: true,
      user: { id: String(user._id), email: user.email, emailVerified: user.emailVerified },
      warning: user.emailVerified ? undefined : "Please verify your email to secure your account.",
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
    return authErrorResponse(e, "login");
  }
}
