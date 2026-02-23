/**
 * Jednokratni import partnera iz scripts/firmenliste-import.json.
 * Koristi Prisma izravno (bez Next.js auth).
 *
 * Pokretanje: npx tsx scripts/import-partners.ts [putanja-do-json]
 * Primjer:    npx tsx scripts/import-partners.ts
 *             npx tsx scripts/import-partners.ts ./scripts/firmenliste-import.json
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

type ContactInput = {
  contactName: string | null;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
};

type ImportRow = {
  categoryName: string;
  companyName: string;
  serviceDescription?: string | null;
  notes?: string | null;
  contacts: ContactInput[];
};

const CATEGORY_ICON: Record<string, string> = {
  IT: "Cpu",
  "Haus Technik": "Wrench",
  Getränke: "Folder",
  Lüftung: "Folder",
  Food: "Folder",
  Reststoffe: "Folder",
  "Food Safety": "Folder",
  Reinigung: "Folder",
  Service: "Folder",
  Anlagentechnik: "Settings",
  Sonstiges: "Folder",
};

function normalizeContact(c: ContactInput): { contactName: string; phone: string | null; email: string | null; role: string | null } {
  return {
    contactName: (c.contactName && c.contactName.trim()) || "—",
    phone: c.phone?.trim() || null,
    email: c.email?.trim() || null,
    role: c.role?.trim() || null,
  };
}

async function ensureCategories(categoryNames: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(categoryNames)].filter(Boolean);
  const existing = await prisma.partnerCategoryModel.findMany({
    where: { name: { in: unique } },
    select: { id: true, name: true },
  });
  const map = new Map<string, string>();
  for (const c of existing) {
    map.set(c.name, c.id);
  }

  const toCreate = unique.filter((name) => !map.has(name));
  if (toCreate.length === 0) {
    return map;
  }

  const maxOrder = await prisma.partnerCategoryModel.aggregate({ _max: { sortOrder: true } });
  let sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  for (const name of toCreate) {
    const icon = CATEGORY_ICON[name] ?? "Folder";
    const created = await prisma.partnerCategoryModel.create({
      data: { name, icon, sortOrder: sortOrder++ },
    });
    map.set(name, created.id);
  }
  return map;
}

async function main() {
  const defaultPath = path.join(process.cwd(), "scripts", "firmenliste-import.json");
  const jsonPath = process.argv[2] || defaultPath;
  if (!fs.existsSync(jsonPath)) {
    console.error("Datoteka nije pronađena:", jsonPath);
    if (process.argv[2]) {
      console.error("Za standardni import pokrenite bez argumenta: npm run import-partners");
    }
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, "utf-8");
  let rows: ImportRow[];
  try {
    rows = JSON.parse(raw) as ImportRow[];
  } catch (e) {
    console.error("Neispravan JSON:", e);
    process.exit(1);
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    console.error("JSON mora biti niz objekata s podacima firmi.");
    process.exit(1);
  }

  const categoryNames = rows.map((r) => r.categoryName).filter(Boolean);
  const categoryIdByName = await ensureCategories(categoryNames);
  console.log("Kategorije osigurane:", categoryIdByName.size);

  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    const categoryId = categoryIdByName.get(row.categoryName);
    if (!categoryId) {
      console.warn("Preskačem firmu bez poznate kategorije:", row.companyName);
      skipped++;
      continue;
    }

    const existing = await prisma.partnerCompany.findFirst({
      where: { companyName: row.companyName.trim() },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const contacts = row.contacts
      .map(normalizeContact)
      .filter((c) => c.contactName && c.contactName !== "—");
    if (contacts.length === 0) {
      contacts.push({ contactName: "—", phone: null, email: null, role: null });
    }

    await prisma.partnerCompany.create({
      data: {
        categoryId,
        companyName: row.companyName.trim(),
        serviceDescription: row.serviceDescription?.trim() || null,
        notes: row.notes?.trim() || null,
        contacts: {
          create: contacts.map((c) => ({
            contactName: c.contactName,
            phone: c.phone,
            email: c.email,
            role: c.role,
          })),
        },
      },
    });
    created++;
  }

  console.log("Završeno. Kreirano:", created, "Preskočeno (duplikati/bez kategorije):", skipped);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
