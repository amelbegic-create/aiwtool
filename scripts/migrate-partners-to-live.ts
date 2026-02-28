/**
 * Jednokratna migracija partnera (kategorije, firme, kontakti) iz RADNE baze u LIVE bazu.
 *
 * Koristi DATABASE_URL (radna) kao izvor i LIVE_DATABASE_URL (live) kao odredište.
 * Učitava .env iz roota projekta.
 *
 * Pokretanje: npx tsx scripts/migrate-partners-to-live.ts
 *
 * Napomena: Na live bazi će se DODATI svi zapisi; ako već postoje kategorije/firme
 * s istim imenom, nastat će duplikati (ili prilagodi skriptu da provjeri postojeće).
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      process.env[key] = val;
    }
  } catch (e) {
    console.warn("Could not load .env:", (e as Error).message);
  }
}

loadEnv();

// Izvor = radna baza (RADNA_DATABASE_URL ili DATABASE_URL), odrediste = live (LIVE_DATABASE_URL ili DATABASE_URL)
const sourceUrl = process.env.RADNA_DATABASE_URL || process.env.DATABASE_URL;
const targetUrl = process.env.LIVE_DATABASE_URL || process.env.DATABASE_URL;

if (!sourceUrl || !targetUrl) {
  console.error("Potrebni su RADNA_DATABASE_URL (izvor) i LIVE_DATABASE_URL (odrediste) u .env");
  process.exit(1);
}

const sourcePrisma = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
const targetPrisma = new PrismaClient({ datasources: { db: { url: targetUrl } } });

async function main() {
  console.log("Ucitavam kategorije iz radne baze...");
  const categories = await sourcePrisma.partnerCategoryModel.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  console.log("  Pronadeno kategorija: " + categories.length);

  console.log("Ucitavam firme (partner companies) iz radne baze...");
  const companies = await sourcePrisma.partnerCompany.findMany({
    include: { contacts: true },
    orderBy: { companyName: "asc" },
  });
  console.log("  Pronadeno firmi: " + companies.length);
  const totalContacts = companies.reduce((acc, c) => acc + c.contacts.length, 0);
  console.log("  Ukupno kontakata: " + totalContacts);

  const categoryIdMap = new Map<string, string>();

  console.log("\n--- Migracija kategorija na LIVE ---");
  for (const cat of categories) {
    const existing = await targetPrisma.partnerCategoryModel.findFirst({
      where: { name: cat.name },
      select: { id: true },
    });
    if (existing) {
      categoryIdMap.set(cat.id, existing.id);
      console.log('  Kategorija "' + cat.name + '" vec postoji na live, preskacem kreiranje.');
    } else {
      const created = await targetPrisma.partnerCategoryModel.create({
        data: {
          name: cat.name,
          icon: cat.icon ?? undefined,
          sortOrder: cat.sortOrder,
        },
      });
      categoryIdMap.set(cat.id, created.id);
      console.log('  Kreirana kategorija: ' + cat.name);
    }
  }

  console.log("\n--- Migracija firmi na LIVE ---");
  const companyIdMap = new Map<string, string>();
  for (const comp of companies) {
    const newCategoryId = comp.categoryId ? categoryIdMap.get(comp.categoryId) ?? null : null;
    const created = await targetPrisma.partnerCompany.create({
      data: {
        categoryId: newCategoryId,
        companyName: comp.companyName,
        logoUrl: comp.logoUrl ?? undefined,
        serviceDescription: comp.serviceDescription ?? undefined,
        notes: comp.notes ?? undefined,
        websiteUrl: comp.websiteUrl ?? undefined,
        priceListPdfUrl: comp.priceListPdfUrl ?? undefined,
        galleryUrls: comp.galleryUrls ?? [],
      },
    });
    companyIdMap.set(comp.id, created.id);
    console.log('  Firma: ' + comp.companyName);
  }

  console.log("\n--- Migracija kontakata na LIVE ---");
  let contactCount = 0;
  for (const comp of companies) {
    const newCompanyId = companyIdMap.get(comp.id);
    if (!newCompanyId) continue;
    for (const contact of comp.contacts) {
      await targetPrisma.partnerContact.create({
        data: {
          partnerCompanyId: newCompanyId,
          contactName: contact.contactName,
          phone: contact.phone ?? undefined,
          email: contact.email ?? undefined,
          role: contact.role ?? undefined,
        },
      });
      contactCount++;
    }
  }
  console.log('  Kreirano kontakata: ' + contactCount);

  console.log("\nMigracija zavrsena.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await sourcePrisma.$disconnect();
    await targetPrisma.$disconnect();
  });
