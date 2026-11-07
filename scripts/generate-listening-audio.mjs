#!/usr/bin/env node
/**
 * Renders the listening scripts in src/server/content/listening-scripts.json
 * to MP3 files in public/listening/ using offline text-to-speech.
 *
 * Requirements (Debian/Ubuntu):
 *   sudo apt-get install espeak-ng mbrola mbrola-en1 mbrola-us1 ffmpeg
 *
 * Usage:
 *   npm run audio:generate            # all sets
 *   npm run audio:generate -- sports-centre
 *
 * The output is clear but synthetic. For production quality, replace the
 * MP3s with studio or neural-TTS recordings of the same scripts — the
 * questions and answer keys only depend on the script text.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = JSON.parse(readFileSync(path.join(root, "src/server/content/listening-scripts.json"), "utf8"));
const outDir = path.join(root, "public/listening");

const VOICES = {
  male: { voice: "mb-en1", speed: "140", pitch: "45" },
  female: { voice: "mb-us1", speed: "145", pitch: "55" },
};
const PAUSE_BETWEEN_LINES = 0.7;
const SAMPLE_RATE = 22050;

function requireTool(command, args) {
  try {
    execFileSync(command, args, { stdio: "ignore" });
  } catch {
    console.error(`Missing dependency: ${command}. See the header of this script for install instructions.`);
    process.exit(1);
  }
}

requireTool("espeak-ng", ["--version"]);
requireTool("ffmpeg", ["-version"]);

const only = process.argv.slice(2);
const ids = Object.keys(scripts).filter((id) => only.length === 0 || only.includes(id));
if (ids.length === 0) {
  console.error(`No matching sets. Available: ${Object.keys(scripts).join(", ")}`);
  process.exit(1);
}
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

for (const id of ids) {
  const { voices, lines } = scripts[id];
  const work = mkdtempSync(path.join(tmpdir(), `listening-${id}-`));
  try {
    const parts = [];
    lines.forEach((line, index) => {
      const gender = voices[line.speaker] ?? "male";
      const { voice, speed, pitch } = VOICES[gender];
      const raw = path.join(work, `raw-${index}.wav`);
      const norm = path.join(work, `line-${index}.wav`);
      execFileSync("espeak-ng", ["-v", voice, "-s", speed, "-p", pitch, "-g", "4", "-w", raw, line.text]);
      // Resample every clip to the same format so they can be concatenated losslessly.
      execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", raw, "-ar", String(SAMPLE_RATE), "-ac", "1", "-c:a", "pcm_s16le", norm]);
      parts.push(norm);
    });

    const silence = path.join(work, "silence.wav");
    execFileSync("ffmpeg", [
      "-loglevel", "error", "-y", "-f", "lavfi", "-i", `anullsrc=r=${SAMPLE_RATE}:cl=mono`,
      "-t", String(PAUSE_BETWEEN_LINES), "-c:a", "pcm_s16le", silence,
    ]);

    const list = path.join(work, "list.txt");
    const entries = [];
    parts.forEach((part, index) => {
      entries.push(`file '${part}'`);
      if (index < parts.length - 1) entries.push(`file '${silence}'`);
    });
    writeFileSync(list, `${entries.join("\n")}\n`);

    const output = path.join(outDir, `${id}.mp3`);
    execFileSync("ffmpeg", [
      "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list,
      "-af", "loudnorm=I=-18:TP=-1.5:LRA=11",
      "-ar", String(SAMPLE_RATE), "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k",
      "-metadata", `title=${id}`, output,
    ]);
    const seconds = execFileSync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", output,
    ]).toString().trim();
    console.log(`✓ ${path.relative(root, output)} (${Number(seconds).toFixed(1)}s, ${lines.length} lines)`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
