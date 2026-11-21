import "server-only";
import { getGenAI } from "@/server/ai/client";
import { getTtsModel } from "@/server/env";
import { connectDb } from "@/server/db";
import { AudioClip } from "@/server/models/AudioClip";
import { cueCardScript } from "@/content/speaking";
import type { SpeakingSet } from "@/content/types";
import type { ListeningScript, ScriptLine } from "@/server/content/listening-scripts";
import { assignVoices, chunkDialogue, concatPcm, encodeMp3, silence, toPcm16, trimSilence } from "@/server/audio/tts-audio.mjs";

/**
 * Server-side Gemini text-to-speech for content published from the admin
 * editor (the CLI `npm run audio:generate` does the same for built-in content).
 */

const FALLBACK_MODEL = "gemini-2.5-flash-preview-tts";
const LISTENING_STYLE = "natural, clear and conversational, like a recording in an English listening exam";
const NARRATOR_STYLE = "a neutral, clear exam narrator reading instructions";
const EXAMINER_STYLE = "a calm, friendly and professional speaking examiner; clear, unhurried pace";

function findAudio(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.data === "string" && /audio/.test(String(record.mime_type ?? record.mimeType ?? record.type ?? ""))) return record.data;
  for (const child of Object.values(record)) {
    const found = findAudio(child);
    if (found) return found;
  }
  return null;
}

async function requestInteraction(lines: ScriptLine[], voices: Record<string, string>, style: string): Promise<Buffer> {
  const speakers = [...new Set(lines.map((line) => line.speaker))];
  const multi = speakers.length > 1;
  const ai = getGenAI();
  const interaction = await ai.interactions.create({
    model: getTtsModel(),
    input: [
      {
        type: "user_input",
        content: lines.map((line) => ({
          type: "text" as const,
          text: line.text,
          annotations: [multi ? { type: "speech_metadata" as const, speaker: line.speaker, style } : { type: "speech_metadata" as const, style }],
        })),
      },
    ],
    response_format: { type: "audio" },
    generation_config: {
      speech_config: multi ? { speakers: speakers.map((speaker) => ({ speaker, voice: voices[speaker] })) } : [{ voice: voices[speakers[0]] }],
    },
  } as never);
  const audio = findAudio(interaction);
  if (!audio) throw new Error("The TTS response contained no audio.");
  return Buffer.from(audio, "base64");
}

async function requestLegacy(lines: ScriptLine[], voices: Record<string, string>): Promise<Buffer> {
  const speakers = [...new Set(lines.map((line) => line.speaker))];
  const multi = speakers.length > 1;
  const text = multi
    ? `Read this conversation naturally, as in an English listening exam:\n${lines.map((l) => `${l.speaker}: ${l.text}`).join("\n")}`
    : `Say clearly and naturally: ${lines.map((l) => l.text).join(" ")}`;
  const response = await getGenAI().models.generateContent({
    model: FALLBACK_MODEL,
    contents: [{ role: "user", parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: multi
        ? { multiSpeakerVoiceConfig: { speakerVoiceConfigs: speakers.map((speaker) => ({ speaker, voiceConfig: { prebuiltVoiceConfig: { voiceName: voices[speaker] } } })) } }
        : { voiceConfig: { prebuiltVoiceConfig: { voiceName: voices[speakers[0]] } } },
    },
  });
  const data = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
  if (!data) throw new Error("The TTS response contained no audio.");
  return Buffer.from(data, "base64");
}

let useFallback = false;

async function synthesize(lines: ScriptLine[], voices: Record<string, string>, style: string): Promise<Int16Array> {
  let bytes: Buffer;
  if (useFallback) bytes = await requestLegacy(lines, voices);
  else {
    try {
      bytes = await requestInteraction(lines, voices, style);
    } catch (error) {
      const status = Number((error as { status?: number }).status ?? 0);
      if (status !== 404 && !/not (found|supported)/i.test(String((error as Error).message))) throw error;
      useFallback = true;
      bytes = await requestLegacy(lines, voices);
    }
  }
  return trimSilence(toPcm16(bytes).samples);
}

async function store(samples: Int16Array, label: string): Promise<string> {
  const data = encodeMp3(samples);
  await connectDb();
  const clip = await AudioClip.create({ data, bytes: data.length, label });
  return String(clip._id);
}

/** Renders a listening script (narrator intro, then the dialogue) and stores it. Returns the clip id. */
export async function renderListening(slug: string, script: ListeningScript): Promise<string> {
  const voices = assignVoices(script.voices) as Record<string, string>;
  const parts: Int16Array[] = [silence(0.8)];
  if (script.intro) parts.push(await synthesize([{ speaker: "N", text: script.intro }], { N: "Iapetus" }, NARRATOR_STYLE), silence(8));
  for (const chunk of chunkDialogue(script.lines)) {
    parts.push(await synthesize(chunk, voices, LISTENING_STYLE), silence(0.6));
  }
  return store(concatPcm(parts), `listening/${slug}`);
}

/** Renders every examiner question for a speaking set. Returns clip ids keyed "p1-0", "p2-cue", "p3-0"… */
export async function renderSpeaking(set: SpeakingSet): Promise<Record<string, string>> {
  const voice = { X: "Kore" };
  const jobs: Array<[string, string]> = [
    ...set.part1.map((text, i): [string, string] => [`p1-${i}`, text]),
    ["p2-cue", cueCardScript(set)],
    ...set.part3.map((text, i): [string, string] => [`p3-${i}`, text]),
  ];
  const clips: Record<string, string> = {};
  for (const [key, text] of jobs) {
    const samples = await synthesize([{ speaker: "X", text }], voice, EXAMINER_STYLE);
    clips[key] = await store(concatPcm([silence(0.2), samples, silence(0.3)]), `speaking/${set.id}/${key}`);
  }
  return clips;
}

