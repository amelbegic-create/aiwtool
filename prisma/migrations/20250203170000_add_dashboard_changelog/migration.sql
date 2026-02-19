-- CreateTable (table name must match schema @@map("dashboard_changelog"))
CREATE TABLE IF NOT EXISTS "dashboard_changelog" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,

    CONSTRAINT "dashboard_changelog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_changelog_updatedById_fkey') THEN
    ALTER TABLE "dashboard_changelog" ADD CONSTRAINT "dashboard_changelog_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
