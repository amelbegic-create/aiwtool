"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";

const IDLE_MS = 10 * 60 * 1000; // 10 minuta

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
];

/**
 * Auto Logout: odjavi korisnika nakon 10 minuta neaktivnosti.
 * Prati: mousemove, keydown, click, scroll.
 * Učitava se unutar SessionProvider; aktivna je samo kad je korisnik logovan.
 */
export default function AutoLogout() {
  const { status } = useSession();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void signOut({ callbackUrl: "/login" });
      }, IDLE_MS);
    };

    resetTimer();

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, resetTimer as EventListener);
      }
    };
  }, [status]);

  return null;
}
