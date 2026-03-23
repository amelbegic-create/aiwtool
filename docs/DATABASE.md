# Baza podataka: Prisma migracije vs. instrumentation

## Dva mehanizma sheme

1. **`instrumentation.ts`** (Next.js cold start) – idempotentni SQL (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, …). Primjer: `Department`, kolona **`Restaurant.sitzplanPdfsData`** (Sitzplan modul).
2. **`prisma migrate deploy`** – primjenjuje migracije redom prema tablici `_prisma_migrations`.

Ako je baza već dio objekata dobila kroz instrumentation (ili `db push`), a migracije još nisu zabilježene kao primijenjene, `migrate deploy` može pasti s **P3018** (npr. `relation "Department" already exists`).

## Sitzplan: kolona `sitzplanPdfsData`

- Definirana u [`prisma/schema.prisma`](../prisma/schema.prisma) na modelu `Restaurant`.
- Dodaje se na bazu:
  - automatski pri **restartu dev servera** / deployu (vidi [`instrumentation.ts`](../instrumentation.ts), sekcija 4b), **ili**
  - uspješnim `npx prisma migrate deploy` kad migracije dođu do [`20250304190000_restaurant_sitzplan_pdfs_json`](../prisma/migrations/20250304190000_restaurant_sitzplan_pdfs_json/migration.sql).

Ako vidiš **P2022** (`column Restaurant.sitzplanPdfsData does not exist`), nakon pull-a promjena pokreni ponovo server (`npm run dev`) da se izvrši db-init, ili primijeni migracije.

## Besuchsberichte: `VisitReportItem.extractedText`

- Kolona za tekst iz PDF-a (pretraga samo unutar istog `restaurantId` u tools modulu).
- Migracija: [`20250307100000_visit_report_item_extracted_text`](../prisma/migrations/20250307100000_visit_report_item_extracted_text/migration.sql).
- Postojeći PDF-i prije migracije nemaju ekstrakt dok se ponovo ne uploadaju ili ručno ne popuni polje.

## Oporavak od P3018 (migracija ne može da se primijeni)

Primjer: migracija `20250201120000_add_department_model` puca jer tabela `Department` već postoji.

1. Provjeri da stanje baze odgovara onome što ta migracija radi (tabela `Department`, kolone na `User`, itd.).
2. Označi migraciju kao već primijenjenu:

   ```bash
   npx prisma migrate resolve --applied "20250201120000_add_department_model"
   ```

3. Ponovo:

   ```bash
   npx prisma migrate deploy
   ```

Ako **sljedeća** migracija opet javi „already exists“, ponovi `migrate resolve --applied "<ime_migracije>"` za tu migraciju, **ili** razmotri [Prisma baselining](https://www.prisma.io/docs/guides/migrate/developing-with-prisma-migrate/baselining) za produkciju ako je drift veliki.

**Napomena:** Nemoj mijenjati sadržaj već primijenjenih migracija (checksum); za nove izmjene uvijek dodaj novu migraciju.

## Korisne komande

```bash
npx prisma generate      # regeneriše klijent (ne mijenja Postgres)
npx prisma migrate deploy # primijeni pending migracije
npx prisma migrate status # stanje migracija
```

Više o RADNA vs LIVE varijantama vidi [README.md](../README.md) (sekcija „Baza podataka“).
