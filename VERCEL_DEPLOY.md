# Deploy na Vercel

Kod je na GitHubu: **https://github.com/amelbegic-create/aiwtool**

## 0. Sigurnost (connection string)

- **Nikad** ne dijeliti `DATABASE_URL` / lozinke u chatu, ticketima ili skrinšotima.
- Ako je string procurio: u **Neon** rotiraj lozinku / kreiraj novi connection string, pa u **Vercel → Settings → Environment Variables** ažuriraj `DATABASE_URL` i `DIRECT_URL` za Production (i Preview ako treba).

## 1. Poveži repo s Vercelom

1. Idi na [vercel.com](https://vercel.com) i uloguj se.
2. **Add New** → **Project** → **Import Git Repository**.
3. Odaberi `amelbegic-create/aiwtool` (ili fork).
4. **Framework Preset**: Next.js (auto-detektovan).
5. **Root Directory**: `./` (ostavi prazno ili `.`).
6. **Build Command**: ostavi prazno (koristi se [`vercel.json`](vercel.json): `prisma generate && prisma db push --accept-data-loss && next build` – `db push` usklađuje shemu s produkcijskom bazom iz Vercel env-a).
7. **Output Directory**: ostavi prazno.

## 2. Environment Variables (obavezno)

U **Project Settings → Environment Variables** dodaj za **Production** (i po želji Preview):

| Variable | Opis | Primjer |
|----------|------|--------|
| `DATABASE_URL` | PostgreSQL connection string (Neon pooler) | `postgresql://user:pass@host/neondb?sslmode=require` |
| `DIRECT_URL` | Direct connection (Neon, bez -pooler) | `postgresql://user:pass@host/neondb?sslmode=require` |
| `NEXTAUTH_URL` | **Točan URL aplikacije** (bez / na kraju) | `https://tvoj-projekt.vercel.app` |
| `NEXTAUTH_SECRET` | Tajna za sesije (min. 32 znaka) | generiši: `openssl rand -base64 32` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (potpisi, uploadi) | iz Vercel dashboard → Storage → Blob |
| `RESEND_API_KEY` | Za e-mail (opcionalno) | iz resend.com |

**Važno:** `NEXTAUTH_URL` mora biti točno onaj URL na kojem korisnici pristupaju (npr. `https://aiwtool.vercel.app`). Inače cookie sesije neće raditi.

## 3. Deploy

- Push na povezanu granu ili **Deploy** u Vercel dashboardu. Build pokreće `prisma generate && prisma db push --accept-data-loss && next build` (vidi `vercel.json`), zatim `next start`.
- **`--accept-data-loss`:** Prisma zahtijeva ovaj flag kad bi sinkronizacija sheme mogla ukloniti kolone/tablice ili drastično promijeniti tipove (npr. nakon IAM / enum promjena). Pri većim releaseovima napravi **Neon branch backup** ili snapshot prije deploya. Ako u logu vidiš neočekivano brisanje, prvo uskladi bazu ručno (migracije / SQL), ne deployaj slijepo.
- U **Build Logs** provjeri da `prisma db push` prođe; ako padne, aplikacija se ne deploya do kraja.
- **Nakon deploya (IAM):** jednokratno na **LIVE** bazi (privremeno postavi `DATABASE_URL`/`DIRECT_URL` u shellu ili koristi samo za tu naredbu):

  ```bash
  npx tsx prisma/backfill-iam-permissions.ts
  ```

  Time se novi permission ključevi (npr. `dashboard_news:manage`) spajaju u `User.permissions` za ADMIN/MANAGER/sve korisnike prema logici skripte. **Ne pokretaj** `npm run` seed na produkciji osim ako namjerno želiš seed podatke.

## 3b. Smoke test (produkcija)

- Login, `/dashboard`, `/admin`, moduli ovisni o novim dozvolama.
- Ako admin nema novi modul: provjeri backfill iz koraka 3.

## 4. Prva migracija baze (ako treba)

Ako je baza prazna ili treba migracije:

- Lokalno: postavi `DATABASE_URL` i `DIRECT_URL` na produkcijsku bazu, pa:
  ```bash
  npx prisma db push
  ```
- Ili koristi Neon SQL Editor za pokretanje migracija.

## 5. Greška: "CalendarEvent does not exist" / dashboard ne radi

Ako nakon deploya dashboard baci grešku tipa **`The table public.CalendarEvent does not exist`**, LIVE baza nije usklađena sa shemom. Treba jednom pokrenuti sinkronizaciju **prema LIVE bazi**:

**Opcija A (preporučeno)** – u `.env` dodaj `LIVE_DATABASE_URL` (i po želji `LIVE_DIRECT_URL`) s connection stringom za **produkcijsku** bazu, zatim u rootu projekta:

```bash
node scripts/push-live-db.mjs
```

**Opcija B** – u `.env` privremeno prepiši `DATABASE_URL` i `DIRECT_URL` na vrijednosti produkcijske baze, pa:

```bash
npx prisma db push
```

Zatim vrati `DATABASE_URL` i `DIRECT_URL` na RADNA vrijednosti. Nakon toga Vercel aplikacija (koja već koristi produkcijsku bazu preko env varijabli) će raditi bez promjene koda.

---

Sve je spremno za rad kao na lokalnom serveru nakon postavljanja env varijabli.
