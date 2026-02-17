-- Add areaManagerId to Restaurant (Area Manager für Organigramm)
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "areaManagerId" TEXT;

-- Add FK if column was added (Prisma relation RestaurantAreaManager)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Restaurant_areaManagerId_fkey'
  ) THEN
    ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_areaManagerId_fkey"
      FOREIGN KEY ("areaManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
