# Deploy na Vercel

Kod je na GitHubu: **https://github.com/amelbegic-create/aiwtool**

## 1. Poveži repo s Vercelom

1. Idi na [vercel.com](https://vercel.com) i uloguj se.
2. **Add New** → **Project** → **Import Git Repository**.
3. Odaberi `amelbegic-create/aiwtool` (ili fork).
4. **Framework Preset**: Next.js (auto-detektovan).
5. **Root Directory**: `./` (ostavi prazno ili `.`).
6. **Build Command**: ostavi prazno (koristi se `vercel.json`: `prisma generate && next build`).
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

- Klikni **Deploy**. Vercel će pokrenuti `prisma generate && next build` i `next start`.
- Nakon prvog deploya provjeri **Functions** i **Logs** ako nešto pukne.

## 4. Prva migracija baze (ako treba)

Ako je baza prazna ili treba migracije:

- Lokalno: postavi `DATABASE_URL` i `DIRECT_URL` na produkcijsku bazu, pa:
  ```bash
  npx prisma db push
  ```
- Ili koristi Neon SQL Editor za pokretanje migracija.

---

Sve je spremno za rad kao na lokalnom serveru nakon postavljanja env varijabli.
