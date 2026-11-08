/**
 * Per-device reading-comfort preferences, stored in localStorage.
 * Applied before first paint by the inline script in the root layout, so
 * there is no flash of the wrong theme.
 */

export type ThemePreference = "system" | "light" | "dark";
export type TextSize = "md" | "lg" | "xl";

export const THEME_KEY = "ielts:theme";
export const TEXT_KEY = "ielts:text";
export const BREAKS_KEY = "ielts:breaks";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the choice still applies for this page view
  }
}

export function getThemePreference(): ThemePreference {
  const value = read(THEME_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function setThemePreference(preference: ThemePreference) {
  write(THEME_KEY, preference);
  applyTheme(preference);
}

export function getTextSize(): TextSize {
  const value = read(TEXT_KEY);
  return value === "lg" || value === "xl" ? value : "md";
}

export function setTextSize(size: TextSize) {
  write(TEXT_KEY, size);
  if (size === "md") delete document.documentElement.dataset.text;
  else document.documentElement.dataset.text = size;
}

export function getBreakReminders(): boolean {
  return read(BREAKS_KEY) !== "off";
}

export function setBreakReminders(on: boolean) {
  write(BREAKS_KEY, on ? "on" : "off");
  window.dispatchEvent(new Event("ielts:breaks-changed"));
}

/** Runs before hydration. Keep in sync with the functions above. */
export const PREFERENCES_BOOT_SCRIPT = `(function(){try{var e=document.documentElement;var t=localStorage.getItem("${THEME_KEY}")||"system";if(t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches))e.classList.add("dark");var s=localStorage.getItem("${TEXT_KEY}");if(s==="lg"||s==="xl")e.dataset.text=s;}catch(_){}})();`;
