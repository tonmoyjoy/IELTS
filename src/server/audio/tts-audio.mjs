/**
 * Pure helpers for Gemini TTS (scripts/generate-audio.mjs and server/audio/tts.ts) (unit-tested in
 * tests/unit/tts-audio.test.ts). No network, no file system.
 */
import { Mp3Encoder } from "@breezystack/lamejs";

export const SAMPLE_RATE = 24_000;

/**
 * Gemini TTS returns either a WAV file (RIFF header) or headerless 16-bit
 * little-endian PCM. Returns the PCM samples in both cases.
 */
export function toPcm16(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WAVE") {
    let offset = 12;
    let sampleRate = SAMPLE_RATE;
    while (offset + 8 <= buf.length) {
      const id = buf.toString("ascii", offset, offset + 4);
      const size = buf.readUInt32LE(offset + 4);
      const body = offset + 8;
      if (id === "fmt ") {
        const bits = buf.readUInt16LE(body + 14);
        const channels = buf.readUInt16LE(body + 2);
        sampleRate = buf.readUInt32LE(body + 4);
        if (bits !== 16 || channels !== 1) throw new Error(`Unsupported WAV: ${channels} channel(s), ${bits}-bit`);
      } else if (id === "data") {
        // Some encoders write 0 or 0xFFFFFFFF for streamed data: take the rest.
        const end = size === 0 || size === 0xffffffff ? buf.length : Math.min(buf.length, body + size);
        return { samples: int16View(buf.subarray(body, end)), sampleRate };
      }
      offset = body + size + (size % 2);
    }
    throw new Error("WAV file has no data chunk");
  }
  return { samples: int16View(buf), sampleRate: SAMPLE_RATE };
}

function int16View(buf) {
  const even = buf.length - (buf.length % 2);
  const copy = new Int16Array(even / 2);
  for (let i = 0; i < copy.length; i += 1) copy[i] = buf.readInt16LE(i * 2);
  return copy;
}

export function silence(seconds, sampleRate = SAMPLE_RATE) {
  return new Int16Array(Math.round(seconds * sampleRate));
}

export function concatPcm(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Int16Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Trims leading/trailing near-silence so joins between clips sound natural. */
export function trimSilence(samples, threshold = 300, padSamples = 2400) {
  let start = 0;
  let end = samples.length;
  while (start < end && Math.abs(samples[start]) < threshold) start += 1;
  while (end > start && Math.abs(samples[end - 1]) < threshold) end -= 1;
  return samples.subarray(Math.max(0, start - padSamples), Math.min(samples.length, end + padSamples));
}

export function encodeMp3(samples, sampleRate = SAMPLE_RATE, kbps = 64) {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const chunks = [];
  const block = 1152 * 16;
  for (let i = 0; i < samples.length; i += block) {
    const out = encoder.encodeBuffer(samples.subarray(i, i + block));
    if (out.length) chunks.push(Buffer.from(out.buffer, out.byteOffset, out.length));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(Buffer.from(tail.buffer, tail.byteOffset, tail.length));
  return Buffer.concat(chunks);
}

/**
 * Groups consecutive dialogue lines into requests of at most two speakers
 * (the multi-speaker limit) and roughly `maxChars` characters, keeping order.
 */
export function chunkDialogue(lines, maxChars = 1400) {
  const chunks = [];
  let current = [];
  let speakers = new Set();
  let chars = 0;
  for (const line of lines) {
    const nextSpeakers = new Set(speakers).add(line.speaker);
    if (current.length > 0 && (nextSpeakers.size > 2 || chars + line.text.length > maxChars)) {
      chunks.push(current);
      current = [];
      speakers = new Set();
      chars = 0;
    }
    current.push(line);
    speakers.add(line.speaker);
    chars += line.text.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

const FEMALE = ["Kore", "Aoede", "Leda", "Despina"];
const MALE = ["Charon", "Orus", "Puck", "Iapetus"];

/** Gives every speaker in a script a distinct prebuilt voice matching the requested gender. */
export function assignVoices(voices, overrides = {}) {
  const used = { female: 0, male: 0 };
  const result = {};
  for (const [speaker, gender] of Object.entries(voices)) {
    if (overrides[speaker]) {
      result[speaker] = overrides[speaker];
      continue;
    }
    const pool = gender === "female" ? FEMALE : MALE;
    const key = gender === "female" ? "female" : "male";
    result[speaker] = pool[used[key] % pool.length];
    used[key] += 1;
  }
  return result;
}

