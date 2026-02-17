-- 1) RestaurantUser.supervisorInRestaurantId (per-restoran nadređeni)
ALTER TABLE "RestaurantUser" ADD COLUMN IF NOT EXISTS "supervisorInRestaurantId" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RestaurantUser_supervisorInRestaurantId_fkey') THEN
    ALTER TABLE "RestaurantUser" ADD CONSTRAINT "RestaurantUser_supervisorInRestaurantId_fkey"
      FOREIGN KEY ("supervisorInRestaurantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) Restaurant.areaManagerId (Area Manager za Organigramm)
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "areaManagerId" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Restaurant_areaManagerId_fkey') THEN
    ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_areaManagerId_fkey"
      FOREIGN KEY ("areaManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
