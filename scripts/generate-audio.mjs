#!/usr/bin/env node
/**
 * Renders natural-sounding audio with Gemini text-to-speech:
 *   - Listening recordings  → public/listening/<set>.mp3   (multi-speaker dialogue)
 *   - Speaking examiner     → public/speaking/<set>/<question>.mp3 and public/speaking/common/*.mp3
 *
 * Usage (needs GEMINI_API_KEY in .env.local or the environment):
 *   npm run audio:generate                 # everything that is missing
 *   npm run audio:generate -- listening    # only listening   (or: speaking)
 *   npm run audio:generate -- sports-centre skills-and-learning
 *   npm run audio:generate -- --force      # re-render even if the MP3 exists
 *
 * Optional env: GEMINI_TTS_MODEL (default gemini-3.8-flash-tts),
 * EXAMINER_VOICE (default Kore), TTS_REQUEST_GAP_MS (default 1500).
 *
 * Every clip is cached in .cache/tts by its text and voice, so a run that
 * stops halfway (rate limit, network) resumes where it left off.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { assignVoices, chunkDialogue, concatPcm, encodeMp3, silence, toPcm16, trimSilence } from "../src/server/audio/tts-audio.mjs";

class RetryWithFallback extends Error {}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env"));

const MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
const FALLBACK_MODEL = "gemini-2.5-flash-preview-tts";
const EXAMINER_VOICE = process.env.EXAMINER_VOICE || "Kore";
const GAP_MS = Number(process.env.TTS_REQUEST_GAP_MS || 1500);
const NARRATOR_VOICE = process.env.NARRATOR_VOICE || "Iapetus";
const NARRATOR_STYLE = "a neutral, clear exam narrator reading instructions";
const LISTENING_STYLE = "natural, clear and conversational, like a recording in an English listening exam";
const EXAMINER_STYLE = "a calm, friendly and professional speaking examiner; clear, unhurried pace";

const cacheDir = path.join(root, ".cache/tts");
const args = process.argv.slice(2);
const force = args.includes("--force");
const filters = args.filter((arg) => !arg.startsWith("--"));

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing. Add it to .env.local, then run this again.");
  process.exit(1);
}
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  // Tests point this at a local fake server.
  ...(process.env.GEMINI_BASE_URL ? { httpOptions: { baseUrl: process.env.GEMINI_BASE_URL } } : {}),
});
mkdirSync(cacheDir, { recursive: true });

const listeningScripts = readJson("src/server/content/listening-scripts.json");
const speakingSets = readJson("src/content/speaking-sets.json");
const examinerLines = readJson("src/content/examiner-lines.json");

const manifestPath = path.join(root, "src/content/audio-manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { files: {} };

const wantAll = filters.length === 0;
const wants = (group, id) => wantAll || filters.includes(group) || filters.includes(id);

let rendered = 0;
let skipped = 0;
let useFallback = false;

for (const [id, script] of Object.entries(listeningScripts)) {
  if (!wants("listening", id)) continue;
  const out = path.join(root, "public/listening", `${id}.mp3`);
  if (!force && isGenerated(out)) {
    skipped += 1;
    continue;
  }
  const voices = assignVoices(script.voices);
  const parts = [];
  const chunks = chunkDialogue(script.lines);
  for (const [index, chunk] of chunks.entries()) {
    process.stdout.write(`listening/${id}: part ${index + 1}/${chunks.length}\r`);
    parts.push(trimSilence(await synthesize(chunk, voices, LISTENING_STYLE)));
    parts.push(silence(0.6));
  }
  // The narrator's introduction, then reading time, as in the real test.
  const intro = script.intro ? [trimSilence(await synthesize([{ speaker: "N", text: script.intro }], { N: NARRATOR_VOICE }, NARRATOR_STYLE)), silence(8)] : [];
  writeMp3(out, concatPcm([silence(0.8), ...intro, ...parts]));
  console.log(`listening/${id}: done (${chunks.length} request${chunks.length === 1 ? "" : "s"})   `);
}

const examiner = { X: EXAMINER_VOICE };
const speak = (text) => synthesize([{ speaker: "X", text }], examiner, EXAMINER_STYLE);

if (wants("speaking", "common")) {
  for (const [key, text] of Object.entries(examinerLines)) {
    await renderClip(path.join(root, "public/speaking/common", `${key}.mp3`), text, `speaking/common/${key}`);
  }
}
for (const set of speakingSets) {
  if (!wants("speaking", set.id)) continue;
  const dir = path.join(root, "public/speaking", set.id);
  for (const [index, text] of set.part1.entries()) await renderClip(path.join(dir, `p1-${index}.mp3`), text, `speaking/${set.id}/p1-${index}`);
  const cue = `${set.part2.cue} You should say: ${set.part2.bullets.join(", ")}.`;
  await renderClip(path.join(dir, "p2-cue.mp3"), cue, `speaking/${set.id}/p2-cue`);
  for (const [index, text] of set.part3.entries()) await renderClip(path.join(dir, `p3-${index}.mp3`), text, `speaking/${set.id}/p3-${index}`);
}

console.log(`\nFinished: ${rendered} file(s) rendered, ${skipped} already up to date. Model: ${useFallback ? FALLBACK_MODEL : MODEL}.`);

// ---------------------------------------------------------------------------

async function renderClip(out, text, label) {
  if (!force && isGenerated(out)) {
    skipped += 1;
    return;
  }
  writeMp3(out, concatPcm([silence(0.2), trimSilence(await speak(text)), silence(0.3)]));
  console.log(`${label}: done`);
}

/** Listed in src/content/audio-manifest.json (which the app reads) and present on disk. */
function isGenerated(file) {
  return existsSync(file) && Boolean(manifest.files[publicPath(file)]);
}

