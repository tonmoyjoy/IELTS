import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getEnv } from "@/server/env";
import { ApiError } from "@/server/http/api";

let client: GoogleGenAI | null = null;
let clientKey: string | undefined;

/** Lazily constructed Gemini client. Throws a user-safe 503 when AI is not configured. */
export function getGenAI(): GoogleGenAI {
  const key = getEnv().GEMINI_API_KEY;
  if (!key) {
    throw new ApiError(503, "AI_UNAVAILABLE", "AI scoring is temporarily unavailable. Please try again later.");
  }
  if (!client || clientKey !== key) {
    client = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        timeout: 90_000,
        retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 4, httpStatusCodes: [429, 500, 502, 503, 504] },
      },
    });
    clientKey = key;
  }
  return client;
}

export const AI_PROVIDER = "gemini";
