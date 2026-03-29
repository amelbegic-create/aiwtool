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
    await run(`ALTER TYPE "PDSStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS'`);
    await run(`ALTER TYPE "PDSStatus" ADD VALUE IF NOT EXISTS 'APPROVED'`);
    await run(`ALTER TYPE "DashboardNewsAttachmentKind" ADD VALUE IF NOT EXISTS 'VIDEO'`);

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

    // ── 4b. Sitzplan (više PDF-ova) — usklađeno sa prisma/schema Restaurant.sitzplanPdfsData
    await run(
      `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "sitzplanPdfsData" JSONB NOT NULL DEFAULT '[]'::jsonb`
    );
    await run(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'Restaurant' AND column_name = 'sitzplanPdfUrls'
        ) THEN
          EXECUTE $sql$
            UPDATE "Restaurant" r
            SET "sitzplanPdfsData" = (
              SELECT COALESCE(
                jsonb_agg(
                  jsonb_build_object(
                    'url', u.url,
                    'fileName', COALESCE(
                      CASE
                        WHEN r."sitzplanPdfNames" IS NOT NULL
                          AND array_length(r."sitzplanPdfNames", 1) IS NOT NULL
                          AND u.idx <= array_length(r."sitzplanPdfNames", 1)
                        THEN r."sitzplanPdfNames"[u.idx]
                        ELSE ''
                      END,
                      ''
                    )
                  ) ORDER BY u.idx
                ),
                '[]'::jsonb
              )
              FROM unnest(r."sitzplanPdfUrls") WITH ORDINALITY AS u(url, idx)
            )
            WHERE cardinality(r."sitzplanPdfUrls") > 0
          $sql$;
          ALTER TABLE "Restaurant" DROP COLUMN IF EXISTS "sitzplanPdfUrls";
          ALTER TABLE "Restaurant" DROP COLUMN IF EXISTS "sitzplanPdfNames";
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
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false`);
    await run(`CREATE INDEX IF NOT EXISTS "Idea_isArchived_idx" ON "Idea"("isArchived")`);

    // ── 10b. Dashboard news slider ──────────────────────────────────────────
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DashboardNewsAttachmentKind') THEN
          CREATE TYPE "DashboardNewsAttachmentKind" AS ENUM ('PDF', 'IMAGE', 'VIDEO');
        END IF;
      END $$
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS "DashboardNewsItem" (
        "id"               TEXT NOT NULL,
        "title"            TEXT NOT NULL,
        "subtitle"         TEXT,
        "coverImageUrl"    TEXT NOT NULL,
        "attachmentUrl"    TEXT NOT NULL,
        "attachmentKind"   "DashboardNewsAttachmentKind" NOT NULL,
        "sortOrder"        INTEGER NOT NULL DEFAULT 0,
        "isActive"         BOOLEAN NOT NULL DEFAULT true,
        "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DashboardNewsItem_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(
      `CREATE INDEX IF NOT EXISTS "DashboardNewsItem_isActive_sortOrder_idx" ON "DashboardNewsItem"("isActive", "sortOrder")`
    );

    // ── 10b.1 Dashboard news view tracking ────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "DashboardNewsView" (
        "id"          TEXT NOT NULL,
        "userId"      TEXT NOT NULL,
        "newsItemId" TEXT NOT NULL,
        "viewedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DashboardNewsView_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "DashboardNewsView_newsItemId_idx" ON "DashboardNewsView"("newsItemId")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DashboardNewsView_userId_fkey') THEN
          ALTER TABLE "DashboardNewsView" ADD CONSTRAINT "DashboardNewsView_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DashboardNewsView_newsItemId_fkey') THEN
          ALTER TABLE "DashboardNewsView" ADD CONSTRAINT "DashboardNewsView_newsItemId_fkey"
            FOREIGN KEY ("newsItemId") REFERENCES "DashboardNewsItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'DashboardNewsView_userId_newsItemId_key'
        ) THEN
          ALTER TABLE "DashboardNewsView" ADD CONSTRAINT "DashboardNewsView_userId_newsItemId_key"
            UNIQUE ("userId", "newsItemId");
        END IF;
      END $$
    `);

    // ── 10b.2 News galerija (dodatne slike u modalu) ─────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "DashboardNewsGalleryImage" (
        "id"        TEXT NOT NULL,
        "newsId"    TEXT NOT NULL,
        "imageUrl"  TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DashboardNewsGalleryImage_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(
      `CREATE INDEX IF NOT EXISTS "DashboardNewsGalleryImage_newsId_sortOrder_idx" ON "DashboardNewsGalleryImage"("newsId", "sortOrder")`
    );
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DashboardNewsGalleryImage_newsId_fkey') THEN
          ALTER TABLE "DashboardNewsGalleryImage" ADD CONSTRAINT "DashboardNewsGalleryImage_newsId_fkey"
            FOREIGN KEY ("newsId") REFERENCES "DashboardNewsItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // ── 10c. Dashboard events slider (cover + gallery) ───────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "DashboardEventItem" (
        "id"               TEXT NOT NULL,
        "title"            TEXT NOT NULL,
        "subtitle"         TEXT,
        "coverImageUrl"    TEXT NOT NULL,
        "videoUrl"         TEXT,
        "sortOrder"        INTEGER NOT NULL DEFAULT 0,
        "isActive"         BOOLEAN NOT NULL DEFAULT true,
        "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DashboardEventItem_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`ALTER TABLE "DashboardEventItem" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT`);
    await run(
      `CREATE INDEX IF NOT EXISTS "DashboardEventItem_isActive_sortOrder_idx" ON "DashboardEventItem"("isActive", "sortOrder")`
    );
    await run(`
      CREATE TABLE IF NOT EXISTS "DashboardEventImage" (
        "id"               TEXT NOT NULL,
        "eventId"          TEXT NOT NULL,
        "imageUrl"         TEXT NOT NULL,
        "sortOrder"        INTEGER NOT NULL DEFAULT 0,
        "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DashboardEventImage_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "DashboardEventImage_eventId_sortOrder_idx" ON "DashboardEventImage"("eventId", "sortOrder")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DashboardEventImage_eventId_fkey') THEN
          ALTER TABLE "DashboardEventImage" ADD CONSTRAINT "DashboardEventImage_eventId_fkey"
            FOREIGN KEY ("eventId") REFERENCES "DashboardEventItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // ── 10c.1 Dashboard event view tracking ───────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "DashboardEventView" (
        "id"          TEXT NOT NULL,
        "userId"      TEXT NOT NULL,
        "eventItemId" TEXT NOT NULL,
        "viewedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DashboardEventView_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "DashboardEventView_eventItemId_idx" ON "DashboardEventView"("eventItemId")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DashboardEventView_userId_fkey') THEN
          ALTER TABLE "DashboardEventView" ADD CONSTRAINT "DashboardEventView_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DashboardEventView_eventItemId_fkey') THEN
          ALTER TABLE "DashboardEventView" ADD CONSTRAINT "DashboardEventView_eventItemId_fkey"
            FOREIGN KEY ("eventItemId") REFERENCES "DashboardEventItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'DashboardEventView_userId_eventItemId_key'
        ) THEN
          ALTER TABLE "DashboardEventView" ADD CONSTRAINT "DashboardEventView_userId_eventItemId_key"
            UNIQUE ("userId", "eventItemId");
        END IF;
      END $$
    `);

    // ── 10c.2 Dashboard event likes & comments (social) ───────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "DashboardEventLike" (
        "id"          TEXT NOT NULL,
        "userId"      TEXT NOT NULL,
        "eventItemId" TEXT NOT NULL,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DashboardEventLike_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "DashboardEventLike_eventItemId_idx" ON "DashboardEventLike"("eventItemId")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DashboardEventLike_userId_fkey') THEN
          ALTER TABLE "DashboardEventLike" ADD CONSTRAINT "DashboardEventLike_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DashboardEventLike_eventItemId_fkey') THEN
          ALTER TABLE "DashboardEventLike" ADD CONSTRAINT "DashboardEventLike_eventItemId_fkey"
            FOREIGN KEY ("eventItemId") REFERENCES "DashboardEventItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'DashboardEventLike_userId_eventItemId_key'
        ) THEN
          ALTER TABLE "DashboardEventLike" ADD CONSTRAINT "DashboardEventLike_userId_eventItemId_key"
            UNIQUE ("userId", "eventItemId");
        END IF;
      END $$
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS "DashboardEventComment" (
        "id"          TEXT NOT NULL,
        "userId"      TEXT NOT NULL,
        "eventItemId" TEXT NOT NULL,
        "body"        VARCHAR(2000) NOT NULL,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DashboardEventComment_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(
      `CREATE INDEX IF NOT EXISTS "DashboardEventComment_eventItemId_createdAt_idx" ON "DashboardEventComment"("eventItemId", "createdAt")`
    );
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DashboardEventComment_userId_fkey') THEN
          ALTER TABLE "DashboardEventComment" ADD CONSTRAINT "DashboardEventComment_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DashboardEventComment_eventItemId_fkey') THEN
          ALTER TABLE "DashboardEventComment" ADD CONSTRAINT "DashboardEventComment_eventItemId_fkey"
            FOREIGN KEY ("eventItemId") REFERENCES "DashboardEventItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // ── 10d. Besuchsberichte: Reihenfolge der Dokumente pro Kategorie ──────────
    await run(`ALTER TABLE "VisitReportItem" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0`);
    await run(
      `CREATE INDEX IF NOT EXISTS "VisitReportItem_categoryId_sortOrder_idx" ON "VisitReportItem"("categoryId", "sortOrder")`
    );

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

    // ── 14. Vorlagen (TemplateItem) – tekst iz PDF-a za pretragu ─────────────
    await run(`ALTER TABLE "TemplateItem" ADD COLUMN IF NOT EXISTS "extractedText" TEXT`);

    console.log("[db-init] Schema sync complete.");
  }
}
