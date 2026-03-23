import { PERMISSION_BYPASS_ROLES } from "@/lib/iamRoles";

/** Čista provjera (bez Prisma/session) – koristi `access.ts` i klijent. */
export function hasPermission(role: string, permissions: string[], required: string) {
  if (PERMISSION_BYPASS_ROLES.has(String(role))) return true;
  return Array.isArray(permissions) && permissions.includes(required);
}
