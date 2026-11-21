"use client";

import { useEffect, useRef, useState } from "react";

/** Seconds left until `deadline` (epoch ms), ticking twice a second. Calls `onExpire` once. */
export function useCountdown(deadline: number | null, onExpire?: () => void): number | null {
  const [now, setNow] = useState(() => Date.now());
  const expired = useRef(false);
  const callback = useRef(onExpire);

  useEffect(() => {
    callback.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    expired.current = false;
    if (deadline == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [deadline]);

  const left = deadline == null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
  useEffect(() => {
    if (left === 0 && !expired.current) {
      expired.current = true;
      callback.current?.();
    }
  }, [left]);
  return left;
}

/** Seconds since `start` (epoch ms). */
export function useElapsed(start: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (start == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [start]);
  return start == null ? null : Math.max(0, Math.floor((now - start) / 1000));
}

/** Stops the page behind a full-screen test from scrolling. */
export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

/** Warns before leaving a page with an unfinished test. */
export function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}

export function loadJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode): drafts are a convenience only
  }
}

export function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
