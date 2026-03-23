import { ALL_PERMISSION_KEYS } from "@/lib/permissions";

/** Ranije implicitno u access.ts – sada eksplicitno u User.permissions za sve prijavljene. */
export const IMPLICIT_LOGIN_PERMISSION_KEYS = [
  "todo:access",
  "partners:access",
  "vorlagen:access",
  "besuchsberichte:access",
] as const;

/** Pun skup za ADMIN nakon migracije (konfigurabilno, ali početno full). */
export function buildFullAdminPermissionSet(): string[] {
  return [...new Set([...ALL_PERMISSION_KEYS, ...IMPLICIT_LOGIN_PERMISSION_KEYS])];
}

/** Tipični MANAGER: odobravanje + moduli koji su ranije imali role shortcut. */
export function buildDefaultManagerPermissionSet(): string[] {
  const keys = new Set<string>([
    ...IMPLICIT_LOGIN_PERMISSION_KEYS,
    "vacation:access",
    "vacation:create",
    "vacation:edit",
    "vacation:cancel",
    "vacation:approve",
    "calendar:write",
    "rules:access",
    "rules:create",
    "rules:edit",
    "rules:delete",
    "rules:publish",
    "rules:categories",
    "rules:uploads",
    "partners:manage",
    "pds:access",
  ]);
  return [...keys].filter((k) => ALL_PERMISSION_KEYS.includes(k));
}

export function buildDefaultManagementPermissionSet(): string[] {
  return [...IMPLICIT_LOGIN_PERMISSION_KEYS].filter((k) => ALL_PERMISSION_KEYS.includes(k));
}

export function buildDefaultMitarbeiterPermissionSet(): string[] {
  return [...IMPLICIT_LOGIN_PERMISSION_KEYS].filter((k) => ALL_PERMISSION_KEYS.includes(k));
}
