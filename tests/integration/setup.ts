/**
 * Integration tests run real route handlers against a real MongoDB-compatible
 * database. Set TEST_MONGODB_URI to use an existing server (CI uses a mongo
 * service container); otherwise an in-memory MongoDB is started.
 *
 * Only two things are faked: the Next.js request cookie store (route handlers
 * are invoked directly, outside the Next server) and outbound email.
 */
import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { cookieJar, outbox } from "./state";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
  }),
  headers: async () => new Headers(),
}));

vi.mock("@/server/email/send-email", () => ({
  EmailDeliveryError: class extends Error {},
  sendEmail: async (message: { to: string; subject: string; text: string; html: string }) => {
    outbox.push(message);
  },
}));

let memoryServer: { stop: () => Promise<unknown> } | null = null;

beforeAll(async () => {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const server = await MongoMemoryServer.create();
    memoryServer = server;
    uri = server.getUri();
  }
  const dbName = `ielts_test_${process.pid}_${Date.now()}`;
  const url = new URL(uri);
  url.pathname = `/${dbName}`;
  process.env.MONGODB_URI = url.toString();

  const { resetEnvCache } = await import("@/server/env");
  resetEnvCache();
  const { connectDb } = await import("@/server/db");
  await connectDb();
  const { User } = await import("@/server/models/User");
  const { PracticeAttempt } = await import("@/server/models/PracticeAttempt");
  const { Usage } = await import("@/server/models/Usage");
  await Promise.all([User.init(), PracticeAttempt.init(), Usage.init()]);
});

beforeEach(async () => {
  cookieJar.clear();
  outbox.length = 0;
  const { resetMemoryRateLimits } = await import("@/server/security/rate-limit");
  resetMemoryRateLimits();
  const db = mongoose.connection.db;
  if (db) {
    for (const name of ["users", "practiceattempts", "usages", "payments", "adminauditlogs"]) {
      await db.collection(name).deleteMany({});
    }
  }
});

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase().catch(() => {});
  const { disconnectDb } = await import("@/server/db");
  await disconnectDb();
  await memoryServer?.stop();
});
