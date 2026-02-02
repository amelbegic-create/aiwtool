"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

/**
 * Auto logout nakon 10 minuta neaktivnosti (mouse/keyboard/scroll/touch).
 * Radi u productionu na Vercelu bez custom cookie name-a (NextAuth v4).
 */
export default function IdleLogout({ minutes = 10 }: { minutes?: number }) {
  const timeoutRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimer = () => {
    lastActivityRef.current = Date.now();
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    timeoutRef.current = window.setTimeout(async () => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= minutes * 60 * 1000) {
        await signOut({ callbackUrl: "/login" });
      } else {
        resetTimer();
      }
    }, minutes * 60 * 1000);
  };

  useEffect(() => {
    resetTimer();

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;
    const handler = () => resetTimer();

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      events.forEach((e) => window.removeEventListener(e, handler));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes]);

  return null;
}
