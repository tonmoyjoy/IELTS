import "server-only";
import scripts from "@/server/content/listening-scripts.json";

export type ScriptLine = { speaker: string; text: string };
export type ListeningScript = { voices: Record<string, "male" | "female">; lines: ScriptLine[] };

const typed = scripts as Record<string, ListeningScript>;

/** Transcript is revealed to the candidate only after they submit their answers. */
export function getListeningScript(setId: string): ListeningScript | undefined {
  return typed[setId];
}
