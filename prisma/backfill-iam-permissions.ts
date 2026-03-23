/**
 * Jednokratno nakon migracije enum-a: spaja ALL_PERMISSION_KEYS + implicit u permissions[] za ADMIN,
 * i default manager set za MANAGER. Pokreni: npx tsx prisma/backfill-iam-permissions.ts
 */
import { PrismaClient } from "@prisma/client";
import { ALL_PERMISSION_KEYS } from "../lib/permissions";
import {
  buildDefaultManagerPermissionSet,
  buildFullAdminPermissionSet,
  IMPLICIT_LOGIN_PERMISSION_KEYS,
} from "../lib/defaultPermissions";

const prisma = new PrismaClient();

function mergeKeys(existing: string[], add: string[]) {
  return [...new Set([...(existing || []), ...add])];
}

export async function runIamPermissionBackfill() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, permissions: true },
  });
  const full = buildFullAdminPermissionSet();
  for (const u of admins) {
    await prisma.user.update({
      where: { id: u.id },
      data: { permissions: mergeKeys(u.permissions || [], full) },
    });
  }

  const managers = await prisma.user.findMany({
    where: { role: "MANAGER" },
    select: { id: true, permissions: true },
  });
  const mgr = buildDefaultManagerPermissionSet();
  for (const u of managers) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        permissions: mergeKeys(mergeKeys(u.permissions || [], [...IMPLICIT_LOGIN_PERMISSION_KEYS]), mgr),
      },
    });
  }

  const everyone = await prisma.user.findMany({ select: { id: true, permissions: true } });
  for (const u of everyone) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        permissions: mergeKeys(u.permissions || [], [...IMPLICIT_LOGIN_PERMISSION_KEYS]),
      },
    });
  }

  console.log("Backfill done. ALL_PERMISSION_KEYS count:", ALL_PERMISSION_KEYS.length);
}

/** CLI: `npx tsx prisma/backfill-iam-permissions.ts` (koristi DATABASE_URL iz okoline / .env) */
const ranAsCli = process.argv.some((a) => a.replace(/\\/g, "/").includes("backfill-iam-permissions"));
if (ranAsCli) {
  runIamPermissionBackfill()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
