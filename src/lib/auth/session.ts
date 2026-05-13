import { cookies } from "next/headers";
import { AUTH_COOKIE } from "./constants";
import { verifyAuthToken } from "./jwt";

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = await verifyAuthToken(token);
    return payload.sub;
  } catch {
    return null;
  }
}