function publicPath(file) {
  return path.relative(path.join(root, "public"), file).split(path.sep).join("/");
}

function writeMp3(file, samples) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, encodeMp3(samples));
  manifest.files[publicPath(file)] = useFallback ? FALLBACK_MODEL : MODEL;
  writeFileSync(manifestPath, `${JSON.stringify({ files: Object.fromEntries(Object.entries(manifest.files).sort()) }, null, 2)}\n`);
  rendered += 1;
}

async function synthesize(lines, voices, style) {
  const speakers = [...new Set(lines.map((line) => line.speaker))];
  const key = createHash("sha256")
    .update(JSON.stringify({ model: useFallback ? FALLBACK_MODEL : MODEL, style, voices: speakers.map((s) => voices[s]), lines }))
    .digest("hex")
    .slice(0, 32);
  const cached = path.join(cacheDir, `${key}.pcm`);
  if (existsSync(cached)) return toPcm16(readFileSync(cached)).samples;

  let bytes;
  try {
    bytes = await withRetry(() => (useFallback ? requestLegacy(lines, voices, speakers) : requestInteraction(lines, voices, speakers, style)));
  } catch (error) {
    if (!(error instanceof RetryWithFallback)) throw error;
    bytes = await withRetry(() => requestLegacy(lines, voices, speakers));
  }
  const { samples, sampleRate } = toPcm16(bytes);
  if (sampleRate !== 24_000) throw new Error(`Unexpected sample rate ${sampleRate}`);
  writeFileSync(cached, Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength));
  await sleep(GAP_MS);
  return samples;
}

/** Current API: Interactions with speech_metadata annotations. */
async function requestInteraction(lines, voices, speakers, style) {
  const multi = speakers.length > 1;
  const interaction = await ai.interactions.create({
    model: MODEL,
    input: [
      {
        type: "user_input",
        content: lines.map((line) => ({
          type: "text",
          text: line.text,
          annotations: [multi ? { type: "speech_metadata", speaker: line.speaker, style } : { type: "speech_metadata", style }],
        })),
      },
    ],
    response_format: { type: "audio" },
    generation_config: {
      speech_config: multi ? { speakers: speakers.map((speaker) => ({ speaker, voice: voices[speaker] })) } : [{ voice: voices[speakers[0]] }],
    },
  });
  const audio = interaction?.output_audio?.data ?? findAudio(interaction);
  if (!audio) throw new Error("The TTS response contained no audio.");
  return Buffer.from(audio, "base64");
}

function findAudio(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.data === "string" && /audio/.test(String(value.mime_type ?? value.mimeType ?? value.type ?? ""))) return value.data;
  for (const child of Object.values(value)) {
    const found = findAudio(child);
    if (found) return found;
  }
  return null;
}

/** Older API, used automatically if the Interactions call is not available for this key. */
async function requestLegacy(lines, voices, speakers) {
  const multi = speakers.length > 1;
  const text = multi
    ? `Read this conversation naturally, as in an English listening exam:\n${lines.map((l) => `${l.speaker}: ${l.text}`).join("\n")}`
    : `Say clearly and naturally: ${lines.map((l) => l.text).join(" ")}`;
  const response = await ai.models.generateContent({
    model: FALLBACK_MODEL,
    contents: [{ role: "user", parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: multi
        ? {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: speakers.map((speaker) => ({ speaker, voiceConfig: { prebuiltVoiceConfig: { voiceName: voices[speaker] } } })),
            },
          }
        : { voiceConfig: { prebuiltVoiceConfig: { voiceName: voices[speakers[0]] } } },
    },
  });
  const data = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
  if (!data) throw new Error("The TTS response contained no audio.");
  return Buffer.from(data, "base64");
}

async function withRetry(run) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const status = Number(error?.status ?? error?.code ?? error?.statusCode ?? 0);
      const message = String(error?.message ?? error);
      if (!useFallback && (status === 404 || /not (found|supported)|interactions/i.test(message)) && attempt === 1) {
        console.warn(`\n${MODEL} is not available for this key (${message.slice(0, 120)}). Switching to ${FALLBACK_MODEL}.`);
        useFallback = true;
        throw new RetryWithFallback();
      }
      const retryable = status === 429 || status >= 500 || /quota|rate|unavailable|timeout|ECONNRESET|fetch failed/i.test(message);
      if (!retryable || attempt >= 6) {
        if (/quota|429/i.test(message)) {
          console.error("\nGemini's free-tier TTS limit was reached. Run the same command again later: finished clips are kept.");
        }
        throw error;
      }
      const waitMs = Math.min(90_000, 5_000 * 2 ** (attempt - 1));
      console.warn(`\nRequest failed (${status || message.slice(0, 80)}). Retrying in ${Math.round(waitMs / 1000)} s…`);
      await sleep(waitMs);
    }
  }
}

function readJson(relative) {
  return JSON.parse(readFileSync(path.join(root, relative), "utf8"));
}

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
