-- Sitzplan: više PDF-ova po restoranu (PostgreSQL)
-- Pokreni: npx prisma migrate deploy

ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "sitzplanPdfUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "sitzplanPdfNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
