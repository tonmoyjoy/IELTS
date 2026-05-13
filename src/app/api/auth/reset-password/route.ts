import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { hashActionToken } from "@/lib/auth/tokens";
import { requireSameOrigin } from "@/lib/security/request-guards";

const bodySchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid reset request" }, { status: 400 });

  await connectDb();
  const user = await User.findOne({
    passwordResetTokenHash: hashActionToken(parsed.data.token),
    passwordResetExpires: { $gt: new Date() },
  }).select("+password +passwordResetTokenHash");

  if (!user) return NextResponse.json({ error: "Reset link is invalid or expired" }, { status: 400 });

  user.password = await bcrypt.hash(parsed.data.password, 12);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  return NextResponse.json({ ok: true, message: "Password reset successful. You can now sign in." });
}
