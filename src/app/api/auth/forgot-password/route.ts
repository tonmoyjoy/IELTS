import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { createActionToken, getAppUrl } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/send-email";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { requireSameOrigin } from "@/lib/security/request-guards";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const limited = await rateLimit(`forgot:${getClientIp(req)}`, { limit: 5, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });

  await connectDb();
  const user = await User.findOne({ email: parsed.data.email.toLowerCase().trim() });
  let resetUrl: string | undefined;

  if (user) {
    const resetToken = createActionToken();
    resetUrl = `${getAppUrl()}/reset-password?token=${resetToken.token}`;
    user.passwordResetTokenHash = resetToken.hash;
    user.passwordResetExpires = new Date(Date.now() + 1000 * 60 * 30);
    await user.save();
    const emailResult = await sendEmail({
      to: user.email,
      subject: "Reset your IELTS Practice Studio password",
      html: `<p>Reset your password here: <a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 30 minutes.</p>`,
    });
    if (emailResult.sent) resetUrl = undefined;
  }

  return NextResponse.json({
    ok: true,
    message: "If that email exists, a reset link has been sent.",
    resetUrl,
  });
}
