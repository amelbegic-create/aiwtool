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

---

## Import CL “Monat PDF” exporta (labor-planner)

Za bulk unos podataka direktno iz CL modula koristite privremeni gumb **`Import PDF`** u modulu **`CL (Personaleinsatzplanung)`**.

### Što trebaš
- PDF-ovi moraju biti naši exporti tipa **`Monat PDF`** iz `labor-planner` tabele (1 fajl = 1 mjesec).
- PDF-ovi trebaju imati “selectable text” (ne sken) da bi parser mogao pročitati tabelu i `STORE / MONAT / Jahr`.

### Koraci u sučelju
1. Uloguj se.
2. Otvori `/tools/labor-planner`.
3. Klikni **`Import PDF`**.
4. U prozoru:
   - upiši **STORE Code** (fallback; parser pokušava automatski iz PDF-a)
   - odaberi **Monat** i **Jahr** (fallback)
   - uploaduj jedan ili više PDF-ova
5. Klikni **`Import starten`**.

### Verifikacija
- Nakon import-a treba se automatski osvježiti prikaz za RESTAURANT/MONAT/Jahr koji si odabrao u modalu.

### Napomena (privremeno)
- Ovo je privremeni UI/API. Nakon što završiš uvoz, ukloni gumb i API rutu iz koda.
