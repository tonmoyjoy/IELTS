import mongoose from "mongoose";
import { getEnv } from "@/server/env";
import { log } from "@/server/log";

const CONNECT_OPTIONS = {
  bufferCommands: false,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  maxPoolSize: 10,
} as const;

type Cache = { promise: Promise<typeof mongoose> | null };

declare global {
  var __mongooseCache: Cache | undefined;
  var __mongoMemoryUri: string | undefined;
}

const cache: Cache = (globalThis.__mongooseCache ??= { promise: null });

/**
 * Development convenience only: when MONGODB_URI is not set, start a
 * throwaway in-memory MongoDB. Never used in production or tests.
 */
async function getDevMemoryUri(): Promise<string> {
  if (globalThis.__mongoMemoryUri) return globalThis.__mongoMemoryUri;
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const server = await MongoMemoryServer.create();
  globalThis.__mongoMemoryUri = server.getUri();
  log.warn("db.using_in_memory", { note: "Data is lost when the dev server restarts" });
  return globalThis.__mongoMemoryUri;
}

async function resolveUri(): Promise<string> {
  const env = getEnv();
  if (env.MONGODB_URI) return env.MONGODB_URI;
  if (env.NODE_ENV === "development") return getDevMemoryUri();
  throw new Error("MONGODB_URI is not configured");
}

/** Connects once per process and reuses the pool. Retries on the next call after a failure. */
export async function connectDb(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;

  if (!cache.promise) {
    cache.promise = (async () => {
      const uri = await resolveUri();
      await mongoose.connect(uri, CONNECT_OPTIONS);
      return mongoose;
    })();
  }

  try {
    return await cache.promise;
  } catch (error) {
    cache.promise = null;
    await mongoose.disconnect().catch(() => {});
    throw error;
  }
}

export async function pingDb(): Promise<boolean> {
  try {
    const conn = await connectDb();
    const db = conn.connection.db;
    if (!db) return false;
    await db.admin().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

/** Used by integration tests to tear down cleanly. */
export async function disconnectDb() {
  cache.promise = null;
  await mongoose.disconnect();
}
