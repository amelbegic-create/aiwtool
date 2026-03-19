# Tehnička dokumentacija – mcdtoolat / aiwtool

## 1. Pregled

Aplikacija je interni alat (Next.js) za upravljanje restoranima, osobljem, godišnjim odmorima, partnerima, pravilima, predlošcima, posjetama, produktivnošću i sl. Jezik sučelja: austrijski njemački. Baza: PostgreSQL (Neon). Hosting: Vercel. Autentifikacija: NextAuth (credentials).

---

## 2. Tehnologije

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS 4
- **Backend:** Next.js API routes + Server Actions
- **Baza:** PostgreSQL (Neon), Prisma ORM
- **Auth:** NextAuth 4 (credentials, session)
- **Storage:** Vercel Blob (dokumenti, slike, potpisi, uploadi)
- **Email (opcionalno):** Resend

---

## 3. Struktura projekta (relevantno)

- `app/` – App Router: stranice, layouti, API
- `app/dashboard/` – početna stranica s karticama (Todo, Kalendar, itd.)
- `app/tools/` – korisnički moduli (alati)
- `app/admin/` – admin panel (partneri, korisnici, restorani, besuchsberichte, itd.)
- `app/team/` – „Mein Team“
- `lib/` – prisma, auth, access (permissions), tools-config
- `components/` – dijeljeni UI (npr. dashboard kartice)
- `prisma/` – schema, migracije
- `scripts/` – push-live-db.mjs, use-radna-db.mjs, itd.

---

## 4. Baza podataka

- **RADNA (dev):** lokalni razvoj koristi `DATABASE_URL` i `DIRECT_URL` (iz `.env`) – obično postavljeno na test/radnu bazu.
- **LIVE (produkcija):** Vercel koristi svoje env varijable; lokalno za migracije koriste se `LIVE_DATABASE_URL` i `LIVE_DIRECT_URL` u `.env`.
- **Skripte:**
  - `node scripts/use-radna-db.mjs` – postavlja `.env` na RADNA bazu (koristi `RADNA_DATABASE_URL` / `RADNA_DIRECT_URL`).
  - `node scripts/push-live-db.mjs` – izvršava `prisma db push` prema LIVE bazi (čita `LIVE_DATABASE_URL` / `LIVE_DIRECT_URL`; ne mijenja `DATABASE_URL` u `.env`).
- Na Vercel buildu u `vercel.json` stoji: `prisma generate && prisma db push && next build` – shema se na deployu primjenjuje na bazu iz Vercel `DATABASE_URL`.

---

## 5. Autentifikacija i dozvole

- **Login:** credentials (email + lozinka), session cookie.
- **Dozvole:** uloga (role) + niz permisija (permissions) u bazi; provjera u `lib/access.ts`.
- **Funkcije:** `getDbUserForAccess()`, `hasPermission()`, `requirePermission()`, `tryRequirePermission()`.
- Neki moduli su dostupni svim prijavljenima (npr. `partners:access`, `todo:access`, `vorlagen:access`, `besuchsberichte:access`); drugi zahtijevaju posebnu permisiju ili ulogu (npr. Admin/Manager za `partners:manage`, `rules:*`).

---

## 6. Moduli (Tools) – korisnički prikaz

Konfiguracija alata: `lib/tools/tools-config.ts` (APP_TOOLS, TOOL_CATEGORIES, TOOL_PERMISSION).

