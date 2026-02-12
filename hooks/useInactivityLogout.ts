"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

const IDLE_MS = 10 * 60 * 1000; // 10 minuta
const THROTTLE_MS = 1000; // Reset timer najviše jednom u sekundi

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
];

/**
 * Throttles function calls – max once per THROTTLE_MS.
 */
function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limitMs) {
      lastCall = now;
      fn(...args);
    }
  };
}

/**
 * Hook: automatski odjavi korisnika nakon 10 minuta neaktivnosti.
 * Prati: mousemove, keydown, click, scroll, touchstart.
 * Throttle: reset timer najviše jednom u sekundi (zaštićuje od mousemove spam-a).
 */
export function useInactivityLogout(enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void signOut({ callbackUrl: "/login?reason=inactivity" });
      }, IDLE_MS);
    };

    const throttledReset = throttle(resetTimer, THROTTLE_MS);

    resetTimer();

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, throttledReset, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, throttledReset as EventListener);
      }
    };
  }, [enabled]);
}
