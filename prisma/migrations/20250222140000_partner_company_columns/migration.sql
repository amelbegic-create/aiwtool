-- PartnerCompany: add missing columns
ALTER TABLE "PartnerCompany" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT;
ALTER TABLE "PartnerCompany" ADD COLUMN IF NOT EXISTS "priceListPdfUrl" TEXT;
ALTER TABLE "PartnerCompany" ADD COLUMN IF NOT EXISTS "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
