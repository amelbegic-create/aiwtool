// lib/access.ts
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { GOD_MODE_ROLES } from "@/lib/permissions";
import { redirect } from "next/navigation";

export class PermissionDeniedError extends Error {
  constructor(message = "Nemate permisije za ovu akciju.") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export async function getDbUserForAccess() {
  const session = await getServerSession(authOptions);

  // Niste prijavljeni → login
  if (!session?.user?.email) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true, permissions: true, isActive: true },
  });

  if (!dbUser) redirect("/login");
  if (!dbUser.isActive) throw new PermissionDeniedError("Korisnik je deaktiviran.");

  return dbUser;
}

const ADMIN_RULES_ROLES = new Set<string>(["ADMIN", "MANAGER"]);

export function hasPermission(role: string, permissions: string[], required: string) {
  if (GOD_MODE_ROLES.has(String(role))) return true;
  if (required === "partners:access") return true; // svi prijavljeni mogu gledati
  if (required.startsWith("rules:") && ADMIN_RULES_ROLES.has(String(role))) return true;
  // Admin/Manager imaju pristup Partner modulu (manage); access je gore
  if (required.startsWith("partners:") && ADMIN_RULES_ROLES.has(String(role))) return true;
  return Array.isArray(permissions) && permissions.includes(required);
}

export async function requirePermission(required: string) {
  const dbUser = await getDbUserForAccess();

  if (!hasPermission(String(dbUser.role), dbUser.permissions || [], required)) {
    throw new PermissionDeniedError();
  }

  return dbUser;
}

/**
 * Provjerava permisiju. Ako korisnik nema pristup, vraća null (za prikaz NoPermission stranice).
 * Ako ima pristup, vraća dbUser.
 */
export async function tryRequirePermission(required: string): Promise<{ ok: true; user: Awaited<ReturnType<typeof getDbUserForAccess>> } | { ok: false }> {
  try {
    const dbUser = await requirePermission(required);
    return { ok: true, user: dbUser };
  } catch {
    return { ok: false };
  }
}