| Modul | Putanja | Permisija | Opis |
|-------|---------|-----------|------|
| **Firmen und Partner** | `/tools/partners` | `partners:access` | Lista partnera/firmi; detalj partnera: opis, galerija, **dokumenti** (lista + popup), **Webseite**, Preisliste (PDF), kontakt. |
| **Bedienungsanleitungen** | `/tools/rules` | `rules:access` | Pravila / upute; pregled i otvaranje PDF-ova. |
| **Sitzplan & Layout** | `/tools/sitzplan` | – | Sitzplan i layout restorana. |
| **Vorlagen** | `/tools/vorlagen` | `vorlagen:access` | Predlošci po kategorijama. |
| **Besuchsberichte** | `/tools/besuchsberichte` | `besuchsberichte:access` | Kategorije posjeta (po restoranu ili svi); pregled i upload izvještaja (PDF, slike, Word, Excel itd.). |
| **Urlaubsplanung** | `/tools/vacations` | `vacation:access` | Godišnji odmor: zahtjevi, pregledi, plan, tabela, odjeli, globalni pregled. |
| **Mein Kalender** | `/tools/calendar` | `vacation:access` | Kalendar događaja. |
| **PDS (Beurteilung)** | `/tools/PDS` | `pds:access` | PDS evaluacije. |
| **Mein Team** | `/team` | – | Struktura tima. |
| **Zertifikate** | `/tools/certificates` | – | Zertifikate. |
| **Prämien & Bonus** | `/tools/bonusi` | `bonus:access` | Bonusi i prämien. |
| **CL (Personaleinsatzplanung)** | `/tools/labor-planner` | `labor:access` | Planiranje osoblja. |
| **Produktivität** | `/tools/productivity` | `productivity:access` | Produktivnost. |
| **Restaurants** | `/tools/restaurants` | – | Pregled restorana. |
| **Categories** | `/tools/categories/[id]` | – | Kategorije (ovisno o kontekstu). |

---

## 7. Partner modul – detalji (ažurirano)

- **Lista:** `/tools/partners` – lista firmi, kategorije, pretraga.
- **Detalj partnera:** `/tools/partners/[id]` – server dohvaća partnera s dokumentima (`getPartnerForDetail(id)`); klijent prikazuje:
  - Header: logo, naziv firme, kategorija.
  - **Beschreibung**, interne Notizen.
  - **Galerie** – slike (karusel).
  - Sidebar: **Kontakt**, **Webseite** (ako je unesen), **Preisliste** (PDF, popup), **Dokumente** (lista uploadanih dokumenata – PDF, Excel, Word, itd.).
- **Dokumenti:** Klik na dokument otvara **popup na istoj stranici**: PDF/slike u iframe-u, ostali tipovi – poruka i link „Herunterladen“.
- **Admin:** Dodavanje/uređivanje partnera, upload više dokumenata (Dokumente) i galerija slika (Galerie-Bilder), unos web sajta (Webseite), Preisliste PDF.

---

## 8. Dashboard

- **Stranica:** `app/dashboard/page.tsx` – kartice na početku (npr. Todo, Kalendar).
- **Komponente:** npr. `DashboardTodoCard`, `DashboardCalendarCard` – ograničen broj stavki, „Mehr anzeigen“, stilovi u skladu s ostatkom aplikacije.

---

## 9. Admin panel

- **Pristup:** `/admin` – za korisnike s odgovarajućim permisijama (npr. `users:access` za korisnike).
- **Sekcije (primjeri):**
  - Partneri: lista, nova firma, uređivanje, kategorije partnera; forma: višestruki dokumenti, galerija, web sajt, Preisliste.
  - Besuchsberichte: kategorije (jedan / svi restorani), godine, DnD redoslijed, upload/zamjena fajlova.
  - Korisnici, restorani, praznici (holidays), ideenbox, vorlagen, itd.

---

## 10. Deploy (Vercel)

- **Repo:** GitHub (npr. `amelbegic-create/aiwtool`); Vercel povezan na repo, build iz `vercel.json`: `prisma generate && prisma db push && next build`.
- **Env varijable (Production):** `DATABASE_URL`, `DIRECT_URL` (LIVE baza), `NEXTAUTH_URL` (točan production URL), `NEXTAUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`; po potrebi `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- **Preporuka:** Prije pusha na main pokrenuti lokalno `node scripts/push-live-db.mjs` (uz postavljen `LIVE_DATABASE_URL` u `.env`) da LIVE baza ima ažurnu shemu; zatim push i deploy.

Detaljniji koraci: `VERCEL_DEPLOY.md`, `VERCEL.md`, `VERCEL_ENV_SETUP.md`.

---

## 11. Važne datoteke (izbor)

- **Konfiguracija alata:** `lib/tools/tools-config.ts`
- **Dozvole:** `lib/access.ts`
- **Partner – akcije:** `app/actions/partnerActions.ts` (getPartners, getPartnerForDetail, CRUD, uploadi)
- **Partner – detalj (klijent):** `app/tools/partners/[id]/PartnerDetailClient.tsx`
- **Partner – detalj (server):** `app/tools/partners/[id]/page.tsx`
- **Shema baze:** `prisma/schema.prisma` (npr. PartnerCompany, PartnerCompanyDocument, PartnerContact)
