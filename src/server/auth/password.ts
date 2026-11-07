import bcrypt from "bcryptjs";
import { z } from "zod";

const BCRYPT_COST = 12;

/** bcrypt only uses the first 72 bytes, so longer passwords are rejected instead of silently truncated. */
export const MAX_PASSWORD_BYTES = 72;

export const newPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .refine((value) => Buffer.byteLength(value, "utf8") <= MAX_PASSWORD_BYTES, {
    message: "Password must be at most 72 bytes.",
  })
  .refine((value) => value.trim().length > 0, { message: "Password cannot be blank." });

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// A real hash used to burn equivalent time when the account does not exist,
// so response timing does not reveal which emails are registered.
let dummyHashPromise: Promise<string> | null = null;

export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHashPromise ??= bcrypt.hash("timing-equaliser-not-a-real-password", BCRYPT_COST);
  await bcrypt.compare(password, await dummyHashPromise);
}
