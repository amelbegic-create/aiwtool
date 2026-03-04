/**
 * instrumentation.ts — Next.js server startup hook.
 * Runs ONCE per cold start (Vercel / Node.js) and applies all idempotent
 * schema changes to the live database. Safe to run multiple times.
 * Uses CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so no data
 * is ever lost or overwritten.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { default: prisma } = await import("@/lib/prisma");

    const run = async (sql: string) => {
      try {
        await (prisma as any).$executeRawUnsafe(sql);
      } catch {
        // Ignore errors (constraint/table already exists, etc.)
      }
    };

    // ── 1. Enum values ────────────────────────────────────────────────────────
    await run(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SHIFT_LEADER'`);
    await run(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AREA_MANAGER'`);
    await run(`ALTER TYPE "PDSStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS'`);
    await run(`ALTER TYPE "PDSStatus" ADD VALUE IF NOT EXISTS 'APPROVED'`);

    // ── 2. Department table ───────────────────────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "Department" (
        "id"           TEXT NOT NULL,
        "name"         TEXT NOT NULL,
        "color"        TEXT NOT NULL DEFAULT '#6b7280',
        "restaurantId" TEXT,
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "Department_restaurantId_idx" ON "Department"("restaurantId")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Department_restaurantId_fkey') THEN
          ALTER TABLE "Department" ADD CONSTRAINT "Department_restaurantId_fkey"
            FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // ── 3. User columns ───────────────────────────────────────────────────────
    await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "departmentId" TEXT`);
    await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "orgChartSubtitle" TEXT`);
    await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vacationCarryover" INTEGER NOT NULL DEFAULT 0`);
    await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vacationEntitlement" INTEGER NOT NULL DEFAULT 20`);
    await run(`CREATE INDEX IF NOT EXISTS "User_departmentId_idx" ON "User"("departmentId")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_departmentId_fkey') THEN
          ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey"
            FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // ── 4. Restaurant columns ─────────────────────────────────────────────────
    await run(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "areaManagerId" TEXT`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Restaurant_areaManagerId_fkey') THEN
          ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_areaManagerId_fkey"
            FOREIGN KEY ("areaManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // ── 5. RestaurantUser columns ─────────────────────────────────────────────
    await run(`ALTER TABLE "RestaurantUser" ADD COLUMN IF NOT EXISTS "supervisorInRestaurantId" TEXT`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RestaurantUser_supervisorInRestaurantId_fkey') THEN
          ALTER TABLE "RestaurantUser" ADD CONSTRAINT "RestaurantUser_supervisorInRestaurantId_fkey"
            FOREIGN KEY ("supervisorInRestaurantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // ── 6. PDS columns ────────────────────────────────────────────────────────
    await run(`ALTER TABLE "PDS" ADD COLUMN IF NOT EXISTS "finalGrade" TEXT`);

    // ── 7. LaborReport unique index ───────────────────────────────────────────
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS "LaborReport_restaurantId_month_year_key" ON "LaborReport"("restaurantId", "month", "year")`);

    // ── 8. VacationAllowance table ────────────────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "VacationAllowance" (
        "id"              TEXT NOT NULL,
        "userId"          TEXT NOT NULL,
        "year"            INTEGER NOT NULL,
        "days"            INTEGER NOT NULL DEFAULT 0,
        "carriedOverDays" INTEGER NOT NULL DEFAULT 0,
        "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "VacationAllowance_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS "VacationAllowance_userId_year_key" ON "VacationAllowance"("userId", "year")`);
    await run(`CREATE INDEX IF NOT EXISTS "VacationAllowance_year_idx" ON "VacationAllowance"("year")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VacationAllowance_userId_fkey') THEN
          ALTER TABLE "VacationAllowance" ADD CONSTRAINT "VacationAllowance_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // ── 9. dashboard_changelog table ─────────────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "dashboard_changelog" (
        "id"          TEXT NOT NULL,
        "content"     TEXT NOT NULL,
        "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedById" TEXT,
        CONSTRAINT "dashboard_changelog_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_changelog_updatedById_fkey') THEN
          ALTER TABLE "dashboard_changelog" ADD CONSTRAINT "dashboard_changelog_updatedById_fkey"
            FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // ── 10. Idea table ────────────────────────────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "Idea" (
        "id"             TEXT NOT NULL,
        "text"           TEXT NOT NULL,
        "userId"         TEXT NOT NULL,
        "isRead"         BOOLEAN NOT NULL DEFAULT false,
        "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "attachmentUrl"  TEXT,
        "attachmentName" TEXT,
        "attachmentType" TEXT,
        "attachmentSize" INTEGER,
        "imageUrls"      TEXT[] DEFAULT ARRAY[]::TEXT[],
        "imageNames"     TEXT[] DEFAULT ARRAY[]::TEXT[],
        "pdfUrl"         TEXT,
        "pdfName"        TEXT,
        "pdfSize"        INTEGER,
        CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "Idea_userId_idx" ON "Idea"("userId")`);
    await run(`CREATE INDEX IF NOT EXISTS "Idea_isRead_idx" ON "Idea"("isRead")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Idea_userId_fkey') THEN
          ALTER TABLE "Idea" ADD CONSTRAINT "Idea_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    // Add missing Idea columns (if table existed without them)
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT`);
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "attachmentName" TEXT`);
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "attachmentType" TEXT`);
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "attachmentSize" INTEGER`);
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[]`);
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "imageNames" TEXT[] DEFAULT ARRAY[]::TEXT[]`);
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT`);
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "pdfName" TEXT`);
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "pdfSize" INTEGER`);

    // ── 11. Holiday table ─────────────────────────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "Holiday" (
        "id"        TEXT NOT NULL,
        "day"       INTEGER NOT NULL,
        "month"     INTEGER NOT NULL,
        "label"     TEXT,
        "year"      INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
      )
    `);

    // ── 12. PartnerCompany columns ────────────────────────────────────────────
    await run(`ALTER TABLE "PartnerCompany" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT`);
    await run(`ALTER TABLE "PartnerCompany" ADD COLUMN IF NOT EXISTS "priceListPdfUrl" TEXT`);
    await run(`ALTER TABLE "PartnerCompany" ADD COLUMN IF NOT EXISTS "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[]`);

    // ── 13. UserCertificate table ─────────────────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "UserCertificate" (
        "id"          TEXT NOT NULL,
        "userId"      TEXT NOT NULL,
        "title"       TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "pdfUrl"      TEXT,
        "pdfName"     TEXT,
        "pdfSize"     INTEGER,
        "imageUrl"    TEXT,
        "imageName"   TEXT,
        "imageSize"   INTEGER,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserCertificate_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "UserCertificate_userId_createdAt_idx" ON "UserCertificate"("userId", "createdAt")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserCertificate_userId_fkey') THEN
          ALTER TABLE "UserCertificate" ADD CONSTRAINT "UserCertificate_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    console.log("[db-init] Schema sync complete.");
  }
}
