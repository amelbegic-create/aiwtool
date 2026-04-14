# Modul Training – korisnički vodič

Ovaj dokument opisuje kako u aplikaciji koristiti **Training**: javni raspored (`/training`), administraciju (`/admin/training`), predloške (Vorlagen), restoran, te ocjenjivanje polaznika i obavještenja.

## Tko što smije

- **Javni pregled** (`/training`): dostupan prijavljenim korisnicima i gostima (ako je postavljeno zajedničko lozinka u okruženju – vidi `.env.example`, `TRAINING_GUEST_PASSWORD`).
- **Upravljanje** (programi, termini, polaznici, ocjene): korisnici s dozvolom **`training:manage`** (postavlja se u administraciji korisnika / IAM).

## Standardni predlošci (8 Vorlagen)

U bazi postoji osam fiksnih predložaka (npr. Crewtrainer Service, FoodSafety NEU, …). Oni slže kao **polazna točka** za naslove, polje „Inhalte / Themen“ i „Voraussetzungen“.

- Predlošci se učitavaju u bazu putem **`prisma/seed`** (ili ručnim unosom u tablici `TrainingTemplate`).
- U obrascu **Novo / Uredi program** možete iz padajućeg izbornika odabrati **Standard-Vorlage**. Prazna polja za teme i preduvjete tada se mogu automatski popuniti iz predloška (možete ih i dalje ručno mijenjati).

## Restoran (obavezno)

Pri **stvaranju i uređivanju** programa morate odabrati **restoran** iz liste aktivnih restorana u sustavu. To povezuje program s lokacijom i koristi se za **filtar obavještenja** (vidi dolje).

## Termini i polaznici

1. Na kartici programa kliknite **Termine**.
2. Dodajte termin (datum, opcionalno naslov, mjesto, bilješke).
3. Polaznike dodajte:
   - pretragom korisnika (min. 2 znaka), ili
   - brzim unosom jednog retka (npr. `Ime PREZIME (#156)` za broj značke).

## Ocjena polaznika (Bewertung)

Za svakog polaznika u terminu možete unijeti:

- **Komentar** (tekst),
- **Rezultat u postocima** (cijeli broj **0–100**).

Potrebno je unijeti **barem jedno** od toga (komentar ili postotak). Pritiskom na **Speichern** zapisuje se ocjena, vrijeme i **tko je ocijenio** (prijavljeni trener / administrator).

## In-app obavještenja

Nakon spremljene ocjene, obavještenje u zvončiću mogu vidjeti (unutar zadnjih ~14 dana):

1. **Nadređeni polaznika** (`supervisor` na korisničkom profilu), ako je polaznik vezan na korisnika u sustavu i ima nadređenog.
2. **Korisnici s `training:manage` koji su u tom restoranu** (povezanost putem `RestaurantUser` za restoran programa).
3. **Lars**: ako je u `.env` postavljen `TRAINING_LARS_USER_ID`, koristi se taj korisnik; inače se traži korisnik s e-mailom `lars.hoffmann@aiw.at` (npr. iz seeda).
4. **Osoba koja je ocijenila** (ocijenitelj).

Ako program **nema** restoran, obavještenja po restoranu (točka 2) se ne šalju na taj način – zato uvijek postavite restoran za nove programe.

## Javni prikaz

Stranica `/training` prikazuje aktivne programe i njihove termine. Polja za ocjenu i interne komentare **nisu** javna.

## Okolišne varijable (sažetak)

| Varijabla | Značenje |
|-----------|----------|
| `TRAINING_GUEST_PASSWORD` | Zajedničko lozinka za gost pristup `/training` u produkciji. |
| `TRAINING_LARS_USER_ID` | Opcionalno: eksplicitni user ID za Lars u obavještenjima. |

Za detalje kopirajte `.env.example` u `.env` i prilagodite vrijednosti.
