# Vercel Environment Variables – Postavke za aiw.services

Dodaj ove varijable u **Vercel → Project → Settings → Environment Variables** za **Production**:

| # | Name | Gdje uzeti vrijednost |
|---|------|------------------------|
| 1 | `DATABASE_URL` | Iz tvog `.env` – redak s `ep-red-mouse-ageu9eif-pooler` (LIVE pooler) |
| 2 | `DIRECT_URL` | Iz tvog `.env` – redak s `ep-red-mouse-ageu9eif` **bez** `-pooler` (LIVE direct) |
| 3 | `NEXTAUTH_SECRET` | Iz tvog `.env` – ista vrijednost |
| 4 | `NEXTAUTH_URL` | **Uvijek:** `https://www.aiw.services` (ne localhost!) |
| 5 | `BLOB_READ_WRITE_TOKEN` | Iz tvog `.env` |
| 6 | `RESEND_API_KEY` | Iz tvog `.env` |

**Nakon dodavanja:** Deployments → Redeploy zadnjeg deploya.
