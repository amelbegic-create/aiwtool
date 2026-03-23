"use client";

import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/permissionCheck";

type SessionUser = { role?: string; permissions?: string[] };

/**
 * Klijentska provjera usklađena s `hasPermission` (permissions: string[]).
 * `can("rules:access")` ili legacy `can("rules", "access")` → `rules:access`.
 */
export function usePermission() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const role = String(user?.role ?? "");
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];

  const can = (moduleOrKey: string, action?: string) => {
    const key = action ? `${moduleOrKey}:${action}` : moduleOrKey;
    return hasPermission(role, perms, key);
  };

  return {
    can,
    role: user?.role,
    user: session?.user,
  };
}
