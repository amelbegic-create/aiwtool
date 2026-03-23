import { PERMISSION_BYPASS_ROLES } from "@/lib/iamRoles";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";

/** Čista provjera (bez Prisma/session) – koristi `access.ts` i klijent. */
export function hasPermission(role: string, permissions: string[], required: string) {
  if (PERMISSION_BYPASS_ROLES.has(String(role))) return true;
  const list = Array.isArray(permissions) ? permissions : [];
  /** ADMIN: implicitno svi ključevi iz kataloga (novi moduli nakon deploya bez obaveznog DB backfilla). */
  if (String(role) === "ADMIN") {
    if (ALL_PERMISSION_KEYS.includes(required)) return true;
    return list.includes(required);
  }
  return list.includes(required);
}
