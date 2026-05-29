import { SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "test-jwt-secret-1234567890");

export async function createTestAuthToken(email: string, userId = "test-user-id") {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}
