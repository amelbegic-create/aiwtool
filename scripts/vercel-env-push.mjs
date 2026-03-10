#!/usr/bin/env node
/**
 * Šalje env varijable iz lokalnog .env na Vercel (Production).
 * Preduvjet: npx vercel link (ili vercel link) i prijava na Vercel.
 * Pokretanje: node scripts/vercel-env-push.mjs
 */

import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const PRODUCTION_URL = "https://www.aiw.services";

const VAR_NAMES = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "BLOB_READ_WRITE_TOKEN",
  "RESEND_API_KEY",
];

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

function runVercelEnvAdd(name, value) {
  try {
    execSync(`vercel env add ${name} production`, {
      input: value,
      stdio: ["pipe", "inherit", "inherit"],
      cwd: root,
    });
    console.log(`  OK: ${name}`);
  } catch (e) {
    if (e.message && e.message.includes("already exists")) {
      console.log(`  (preskočeno – ${name} već postoji; ažuriraj ručno u Vercel Dashboard ako treba)`);
    } else {
      console.error(`  GREŠKA ${name}:`, e.message || e);
    }
  }
}

if (!existsSync(envPath)) {
  console.error("Datoteka .env nije pronađena u korijenu projekta.");
  process.exit(1);
}

const envContent = readFileSync(envPath, "utf-8");
const env = parseEnv(envContent);

console.log("Slanje env varijabli na Vercel (Production)...\n");

for (const name of VAR_NAMES) {
  let value = env[name];
  if (name === "NEXTAUTH_URL" && value) {
    value = PRODUCTION_URL;
    console.log(`  NEXTAUTH_URL postavljen na ${PRODUCTION_URL} za Production.`);
  }
  if (!value) {
    console.log(`  Preskočeno: ${name} (nije u .env)`);
    continue;
  }
  runVercelEnvAdd(name, value);
}

console.log("\nGotovo. Ako neka varijabla već postoji, ažuriraj je u Vercel → Settings → Environment Variables.");
console.log("Zatim u Deployments uradi Redeploy zadnjeg deploya.");
