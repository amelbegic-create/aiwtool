-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "restaurantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Department_restaurantId_idx" ON "Department"("restaurantId");

-- AddForeignKey (Restaurant)
ALTER TABLE "Department" ADD CONSTRAINT "Department_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable User: add departmentId, then drop department
ALTER TABLE "User" ADD COLUMN "departmentId" TEXT;

-- Optional: create default departments and backfill (uncomment and run separately if you want to preserve old department values)
-- INSERT INTO "Department" ("id", "name", "color", "createdAt", "updatedAt") VALUES
--   (gen_random_uuid()::text, 'RL', '#6b7280', NOW(), NOW()),
--   (gen_random_uuid()::text, 'Office', '#6b7280', NOW(), NOW()),
--   (gen_random_uuid()::text, 'HM', '#6b7280', NOW(), NOW());
-- UPDATE "User" u SET "departmentId" = (SELECT id FROM "Department" d WHERE d.name = u.department LIMIT 1) WHERE u.department IS NOT NULL;

ALTER TABLE "User" DROP COLUMN IF EXISTS "department";

-- AddForeignKey (User -> Department)
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");
