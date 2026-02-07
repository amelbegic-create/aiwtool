# Vercel – Login i env varijable

Da bi **login radio na Vercelu** (posebno s custom domenom **aiw.services**), u Vercel projektu postavite:

## Obavezno

1. **Settings → Environment Variables**
2. Dodajte:
   - **`NEXTAUTH_URL`** = točan URL vaše stranice  
     - Ako koristite **aiw.services**: `https://aiw.services` ili `https://www.aiw.services` (onako kako korisnici ulaze, **bez** `/` na kraju).
     - Ako koristite samo Vercel URL (*.vercel.app), možete ostaviti prazno – aplikacija koristi `VERCEL_URL` kao fallback.
   - **`NEXTAUTH_SECRET`** = isti secret kao lokalno (npr. dugi random string, min. 32 znaka).
   - **`DATABASE_URL`** = connection string za bazu (Production).

3. **Redeploy** nakon promjene env varijabli (Deployments → ... → Redeploy).

## Zašto login ne radi bez ovoga?

Ako **NEXTAUTH_URL** nije točan ili nedostaje za custom domenu, cookie sesije se postavlja za krivu domenu. Nakon prijave, sljedeći zahtjev (npr. na `/dashboard`) ne šalje cookie, pa middleware preusmjeri natrag na `/login`.
