This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Baza podataka: RADNA vs LIVE (lokalno)

Lokalni `.env` koristi varijable:

- `DATABASE_URL` – trenutno postavljeno na **RADNA** bazu (test okolina).
- `DIRECT_URL` – direct connection za istu RADNA bazu (za Prisma migracije lokalno).

U istom `.env` postoje i reference na produkcijsku (LIVE) bazu:

- `LIVE_DATABASE_URL`
- `LIVE_DIRECT_URL`

Za **lokalno prebacivanje** između RADNA i LIVE baze:

1. **Na RADNA (razvoj):** u `.env` postavi `RADNA_DATABASE_URL` i `RADNA_DIRECT_URL` (connection stringovi za radnu bazu), zatim pokreni `node scripts/use-radna-db.mjs` – skripta prepisuje `DATABASE_URL` i `DIRECT_URL` u `.env` na te vrijednosti. Ili ručno neka `DATABASE_URL` i `DIRECT_URL` budu jednaki `RADNA_DATABASE_URL` i `RADNA_DIRECT_URL`.
2. Za kratko spajanje na LIVE (npr. migracija): ručno kopirati vrijednosti iz `LIVE_DATABASE_URL` / `LIVE_DIRECT_URL` u `DATABASE_URL` / `DIRECT_URL`, odraditi posao, zatim pokrenuti `node scripts/use-radna-db.mjs` da se **vrati** na RADNA.

Napomena: Vercel koristi svoje env varijable postavljene u **Project Settings → Environment Variables** (vidi `VERCEL.md` / `VERCEL_DEPLOY.md`), tako da promjene lokalnog `.env` ne utječu na produkcijsku bazu.

### Dashboard-News (IAM)

- Nova dozvola: **`dashboard_news:manage`** – pristup `/admin/dashboard-news` i upravljanje sliderom na početnoj.
- **`BLOB_READ_WRITE_TOKEN`** (Vercel Blob) potreban za upload naslovne slike i priloga u adminu.
- Postojeći korisnici s ulogom **ADMIN** i ručno ograničenim `permissions[]`: nakon dodavanja ključeva u kod, pokreni **`npx tsx prisma/backfill-iam-permissions.ts`** da se u polje spoje svi trenutni `ALL_PERMISSION_KEYS` (uključujući `dashboard_news:manage`). Seed već poziva isti backfill logiku kroz `runIamPermissionBackfill()`.

### Prisma migracije, P3018 / P2022, Sitzplan

Projekat koristi i **startup `instrumentation.ts`** (idempotentni SQL) i **`prisma migrate`**. Ako `migrate deploy` padne ili aplikacija javi nedostajuću kolonu npr. za Sitzplan, vidi **[docs/DATABASE.md](docs/DATABASE.md)** (oporavak P3018, `sitzplanPdfsData`, `migrate resolve`).
