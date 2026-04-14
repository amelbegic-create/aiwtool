-- Schulungen: Excel-artige Felder (Programm + Teilnehmer)
ALTER TABLE "TrainingProgram" ADD COLUMN IF NOT EXISTS "topics" TEXT;
ALTER TABLE "TrainingProgram" ADD COLUMN IF NOT EXISTS "prerequisites" TEXT;
ALTER TABLE "TrainingProgram" ADD COLUMN IF NOT EXISTS "scheduleMeta" TEXT;

ALTER TABLE "TrainingParticipant" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TrainingParticipant" ADD COLUMN IF NOT EXISTS "badgeCode" TEXT;

CREATE INDEX IF NOT EXISTS "TrainingParticipant_sessionId_displayOrder_idx" ON "TrainingParticipant"("sessionId", "displayOrder");
