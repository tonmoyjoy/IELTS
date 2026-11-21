import { describe, expect, it } from "vitest";
import { assignVoices, chunkDialogue, concatPcm, encodeMp3, silence, toPcm16, trimSilence } from "@/server/audio/tts-audio.mjs";

function wav(samples: number[], rate = 24000) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

describe("TTS audio helpers", () => {
  it("reads PCM from a WAV file and from headerless PCM", () => {
    const fromWav = toPcm16(wav([1, -2, 3]));
    expect(Array.from(fromWav.samples)).toEqual([1, -2, 3]);
    expect(fromWav.sampleRate).toBe(24000);
    const raw = Buffer.alloc(4); raw.writeInt16LE(5, 0); raw.writeInt16LE(-6, 2);
    expect(Array.from(toPcm16(raw).samples)).toEqual([5, -6]);
  });

  it("rejects stereo WAV files", () => {
    const stereo = wav([1, 2]); stereo.writeUInt16LE(2, 22);
    expect(() => toPcm16(stereo)).toThrow(/Unsupported WAV/);
  });

  it("keeps dialogue order and never puts more than two speakers in one request", () => {
    const lines = [
      { speaker: "A", text: "one" }, { speaker: "B", text: "two" }, { speaker: "C", text: "three" }, { speaker: "A", text: "four" },
    ];
    const chunks = chunkDialogue(lines);
    for (const chunk of chunks) expect(new Set(chunk.map((l: { speaker: string }) => l.speaker)).size).toBeLessThanOrEqual(2);
    expect(chunks.flat()).toEqual(lines);
  });

  it("splits long dialogue by length", () => {
    const lines = Array.from({ length: 6 }, (_, i) => ({ speaker: i % 2 ? "A" : "B", text: "x".repeat(500) }));
    expect(chunkDialogue(lines, 1400).length).toBe(3);
  });

  it("assigns distinct voices by gender", () => {
    expect(assignVoices({ R: "female", C: "male", D: "male" })).toEqual({ R: "Kore", C: "Charon", D: "Orus" });
    expect(assignVoices({ R: "female" }, { R: "Leda" })).toEqual({ R: "Leda" });
  });

  it("trims silence and joins clips", () => {
    const clip = concatPcm([silence(1), Int16Array.from([5000, -5000]), silence(1)]);
    const trimmed = trimSilence(clip, 300, 0);
    expect(Array.from(trimmed)).toEqual([5000, -5000]);
  });

  it("encodes a valid MP3", () => {
    const tone = Int16Array.from({ length: 24000 }, (_, i) => Math.round(8000 * Math.sin(i / 10)));
    const mp3 = encodeMp3(tone) as Buffer;
    expect(mp3.length).toBeGreaterThan(1000);
    expect(mp3[0]).toBe(0xff);
  });
});
