-- Run this only if the table dashboard_changelog does not exist.
-- In PostgreSQL you can run: \i prisma/create-dashboard-changelog.sql
-- Or from psql: \ir create-dashboard-changelog.sql (from prisma folder)

CREATE TABLE IF NOT EXISTS "dashboard_changelog" (
  "id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,

  CONSTRAINT "dashboard_changelog_pkey" PRIMARY KEY ("id")
);

-- Optional: allow FK to User (if your users table is "User" in Prisma it might be "User" in DB - check with \dt)
-- ALTER TABLE "dashboard_changelog" ADD CONSTRAINT "dashboard_changelog_updatedById_fkey" 
--   FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- If your users table is lowercase in DB (e.g. "user"):
-- ALTER TABLE "dashboard_changelog" ADD CONSTRAINT "dashboard_changelog_updatedById_fkey" 
--   FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
