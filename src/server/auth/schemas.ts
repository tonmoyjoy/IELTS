import { z } from "zod";
import { newPasswordSchema } from "@/server/auth/password";
import { ACTION_TOKEN_PATTERN } from "@/server/auth/tokens";

export const emailSchema = z
  .string()
  .trim()
  .max(254, "Email is too long.")
  .pipe(z.email("Enter a valid email address."));

const tokenSchema = z.string().regex(ACTION_TOKEN_PATTERN, "Invalid or malformed link.");

export const registerSchema = z.object({ email: emailSchema, password: newPasswordSchema });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(1024),
});

export const emailOnlySchema = z.object({ email: emailSchema });

export const tokenOnlySchema = z.object({ token: tokenSchema });

export const resetPasswordSchema = z.object({ token: tokenSchema, password: newPasswordSchema });
