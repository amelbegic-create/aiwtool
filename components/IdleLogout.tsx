"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

/**
 * Auto-logout nakon 10 minuta neaktivnosti.
 *
 * Neaktivnost = nema user input događaja (mouse, keyboard, touch, scroll).
 *
 * Napomena: Ovo je client-only zaštita. Na produkciji je dobro imati i server-side
 * session TTL, ali ovdje po zahtjevu radimo pouzdanu UX varijantu.
 */
export default function IdleLogout({ timeoutMs = 10 * 60 * 1000 }: { timeoutMs?: number }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Očisti sesiju i vrati na login
        void signOut({ callbackUrl: "/login" });
      }, timeoutMs);
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
      "focus",
    ];

    // Start timer on mount
    reset();

    for (const ev of events) {
      window.addEventListener(ev, reset, { passive: true });
    }

    // If tab becomes visible again, reset (prevents immediate logout on return)
    const onVisibility = () => {
      if (document.visibilityState === "visible") reset();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const ev of events) {
        window.removeEventListener(ev, reset as EventListener);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [timeoutMs]);

  return null;
}
