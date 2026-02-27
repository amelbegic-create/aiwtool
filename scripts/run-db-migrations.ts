/**
 * Pokreće migracije za Idea (imageUrls), LaborReport (unique), PartnerCompany (websiteUrl, itd.).
 * Koristi DATABASE_URL iz .env.
 *
 * Za RADNU bazu: npx tsx scripts/run-db-migrations.ts
 * Za LIVE bazu: postavite DATABASE_URL na produkcijsku bazu u .env, zatim:
 *   npx tsx scripts/run-db-migrations.ts
 */
import { execSync } from "child_process";
import path from "path";

const root = path.resolve(__dirname, "..");

const migrations = [
  "prisma/migrations/20250222130000_idea_image_urls/migration.sql",
  "prisma/migrations/20250222120000_labor_report_unique/migration.sql",
  "prisma/migrations/20250222140000_partner_company_columns/migration.sql",
];

console.log("Running migrations...");
for (const m of migrations) {
  const file = path.join(root, m);
  console.log(`  - ${m}`);
  execSync(`npx prisma db execute --file "${file}" --schema prisma/schema.prisma`, {
    cwd: root,
    stdio: "inherit",
  });
}
console.log("Running prisma db push...");
execSync("npx prisma db push --schema prisma/schema.prisma", {
  cwd: root,
  stdio: "inherit",
});
console.log("Done.");
