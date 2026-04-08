/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Role } from "@prisma/client";
import { GLOBAL_SCOPE_ROLES, PERMISSION_BYPASS_ROLES } from "@/lib/iamRoles";

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
 * GLOBAL_SCOPE_ROLES (ex-GOD_MODE): vidljivost svih restorana / admin-scope u modulima.
 * PERMISSION_BYPASS_ROLES: samo SYSTEM_ARCHITECT – zaobilazi provjeru permissions[] u hasPermission (access.ts).
 */
export const GOD_MODE_ROLES = GLOBAL_SCOPE_ROLES;

export { PERMISSION_BYPASS_ROLES, GLOBAL_SCOPE_ROLES };

/** @deprecated koristi PERMISSION_BYPASS_ROLES gdje treba samo arhitekt */
export function canEditDashboardChangelog(
  role: string | undefined | null,
  permissions?: string[] | null | undefined
): boolean {
  if (PERMISSION_BYPASS_ROLES.has(String(role ?? ""))) return true;
  return Array.isArray(permissions) && permissions.includes("dashboard_changelog:edit");
}

export const PERMISSIONS: PermissionGroup[] = [
  {
    id: "admin_panel",
    title: "Admin Panel",
    subtitle: "Zentraler Zugang zur Verwaltung; Untermodule separat",
    items: [{ key: "admin_panel:access", label: "Admin Panel öffnen (Navigation + /admin)" }],
  },
  {
    id: "dashboard_meta",
    title: "Dashboard & Startseite",
    subtitle: "Globale Texte auf der Startseite",
    items: [
      { key: "dashboard_changelog:edit", label: "„Aktuelle Änderungen“ auf der Startseite bearbeiten" },
      {
        key: "dashboard_news:manage",
        label: "Dashboard-News-Slider: Meldungen anlegen, bearbeiten und hochladen",
      },
      {
        key: "dashboard_events:manage",
        label: "Dashboard-Events-Slider: Events und Bildergalerie verwalten",
      },
      {
        key: "dashboard_docs:manage",
        label: "Dashboard: Globale PDF-Dokumente (Biblija AIW) hochladen und verwalten",
      },
    ],
  },
  {
    id: "todo",
    title: "To-Do",
    subtitle: "Persönliche Aufgaben",
    items: [{ key: "todo:access", label: "To-Do-Modul nutzen" }],
  },
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
    id: "calendar",
    title: "Kalender",
    subtitle: "Termine, Urlaub und Schichten – wer darf Einträge erstellen",
    items: [{ key: "calendar:write", label: "Događaje u kalendar upisivati" }],
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
    id: "vorlagen",
    title: "Vorlagen",
    subtitle: "Offizielle Dokumente und Formulare",
    items: [
      { key: "vorlagen:access", label: "Zugriff auf Vorlagen" },
      { key: "vorlagen:manage", label: "Vorlagen verwalten (Upload, Löschen)" },
    ],
  },
  {
    id: "besuchsberichte",
    title: "Besuchsberichte",
      subtitle: "Besuchsberichte pro Standort, Reihenfolge der Dokumente",
    items: [
      { key: "besuchsberichte:access", label: "Zugriff auf Besuchsberichte" },
      { key: "besuchsberichte:manage", label: "Kategorien und Dokumente verwalten (pro Standort)" },
    ],
  },
  {
    id: "admin",
    title: "Verwaltung (Benutzer & Standorte)",
    subtitle: "Benutzer, Restaurants, Berechtigungen",
    items: [
      { key: "users:access", label: "Zugriff auf Benutzerliste" },
      { key: "users:manage", label: "Benutzer verwalten" },
      { key: "restaurants:access", label: "Zugriff auf Standortliste" },
      { key: "restaurants:manage", label: "Standorte verwalten (Legacy-Sammelrecht)" },
      { key: "restaurants:create", label: "Standorte anlegen" },
      { key: "restaurants:edit", label: "Standorte bearbeiten" },
      { key: "restaurants:toggle", label: "Standort aktiv/inaktiv" },
      { key: "restaurants:delete", label: "Standorte löschen" },
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

export function isGodModeRole(role: Role) {
  return PERMISSION_BYPASS_ROLES.has(String(role));
}

export function isGlobalScopeRole(role: string | Role | null | undefined) {
  return GLOBAL_SCOPE_ROLES.has(String(role ?? ""));
}
