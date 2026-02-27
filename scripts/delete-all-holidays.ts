/**
 * Briše sve praznike (Holiday) iz baze.
 * Pokreni s LIVE DATABASE_URL u .env: npx tsx scripts/delete-all-holidays.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.holiday.deleteMany({});
  console.log(`Obrisano praznika: ${result.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
