-- AlterTable: CL month lock / unlock request / edit grant
ALTER TABLE "LaborReport" ADD COLUMN IF NOT EXISTS "clLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LaborReport" ADD COLUMN IF NOT EXISTS "clLockedAt" TIMESTAMP(3);
ALTER TABLE "LaborReport" ADD COLUMN IF NOT EXISTS "clLockedByUserId" TEXT;
ALTER TABLE "LaborReport" ADD COLUMN IF NOT EXISTS "clUnlockRequestedAt" TIMESTAMP(3);
ALTER TABLE "LaborReport" ADD COLUMN IF NOT EXISTS "clUnlockRequestedByUserId" TEXT;
ALTER TABLE "LaborReport" ADD COLUMN IF NOT EXISTS "clEditGrantUserId" TEXT;
ALTER TABLE "LaborReport" ADD COLUMN IF NOT EXISTS "clEditGrantUntil" TIMESTAMP(3);
ALTER TABLE "LaborReport" ADD COLUMN IF NOT EXISTS "clUnlockRequestNote" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LaborReport_clLockedByUserId_fkey') THEN
    ALTER TABLE "LaborReport" ADD CONSTRAINT "LaborReport_clLockedByUserId_fkey"
      FOREIGN KEY ("clLockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LaborReport_clUnlockRequestedByUserId_fkey') THEN
    ALTER TABLE "LaborReport" ADD CONSTRAINT "LaborReport_clUnlockRequestedByUserId_fkey"
      FOREIGN KEY ("clUnlockRequestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LaborReport_clEditGrantUserId_fkey') THEN
    ALTER TABLE "LaborReport" ADD CONSTRAINT "LaborReport_clEditGrantUserId_fkey"
      FOREIGN KEY ("clEditGrantUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "LaborReport_clLocked_idx" ON "LaborReport"("clLocked");
CREATE INDEX IF NOT EXISTS "LaborReport_clUnlockRequestedAt_idx" ON "LaborReport"("clUnlockRequestedAt");
