import mongoose from "mongoose";

const CONNECT_OPTS = {
  bufferCommands: false,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
} as const;

function isDev() {
  return process.env.NODE_ENV !== "production";
}

function isUnreachable(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const name = (e as { name?: string }).name ?? "";
  if (
    name === "MongoServerSelectionError" ||
    name === "MongooseServerSelectionError" ||
    name === "MongoNetworkError" ||
    name === "MongoTimeoutError"
  ) {
    return true;
  }
  const msg = e instanceof Error ? e.message : "";
  return (
    msg.includes("ECONNREFUSED") ||
    msg.includes("getaddrinfo") ||
    msg.includes("Server selection timed out")
  );
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
  var mongoMemoryUri: string | undefined;
  var mongoMemoryServer: import("mongodb-memory-server").MongoMemoryServer | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

function isConnected() {
  return mongoose.connection.readyState === 1;
}

async function tryConnect(uri: string): Promise<void> {
  try {
    await mongoose.connect(uri, CONNECT_OPTS);
  } catch (e) {
    await mongoose.disconnect().catch(() => {});
    throw e;
  }
}

/** In-memory Mongo for local dev when no server is running (data is lost on restart). */
async function getDevMemoryUri(): Promise<string> {
  if (global.mongoMemoryUri) {
    return global.mongoMemoryUri;
  }
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const server = await MongoMemoryServer.create();
  global.mongoMemoryServer = server;
  global.mongoMemoryUri = server.getUri();
  console.warn("[db] Using in-memory MongoDB for development:", global.mongoMemoryUri);
  return global.mongoMemoryUri;
}

/**
 * Connects once and reuses the socket. Clears the cached promise on failure so the next call can retry.
 *
 * Development: if `MONGODB_URI` is unset, uses in-memory MongoDB. If it is set but unreachable
 * (e.g. local mongod not running), automatically falls back to in-memory MongoDB.
 *
 * Production: `MONGODB_URI` must be set and reachable — no fallback.
 */
export async function connectDb(): Promise<typeof mongoose> {
  if (isConnected()) {
    cached.conn = mongoose;
    return mongoose;
  }

  if (!cached.promise) {
    cached.promise = (async () => {
      const configured = process.env.MONGODB_URI?.trim();

      if (!configured) {
        if (!isDev()) {
          throw new Error("Please define MONGODB_URI in production");
        }
        const uri = await getDevMemoryUri();
        await tryConnect(uri);
        return mongoose;
      }

      if (!isDev()) {
        await tryConnect(configured);
        return mongoose;
      }

      try {
        await tryConnect(configured);
        return mongoose;
      } catch (err) {
        if (!isUnreachable(err)) {
          throw err;
        }
        console.warn(
          "[db] Could not reach MONGODB_URI; falling back to in-memory MongoDB (dev only)."
        );
        const uri = await getDevMemoryUri();
        await tryConnect(uri);
        return mongoose;
      }
    })();
  }

  try {
    await cached.promise;
    cached.conn = mongoose;
    return mongoose;
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    throw err;
  }
}
