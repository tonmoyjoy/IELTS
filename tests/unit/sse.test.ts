import { describe, expect, it } from "vitest";
import { parseSseBlock, readSse, type SseEvent } from "@/lib/sse";

describe("parseSseBlock", () => {
  it("parses event and data fields", () => {
    expect(parseSseBlock('event: result\ndata: {"a":1}')).toEqual({ event: "result", data: { a: 1 } });
  });

  it("ignores comments and blocks without data", () => {
    expect(parseSseBlock(": keep-alive")).toBeNull();
    expect(parseSseBlock("event: progress")).toBeNull();
  });
});

describe("readSse", () => {
  it("reassembles events split across chunks", async () => {
    const encoder = new TextEncoder();
    const chunks = ['event: progress\ndata: {"stage":"scor', 'ing"}\n\nevent: result\n', 'data: {"ok":true}\n\n'];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    const events: SseEvent[] = [];
    await readSse(new Response(body), (event) => events.push(event));
    expect(events).toEqual([
      { event: "progress", data: { stage: "scoring" } },
      { event: "result", data: { ok: true } },
    ]);
  });
});
