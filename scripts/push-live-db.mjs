#!/usr/bin/env node
/**
 * Pokreće prisma db push na LIVE bazu koristeći LIVE_DATABASE_URL i LIVE_DIRECT_URL iz .env.
 * Ne mijenja .env – koristi te vrijednosti samo za ovu naredbu.
 * Pokretanje: node scripts/push-live-db.mjs
 */

import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

function parseEnv(content) {
  const out = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1).replace(/\\(.)/g, "$1");
    }
    out[key] = val;
  }
  return out;
}

if (!existsSync(envPath)) {
  console.error("Datoteka .env nije pronađena u korijenu projekta.");
  process.exit(1);
}

const envContent = readFileSync(envPath, "utf-8");
const env = parseEnv(envContent);

const liveDb = env.LIVE_DATABASE_URL;
const liveDirect = env.LIVE_DIRECT_URL;

if (!liveDb) {
  console.error("LIVE_DATABASE_URL nije postavljen u .env. Postavi ga ili privremeno prepiši DATABASE_URL na LIVE i pokreni: npx prisma db push");
  process.exit(1);
}

console.log("Prisma db push prema LIVE bazi (LIVE_DATABASE_URL iz .env)...\n");

const runEnv = { ...process.env, DATABASE_URL: liveDb };
if (liveDirect) runEnv.DIRECT_URL = liveDirect;

try {
  execSync("npx prisma db push --schema prisma/schema.prisma", {
    cwd: root,
    stdio: "inherit",
    env: runEnv,
  });
  console.log("\nLIVE baza ažurirana.");
} catch (e) {
  process.exit(e.status ?? 1);
}
