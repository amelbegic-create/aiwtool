"use client";

import { useSession } from "next-auth/react";

type SessionUser = { role?: string; permissions?: Record<string, string[]> };

export function usePermission() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;

  const can = (module: string, action: string) => {
    if (user?.role === "SUPER_ADMIN") return true;
    if (!user?.permissions) return false;
    const modulePermissions = user.permissions[module];
    if (!modulePermissions) return false;
    return modulePermissions.includes(action);
  };

  return {
    can,
    role: user?.role,
    user: session?.user,
  };
}