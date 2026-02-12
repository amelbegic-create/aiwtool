"use client";

import { useSession } from "next-auth/react";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

/**
 * Auto Logout: odjavi korisnika nakon 10 minuta neaktivnosti.
 * Koristi useInactivityLogout hook s throttle-om (reset najviše 1x/s).
 * Aktivna samo kad je korisnik autenticiran.
 */
export default function AutoLogout() {
  const { status } = useSession();
  const enabled = status === "authenticated";

  useInactivityLogout(enabled);

  return null;
}
