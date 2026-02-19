# Vercel – Login i env varijable

Da bi **login radio na Vercelu** (uključujući custom domenu **www.aiw.services**):

## Obavezno

1. **Settings → Environment Variables**
2. Dodajte:
   - **`NEXTAUTH_SECRET`** = isti secret kao lokalno (npr. dugi random string, min. 32 znaka).
   - **`DATABASE_URL`** = connection string za bazu (Production, pool URL; npr. Neon s `?connection_limit=5`).
   - **`DIRECT_URL`** = direct connection string za istu bazu (obavezno za Prisma; koristi se za migracije i neke upite).
   - **`NEXTAUTH_URL`** (preporučeno za stabilnost): točan URL na koji korisnici ulaze  
     - Za **www.aiw.services**: `https://www.aiw.services` (bez `/` na kraju).  
     - Možete ga i **ne postavljati**: uz `trustHost: true`, NextAuth koristi host iz zahtjeva (x-forwarded-host), pa cookie i redirect budu za domenu s koje korisnik dolazi. To radi i za custom domenu.

3. **Redeploy** nakon promjene env varijabli (Deployments → ... → Redeploy).

## Važno za custom domenu

- **Nemojte** postaviti `NEXTAUTH_URL` na `https://aiwtool.vercel.app` (ili drugi *.vercel.app) ako korisnici ulaze preko **www.aiw.services**. Inače se cookie postavlja za *.vercel.app, pa na www.aiw.services zahtjev nema cookie i nastaje login loop.
- Ili postavite `NEXTAUTH_URL=https://www.aiw.services`, ili ostavite `NEXTAUTH_URL` prazan i oslonite se na `trustHost` (request host).
