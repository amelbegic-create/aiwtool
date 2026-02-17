"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";

const IDLE_MS = 10 * 60 * 1000; // 10 minuta
const THROTTLE_MS = 1000; // Reset timer najviše jednom u sekundi

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
];

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
 * AutoLogoutProvider: prati aktivnost i odjavljuje korisnika nakon 10 min neaktivnosti.
 * Preusmjerava na /login?timeout=true da login stranica može prikazati poruku.
 * Mora biti unutar SessionProvider; aktivna je samo kad je korisnik autenticiran.
 */
export default function AutoLogoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void signOut({ callbackUrl: "/login?timeout=true" });
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
  }, [status]);

  return <>{children}</>;
}
