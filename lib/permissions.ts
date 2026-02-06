/* eslint-disable @typescript-eslint/no-explicit-any */
import { Role } from "@prisma/client";

export type PermissionKey = string;

export type PermissionGroup = {
  id: string;
  title: string;
  subtitle?: string;
  items: Array<{
    key: PermissionKey;
    label: string;
  }>;
};

/**
 * ✅ VAŽNO:
 * - GOD MODE role imaju sve permisije automatski (bypass).
 * - Ostale role (ADMIN/MANAGER/CREW) moraju imati eksplicitno dodijeljene permisije.
 */
export const GOD_MODE_ROLES = new Set(["SYSTEM_ARCHITECT", "SUPER_ADMIN"]);

export const PERMISSIONS: PermissionGroup[] = [
  {
    id: "rules",
    title: "Pravila",
    subtitle: "Upravljanje pravilima, kategorijama i sadržajem",
    items: [
      { key: "rules:access", label: "Pristup pravilima" },
      { key: "rules:create", label: "Kreiranje pravila" },
      { key: "rules:edit", label: "Uređivanje pravila" },
      { key: "rules:delete", label: "Brisanje pravila" },
      { key: "rules:publish", label: "Objava pravila" },
      { key: "rules:categories", label: "Upravljanje kategorijama" },
      { key: "rules:uploads", label: "Upload fajlova" },
    ],
  },
  {
    id: "pds",
    title: "PDS sistem",
    subtitle: "Evaluacije učinka i razvoja",
    items: [{ key: "pds:access", label: "Pristup PDS modulu" }],
  },
  {
    id: "vacation",
    title: "Godišnji odmor",
    subtitle: "Zahtjevi, odobrenja, blokirani dani i export",
    items: [
      { key: "vacation:access", label: "Pristup modulu godišnjih" },
      { key: "vacation:create", label: "Kreiranje zahtjeva" },
      { key: "vacation:edit", label: "Uređivanje zahtjeva" },
      { key: "vacation:cancel", label: "Otkazivanje zahtjeva" },
      { key: "vacation:approve", label: "Odobravanje/odbijanje zahtjeva" },
      { key: "vacation:blocked_days", label: "Upravljanje blokiranim danima" },
      { key: "vacation:export", label: "Export (PDF/CSV)" },
    ],
  },
  {
    id: "labor",
    title: "Labor planner",
    subtitle: "Budžet i planiranje rada",
    items: [
      { key: "labor:access", label: "Pristup Labor modulu" },
      { key: "labor:edit", label: "Uređivanje plana" },
    ],
  },
  {
    id: "productivity",
    title: "Produktivnost",
    subtitle: "CL izvještaji i produktivnost",
    items: [
      { key: "productivity:access", label: "Pristup modulu produktivnosti" },
      { key: "productivity:edit", label: "Uređivanje izvještaja" },
    ],
  },
  {
    id: "bonus",
    title: "Bonusi",
    subtitle: "Godišnji bonus obračun i podešavanja",
    items: [
      { key: "bonus:access", label: "Pristup bonus modulu" },
      { key: "bonus:manage", label: "Upravljanje postavkama bonusa" },
    ],
  },
  {
    id: "admin",
    title: "Admin",
    subtitle: "Korisnici, restorani, permisije i sistem",
    items: [
      { key: "users:access", label: "Pristup listi korisnika" },
      { key: "users:manage", label: "Upravljanje korisnicima" },
      { key: "restaurants:access", label: "Pristup listi restorana" },
      { key: "restaurants:manage", label: "Upravljanje restoranima" },
      { key: "users:permissions", label: "Preset permisije po roli" },
    ],
  },
  {
    id: "inventory",
    title: "Inventar",
    subtitle: "Zalihe i inventar",
    items: [
      { key: "inventory:access", label: "Pristup inventaru" },
      { key: "inventory:edit", label: "Uređivanje zaliha" },
    ],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.flatMap((g) => g.items.map((i) => i.key));

export function hasPermission(user: any, key: PermissionKey) {
  if (!user) return false;
  if (GOD_MODE_ROLES.has(String(user.role))) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(key);
}

export function isGodModeRole(role: Role) {
  return GOD_MODE_ROLES.has(String(role));
}
