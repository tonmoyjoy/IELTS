"use client";

import { useEffect, useState } from "react";
import { getBreakReminders } from "@/lib/preferences";

const INTERVAL_SECONDS = 20 * 60;

/**
 * 20-20-20 eye-rest reminder. Counts only time the tab is visible, so it
 * does not fire for people who left the page open in the background.
 */
export function BreakReminder() {
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(getBreakReminders());
    sync();
    window.addEventListener("ielts:breaks-changed", sync);
    return () => window.removeEventListener("ielts:breaks-changed", sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let elapsed = 0;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      elapsed += 1;
      if (elapsed >= INTERVAL_SECONDS) {
        elapsed = 0;
        setVisible(true);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [enabled]);

  if (!visible || !enabled) return null;
  return (
    <div role="status" className="fixed bottom-5 right-5 z-50 max-w-xs rounded-2xl border border-line bg-raised p-4 shadow-lift">
      <p className="font-serif font-semibold text-ink">Time to rest your eyes</p>
      <p className="mt-1 text-sm leading-6 text-ink-soft">Look at something about 20 feet away for 20 seconds, then carry on.</p>
      <button type="button" onClick={() => setVisible(false)} className="mt-3 text-sm font-medium text-accent-text hover:underline">
        Done
      </button>
    </div>
  );
}
