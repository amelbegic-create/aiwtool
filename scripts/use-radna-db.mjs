#!/usr/bin/env node
/**
 * Postavlja DATABASE_URL i DIRECT_URL u .env na RADNA vrijednosti (radna/test baza za lokalni dev).
 * Pokretanje: node scripts/use-radna-db.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
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

const radnaDb = env.RADNA_DATABASE_URL;
const radnaDirect = env.RADNA_DIRECT_URL;

if (!radnaDb) {
  console.error("RADNA_DATABASE_URL nije postavljen u .env. Dodaj ga (connection string za radnu/test bazu), pa ponovno pokreni ovu skriptu.");
  process.exit(1);
}

const lines = envContent.split("\n");
let hasDatabaseUrl = false;
let hasDirectUrl = false;
const newLines = lines.map((line) => {
  if (line.match(/^\s*DATABASE_URL\s*=/)) {
    hasDatabaseUrl = true;
    return `DATABASE_URL=${radnaDb}`;
  }
  if (line.match(/^\s*DIRECT_URL\s*=/)) {
    hasDirectUrl = true;
    return `DIRECT_URL=${radnaDirect ?? radnaDb}`;
  }
  return line;
});

if (!hasDatabaseUrl) {
  newLines.push("", `DATABASE_URL=${radnaDb}`);
}
if (!hasDirectUrl) {
  newLines.push(`DIRECT_URL=${radnaDirect ?? radnaDb}`);
}

writeFileSync(envPath, newLines.join("\n"), "utf-8");
console.log("DATABASE_URL i DIRECT_URL postavljeni na RADNA bazu. Lokalni dev sada koristi radnu bazu.");
