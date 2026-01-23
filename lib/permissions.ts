// lib/permissions.ts
export type PermissionKey = string;

export type PermissionItem = {
  key: PermissionKey;
  label: string;
  description?: string;
};

export type PermissionGroup = {
  id: string;
  title: string;
  subtitle?: string;
  items: PermissionItem[];
};

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
      { key: "rules:toggle", label: "Aktivacija/Deaktivacija pravila" },
      { key: "rules:categories", label: "Upravljanje kategorijama" },
      { key: "rules:media", label: "Upload medija (slike/video/pdf)" },
    ],
  },

  {
    id: "vacation",
    title: "Godišnji odmor",
    subtitle: "Zahtjevi, odobrenja, statistika i praznici",
    items: [
      { key: "vacation:access", label: "Pristup modulu" },
      { key: "vacation:view_all", label: "Pregled svih zahtjeva" },
      { key: "vacation:approve", label: "Odobravanje/Odbijanje zahtjeva" },
      { key: "vacation:blocked_days", label: "Upravljanje praznicima" },
      { key: "vacation:export", label: "Export PDF/Excel" },
    ],
  },

  // ✅ PDS modul
  {
    id: "pds",
    title: "PDS",
    subtitle: "Evaluacije performansi i PDS ciklusi",
    items: [
      { key: "pds:access", label: "Pristup PDS modulu" },
      { key: "pds:edit", label: "Uređivanje PDS-a" },
      { key: "pds:submit", label: "Slanje/zaključavanje PDS-a" },
      { key: "pds:templates", label: "Upravljanje PDS template-ima" },
      { key: "pds:admin", label: "Admin pristup PDS-u" },
    ],
  },

  // ✅ Produktivnost modul
  {
    id: "productivity",
    title: "Produktivnost",
    subtitle: "Izvještaji i KPI produktivnosti",
    items: [
      { key: "productivity:access", label: "Pristup modulu" },
      { key: "productivity:edit", label: "Unos/Uređivanje izvještaja" },
      { key: "productivity:export", label: "Export PDF/Excel" },
      { key: "productivity:admin", label: "Admin pristup" },
    ],
  },

  // ✅ Labor planer / labor report modul
  {
    id: "labor",
    title: "Labor planer",
    subtitle: "Planiranje smjena i labor izvještaji",
    items: [
      { key: "labor:access", label: "Pristup modulu" },
      { key: "labor:plan", label: "Uređivanje planova" },
      { key: "labor:report", label: "Uređivanje izvještaja" },
      { key: "labor:export", label: "Export PDF/Excel" },
      { key: "labor:admin", label: "Admin pristup" },
    ],
  },

  {
    id: "users",
    title: "Korisnici",
    subtitle: "Kreiranje korisnika i dodjela prava",
    items: [
      { key: "users:access", label: "Pristup korisnicima" },
      { key: "users:create", label: "Kreiranje korisnika" },
      { key: "users:edit", label: "Uređivanje korisnika" },
      { key: "users:delete", label: "Brisanje korisnika" },
      { key: "users:permissions", label: "Dodjela permisija" },
    ],
  },

  {
    id: "restaurants",
    title: "Restorani",
    subtitle: "Lokacije i dodjela korisnika restoranima",
    items: [
      { key: "restaurants:access", label: "Pristup restoranima" },
      { key: "restaurants:create", label: "Kreiranje restorana" },
      { key: "restaurants:edit", label: "Uređivanje restorana" },
      { key: "restaurants:delete", label: "Brisanje restorana" },
      { key: "restaurants:toggle", label: "Aktivacija/Deaktivacija restorana" },
    ],
  },

  // ✅ BONANSI — Admin-only alat
  {
    id: "bonusi",
    title: "Bonusi",
    subtitle: "Admin alat za obračun i evidenciju bonusa",
    items: [
      { key: "bonusi:access", label: "Pristup alatu Bonusi" },
      { key: "bonusi:edit", label: "Uređivanje / spremanje podataka" },
      { key: "bonusi:export", label: "Export podataka" },
    ],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.flatMap((g) =>
  g.items.map((i) => i.key)
);

// “God-mode” role: dobije sve automatski
export const GOD_MODE_ROLES = new Set(["SYSTEM_ARCHITECT", "SUPER_ADMIN", "ADMIN"]);

// Helper: map label by key
export const PERMISSION_LABEL: Record<string, string> = Object.fromEntries(
  PERMISSIONS.flatMap((g) => g.items.map((i) => [i.key, i.label]))
);
