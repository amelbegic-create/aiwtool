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
    title: "Richtlinien",
    subtitle: "Verwaltung von Richtlinien, Kategorien und Inhalten",
    items: [
      { key: "rules:access", label: "Zugriff auf Richtlinien" },
      { key: "rules:create", label: "Richtlinien erstellen" },
      { key: "rules:edit", label: "Richtlinien bearbeiten" },
      { key: "rules:delete", label: "Richtlinien löschen" },
      { key: "rules:publish", label: "Richtlinien veröffentlichen" },
      { key: "rules:categories", label: "Kategorien verwalten" },
      { key: "rules:uploads", label: "Dateien hochladen" },
    ],
  },
  {
    id: "pds",
    title: "Beurteilungssystem",
    subtitle: "Leistungs- und Entwicklungsbeurteilungen",
    items: [{ key: "pds:access", label: "Zugriff auf PDS-Modul" }],
  },
  {
    id: "vacation",
    title: "Jahresurlaub",
    subtitle: "Anträge, Genehmigungen, gesperrte Tage und Export",
    items: [
      { key: "vacation:access", label: "Zugriff auf Urlaubsmodul" },
      { key: "vacation:create", label: "Anträge erstellen" },
      { key: "vacation:edit", label: "Anträge bearbeiten" },
      { key: "vacation:cancel", label: "Anträge stornieren" },
      { key: "vacation:approve", label: "Anträge genehmigen/ablehnen" },
      { key: "vacation:blocked_days", label: "Gesperrte Tage verwalten" },
      { key: "vacation:export", label: "Export (PDF/CSV)" },
    ],
  },
  {
    id: "labor",
    title: "Arbeitsplaner",
    subtitle: "Budget und Arbeitsplanung",
    items: [
      { key: "labor:access", label: "Zugriff auf Arbeitsplaner" },
      { key: "labor:edit", label: "Plan bearbeiten" },
    ],
  },
  {
    id: "productivity",
    title: "Produktivität",
    subtitle: "CL-Berichte und Produktivität",
    items: [
      { key: "productivity:access", label: "Zugriff auf Produktivitätsmodul" },
      { key: "productivity:edit", label: "Berichte bearbeiten" },
    ],
  },
  {
    id: "bonus",
    title: "Prämien & Bonus",
    subtitle: "Jahresbonus-Berechnung und Einstellungen",
    items: [
      { key: "bonus:access", label: "Zugriff auf Bonusmodul" },
      { key: "bonus:manage", label: "Bonus-Einstellungen verwalten" },
    ],
  },
  {
    id: "partners",
    title: "Firmen und Partner",
    subtitle: "Lieferanten und Serviceunternehmen – Zugriff und Verwaltung",
    items: [
      { key: "partners:access", label: "Zugriff auf Liste der Firmen und Partner" },
      { key: "partners:manage", label: "Firmen hinzufügen, bearbeiten und löschen" },
    ],
  },
  {
    id: "holidays",
    title: "Feiertage",
    subtitle: "Globale Feiertage für Arbeitsplaner und andere Module",
    items: [{ key: "holidays:manage", label: "Feiertage verwalten" }],
  },
  {
    id: "ideenbox",
    title: "Ideenbox",
    subtitle: "Vorschläge von Mitarbeitern lesen und verwalten",
    items: [{ key: "ideenbox:access", label: "Ideenbox lesen & verwalten" }],
  },
  {
    id: "admin",
    title: "Verwaltung",
    subtitle: "Benutzer, Restaurants, Berechtigungen und System",
    items: [
      { key: "users:access", label: "Zugriff auf Benutzerliste" },
      { key: "users:manage", label: "Benutzer verwalten" },
      { key: "restaurants:access", label: "Zugriff auf Standortliste" },
      { key: "restaurants:manage", label: "Standorte verwalten" },
      { key: "users:permissions", label: "Rollen-Vorlagen (Berechtigungen)" },
    ],
  },
  {
    id: "inventory",
    title: "Inventar",
    subtitle: "Bestände und Inventar",
    items: [
      { key: "inventory:access", label: "Zugriff auf Inventar" },
      { key: "inventory:edit", label: "Bestände bearbeiten" },
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
