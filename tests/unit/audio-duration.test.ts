import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAudioDurationSeconds, scanWebmDurationSeconds } from "@/server/audio/duration";

const fixture = (name: string) => readFileSync(path.join(process.cwd(), "tests/fixtures/audio", name));

describe("audio duration", () => {
  it("reads WebM recorded live by Chromium's MediaRecorder (no Duration element)", async () => {
    const seconds = await getAudioDurationSeconds(fixture("mediarecorder-4s.webm"), "audio/webm");
    expect(seconds).not.toBeNull();
    expect(seconds!).toBeGreaterThan(3.5);
    expect(seconds!).toBeLessThan(4.8);
  });

  it("scans streamed WebM clusters directly", () => {
    expect(scanWebmDurationSeconds(fixture("streamed-35s.webm"))).toBeCloseTo(35, 0);
    expect(scanWebmDurationSeconds(fixture("streamed-3s.webm"))).toBeCloseTo(3, 0);
  });

  it("reads MP3 and Ogg via metadata", async () => {
    expect(await getAudioDurationSeconds(fixture("short-3s.mp3"), "audio/mpeg")).toBeCloseTo(3, 0);
    expect(await getAudioDurationSeconds(fixture("short-3s.ogg"), "audio/ogg")).toBeCloseTo(3, 0);
  });

  it("returns null for data that is not audio", async () => {
    expect(await getAudioDurationSeconds(fixture("garbage.bin"), "audio/webm")).toBeNull();
    expect(await getAudioDurationSeconds(Buffer.alloc(0), "audio/mpeg")).toBeNull();
  });

  it("survives truncated WebM without throwing", () => {
    const full = fixture("mediarecorder-4s.webm");
    const partial = scanWebmDurationSeconds(full.subarray(0, Math.floor(full.length / 2)));
    expect(partial).not.toBeNull();
    expect(partial!).toBeLessThan(4.8);
  });
});
