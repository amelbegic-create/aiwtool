# Scripts

## Import partnera (Firmenliste)

Jednokratni import liste firmi u modul Firme i partneri.

**Preduvjeti:**
- `npx prisma generate` (već izvršeno pri buildu)
- Baza dostupna (`.env` s `DATABASE_URL`)

**Pokretanje (standardni import – koristi `scripts/firmenliste-import.json`):**
```bash
npm run import-partners
```

**S vlastitom JSON datotekom** (npr. u drugom folderu):
```bash
npx tsx scripts/import-partners.ts "C:\putanja\do\moj-import.json"
```
*(Bez argumenta uvijek se koristi `scripts/firmenliste-import.json`.)*

Skripta kreira nedostajuće kategorije i sve firme s kontaktima; firme s istim `companyName` se preskaču (bez duplikata).
