export const MODULES = ["listening", "reading", "writing", "speaking"] as const;

export type IeltsModule = (typeof MODULES)[number];

export const MODULE_LABELS: Record<IeltsModule, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

export function isModule(value: unknown): value is IeltsModule {
  return typeof value === "string" && (MODULES as readonly string[]).includes(value);
}
