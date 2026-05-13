import { NextResponse } from "next/server";

function isZodLike(
  e: unknown
): e is { flatten: () => { fieldErrors: Record<string, string[] | undefined> } } {
  return (
    typeof e === "object" &&
    e !== null &&
    "flatten" in e &&
    typeof (e as { flatten: unknown }).flatten === "function"
  );
}

function isDuplicateKeyError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: number }).code === 11_000
  );
}

function isMongoUnreachable(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const name = (e as { name?: string }).name ?? "";
  /** Driver: MongoServerSelectionError; Mongoose wrapper: MongooseServerSelectionError */
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
    msg.includes("IP allowed") ||
    msg.includes("Server selection timed out")
  );
}

export function authErrorResponse(e: unknown, context: "register" | "login"): NextResponse {
  if (isZodLike(e)) {
    const fields = e.flatten().fieldErrors;
    return NextResponse.json(
      { error: "Invalid input", fields },
      { status: 400 }
    );
  }

  if (isDuplicateKeyError(e)) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  if (isMongoUnreachable(e)) {
    return NextResponse.json(
      {
        error:
          "Cannot reach the database. Start MongoDB locally or check MONGODB_URI (e.g. mongodb://127.0.0.1:27017/ielts-examiner).",
      },
      { status: 503 }
    );
  }

  if (e instanceof Error) {
    if (e.message.includes("MONGODB_URI")) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    if (e.message.includes("JWT_SECRET")) {
      return NextResponse.json(
        { error: "Server misconfiguration: JWT_SECRET must be set (min 16 characters)." },
        { status: 500 }
      );
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.error(`[api/auth/${context}]`, e);
  }

  const fallback = context === "login" ? "Login failed" : "Registration failed";
  return NextResponse.json({ error: fallback }, { status: 400 });
}
