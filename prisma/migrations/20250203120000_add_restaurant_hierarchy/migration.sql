-- AlterTable: Add supervisorInRestaurantId to RestaurantUser (hijerarhija po restoranu)
ALTER TABLE "RestaurantUser" ADD COLUMN IF NOT EXISTS "supervisorInRestaurantId" TEXT;

-- CreateIndex / FK: Add foreign key to User (Prisma relation "RestaurantSupervisor")
-- Only add constraint if column was just added and constraint doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RestaurantUser_supervisorInRestaurantId_fkey'
  ) THEN
    ALTER TABLE "RestaurantUser" ADD CONSTRAINT "RestaurantUser_supervisorInRestaurantId_fkey"
      FOREIGN KEY ("supervisorInRestaurantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
