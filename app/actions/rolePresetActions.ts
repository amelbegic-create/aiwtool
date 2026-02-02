"use server";

import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/access";
import { ALL_PERMISSION_KEYS, GOD_MODE_ROLES } from "@/lib/permissions";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function isGodMode(role: Role) {
  return GOD_MODE_ROLES.has(String(role));
}

function sanitizePermissionKeys(keys: string[]) {
  const allowed = new Set(ALL_PERMISSION_KEYS);
  const unique = new Set<string>();

  for (const k of keys || []) {
    const key = String(k || "").trim();
    if (!key) continue;
    if (!allowed.has(key)) continue;
    unique.add(key);
  }

  return Array.from(unique);
}

/**
 * Učitaj preset permisije za rolu.
 *
 * Koristi se u Admin UI (Create/Edit korisnika) da automatski čekira permisije kad izabereš rolu.
 */
export async function getRolePermissionPreset(role: Role): Promise<ActionResult<{ role: Role; keys: string[] }>> {
  try {
    // ko vidi korisnike može učitati preset (u praksi: /admin/users)
    await requirePermission("users:access");

    if (isGodMode(role)) {
      // God-mode role imaju sve automatski; preset nema smisla.
      return { success: true, data: { role, keys: ALL_PERMISSION_KEYS } };
    }

    const row = await prisma.rolePermissionPreset.findFirst({
      where: { role },
      select: { permissionKeys: true },
    });

    const keys = Array.isArray(row?.permissionKeys) ? row!.permissionKeys : [];
    return { success: true, data: { role, keys: sanitizePermissionKeys(keys) } };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Greška pri učitavanju preset permisija.";
    return { success: false, error: message };
  }
}

/**
 * Snimi preset permisije za rolu.
 *
 * Ovo je "podesi jednom" ekran — nakon toga kreiranje korisnika može automatski dodeliti permisije.
 */
export async function saveRolePermissionPreset(role: Role, keys: string[]): Promise<ActionResult<{ role: Role; keys: string[] }>> {
  try {
    await requirePermission("users:permissions");

    if (isGodMode(role)) {
      return { success: false, error: "SYSTEM_ARCHITECT/SUPER_ADMIN/ADMIN imaju sve automatski. Preset se ne podešava za ove role." };
    }

    const sanitized = sanitizePermissionKeys(keys);

    await prisma.rolePermissionPreset.upsert({
      where: { role },
      update: { permissionKeys: { set: sanitized } },
      create: { role, permissionKeys: sanitized },
    });

    // UI revalidacija
    revalidatePath("/admin/role-presets");
    revalidatePath("/admin/users");

    return { success: true, data: { role, keys: sanitized } };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Greška pri snimanju preset permisija.";
    return { success: false, error: message };
  }
}
