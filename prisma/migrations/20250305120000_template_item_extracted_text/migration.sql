-- Vorlagen: pun tekst iz PDF-a za pretragu
ALTER TABLE "TemplateItem" ADD COLUMN IF NOT EXISTS "extractedText" TEXT;
