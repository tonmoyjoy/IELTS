"use client";

import { useEffect, useRef, useState } from "react";
import {
  applyTheme,
  getBreakReminders,
  getTextSize,
  getThemePreference,
  setBreakReminders,
  setTextSize,
  setThemePreference,
  type TextSize,
  type ThemePreference,
} from "@/lib/preferences";

const THEMES: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const SIZES: Array<{ value: TextSize; label: string; aria: string }> = [
  { value: "md", label: "A", aria: "Normal text" },
  { value: "lg", label: "A", aria: "Large text" },
  { value: "xl", label: "A", aria: "Extra large text" },
];

function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: Array<{ value: T; label: string; aria?: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium text-ink-soft">{legend}</legend>
      <div className="flex rounded-xl bg-sunken p-1">
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            aria-label={option.aria}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-lg px-2 py-1.5 font-medium transition-colors ${
              value === option.value ? "bg-surface text-ink shadow-soft" : "text-ink-soft hover:text-ink"
            }`}
            style={option.aria ? { fontSize: `${0.8 + index * 0.15}rem` } : undefined}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Reading comfort: colour mode, text size and break reminders. */
export function ComfortMenu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [size, setSize] = useState<TextSize>("md");
  const [breaks, setBreaks] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Read device preferences after hydration (localStorage is browser-only).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(getThemePreference());
    setSize(getTextSize());
    setBreaks(getBreakReminders());
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Display and comfort settings"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </button>
      {open && (
        <div role="dialog" aria-label="Display and comfort settings" className="absolute right-0 top-11 z-40 w-64 space-y-4 rounded-2xl border border-line bg-raised p-4 shadow-lift">
          <Segmented
            legend="Colour mode"
            options={THEMES}
            value={theme}
            onChange={(next) => {
              setTheme(next);
              setThemePreference(next);
            }}
          />
          <Segmented
            legend="Text size"
            options={SIZES}
            value={size}
            onChange={(next) => {
              setSize(next);
              setTextSize(next);
            }}
          />
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={breaks}
              onChange={(e) => {
                setBreaks(e.target.checked);
                setBreakReminders(e.target.checked);
              }}
            />
            <span>
              <span className="font-medium text-ink">Eye-rest reminders</span>
              <span className="block text-xs text-ink-soft">Every 20 minutes, look 20 feet away for 20 seconds.</span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
