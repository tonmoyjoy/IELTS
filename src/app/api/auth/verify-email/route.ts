import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { User } from "@/lib/models/User";
import { hashActionToken } from "@/lib/auth/tokens";
import { requireSameOrigin } from "@/lib/security/request-guards";

const bodySchema = z.object({ token: z.string().min(20) });

export async function POST(req: Request) {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid verification token" }, { status: 400 });

  await connectDb();
  const user = await User.findOne({
    emailVerificationTokenHash: hashActionToken(parsed.data.token),
    emailVerificationExpires: { $gt: new Date() },
  }).select("+emailVerificationTokenHash");

  if (!user) return NextResponse.json({ error: "Verification link is invalid or expired" }, { status: 400 });

  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return NextResponse.json({ ok: true, message: "Email verified successfully" });
}
