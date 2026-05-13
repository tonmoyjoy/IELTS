import { SignJWT, jwtVerify, type JWTPayload } from "jose";

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("JWT_SECRET must be set (min 16 characters)");
  }
  return new TextEncoder().encode(s);
}

export type AuthTokenPayload = JWTPayload & {
  sub: string;
  email: string;
};

export async function signAuthToken(userId: string, email: string, expiresIn = "7d") {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ["HS256"],
  });
  if (!payload.sub || typeof payload.email !== "string") {
    throw new Error("Invalid token payload");
  }
  return payload as AuthTokenPayload;
}
