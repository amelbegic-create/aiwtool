-- Schulungen: Programme, Termine, Teilnehmer
CREATE TABLE IF NOT EXISTS "TrainingProgram" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrainingSession" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "title" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrainingParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TrainingProgram_sortOrder_idx" ON "TrainingProgram"("sortOrder");
CREATE INDEX IF NOT EXISTS "TrainingProgram_isActive_idx" ON "TrainingProgram"("isActive");

CREATE INDEX IF NOT EXISTS "TrainingSession_programId_idx" ON "TrainingSession"("programId");
CREATE INDEX IF NOT EXISTS "TrainingSession_programId_sortOrder_idx" ON "TrainingSession"("programId", "sortOrder");
CREATE INDEX IF NOT EXISTS "TrainingSession_startsAt_idx" ON "TrainingSession"("startsAt");

CREATE INDEX IF NOT EXISTS "TrainingParticipant_sessionId_idx" ON "TrainingParticipant"("sessionId");
CREATE INDEX IF NOT EXISTS "TrainingParticipant_userId_idx" ON "TrainingParticipant"("userId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingSession_programId_fkey') THEN
    ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_programId_fkey"
      FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingParticipant_sessionId_fkey') THEN
    ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingParticipant_userId_fkey') THEN
    ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
