import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError, handler, readJson } from "@/server/http/api";

const schema = z.object({ name: z.string().min(2) });
const post = (body: string, headers: Record<string, string> = { "content-type": "application/json" }) =>
  new Request("http://x/api", { method: "POST", body, headers });

describe("readJson", () => {
  it("parses a valid body", async () => {
    await expect(readJson(post(JSON.stringify({ name: "Ann" })), schema)).resolves.toEqual({ name: "Ann" });
  });

  it("rejects non-JSON content types (blocks form-post CSRF)", async () => {
    await expect(readJson(post("name=Ann", { "content-type": "application/x-www-form-urlencoded" }), schema)).rejects.toMatchObject({ status: 415 });
  });

  it("rejects oversized bodies", async () => {
    await expect(readJson(post(JSON.stringify({ name: "x".repeat(100) })), schema, { maxBytes: 50 })).rejects.toMatchObject({ status: 413 });
  });

  it("rejects malformed JSON", async () => {
    await expect(readJson(post("{nope"), schema)).rejects.toMatchObject({ status: 400, code: "INVALID_JSON" });
  });

  it("reports field-level validation errors", async () => {
    const error = await readJson(post(JSON.stringify({ name: "A" })), schema).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.extra.fields.name[0]).toBeTruthy();
  });
});

describe("handler", () => {
  it("turns ApiError into a JSON response with headers", async () => {
    const route = handler("t", async () => {
      throw new ApiError(429, "RATE_LIMITED", "slow down", { headers: { "Retry-After": "5" } });
    });
    const res = await route(new Request("http://x"), {});
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("5");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "slow down", code: "RATE_LIMITED" });
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const route = handler("t", async () => {
      throw new Error("secret database password in message");
    });
    const res = await route(new Request("http://x"), {});
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(spy).toHaveBeenCalled();
  });
});
