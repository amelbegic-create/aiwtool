-- Add SHIFT_LEADER to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SHIFT_LEADER';

-- Add areaManagerId to Restaurant
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "areaManagerId" TEXT;

-- FK for Area Manager (add only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Restaurant_areaManagerId_fkey'
  ) THEN
    ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_areaManagerId_fkey"
      FOREIGN KEY ("areaManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
