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

    // ── Idea status columns (IdeaStatus enum + admin reply) ───────────────
    // Vercel deploy obično ne pokreće `prisma migrate deploy`, pa Prisma može
    // failati ako LIVE Neon DB nema ove kolone.
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IdeaStatus') THEN
          CREATE TYPE "IdeaStatus" AS ENUM ('SENT', 'IN_PROGRESS', 'DONE');
        END IF;
      END $$
    `);
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "status" "IdeaStatus" NOT NULL DEFAULT 'SENT'`);
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "adminReply" TEXT`);
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3)`);
    await run(`ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "repliedById" TEXT`);
    await run(`CREATE INDEX IF NOT EXISTS "Idea_status_idx" ON "Idea"("status")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Idea_repliedById_fkey') THEN
          ALTER TABLE "Idea" ADD CONSTRAINT "Idea_repliedById_fkey"
            FOREIGN KEY ("repliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$
    `);

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

    // ── 10d. Dashboard pinned docs (global PDFs) ─────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "DashboardPinnedDoc" (
        "id"        TEXT NOT NULL,
        "key"       TEXT NOT NULL,
        "title"     TEXT NOT NULL,
        "pdfUrl"    TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DashboardPinnedDoc_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS "DashboardPinnedDoc_key_key" ON "DashboardPinnedDoc"("key")`);
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

    // ── 15. Aushilfe: Schicht 1–3 + Sektori ─────────────────────────────────
    await run(`ALTER TABLE "HelpRequest" ALTER COLUMN "shiftTime" DROP NOT NULL`);
    await run(`ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "shiftNumber" INTEGER NOT NULL DEFAULT 1`);
    await run(`ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "sectorKey" TEXT NOT NULL DEFAULT 'kueche'`);
    await run(`ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "sectorLabel" TEXT NOT NULL DEFAULT 'Küche'`);
    // neededSpots can now be 0 on HelpRequest itself (sum comes from positions)
    await run(`ALTER TABLE "HelpRequest" ALTER COLUMN "neededSpots" SET DEFAULT 0`);

    await run(`
      CREATE TABLE IF NOT EXISTS "AushilfeCustomSector" (
        "id"           TEXT NOT NULL,
        "restaurantId" TEXT NOT NULL,
        "key"          TEXT NOT NULL,
        "label"        TEXT NOT NULL,
        "group"        TEXT NOT NULL DEFAULT 'Sonstiges',
        "sortOrder"    INTEGER NOT NULL DEFAULT 0,
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AushilfeCustomSector_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS "AushilfeCustomSector_restaurantId_key_key" ON "AushilfeCustomSector"("restaurantId", "key")`);
    await run(`CREATE INDEX IF NOT EXISTS "AushilfeCustomSector_restaurantId_idx" ON "AushilfeCustomSector"("restaurantId")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AushilfeCustomSector_restaurantId_fkey') THEN
          ALTER TABLE "AushilfeCustomSector" ADD CONSTRAINT "AushilfeCustomSector_restaurantId_fkey"
            FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // ── 16. Aushilfe v2: HelpRequestPosition + HelpSlot.positionId ───────────
    await run(`
      CREATE TABLE IF NOT EXISTS "HelpRequestPosition" (
        "id"            TEXT NOT NULL,
        "helpRequestId" TEXT NOT NULL,
        "sectorKey"     TEXT NOT NULL,
        "sectorLabel"   TEXT NOT NULL,
        "shiftTimeText" TEXT NOT NULL,
        "neededSpots"   INTEGER NOT NULL DEFAULT 1,
        "sortOrder"     INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "HelpRequestPosition_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "HelpRequestPosition_helpRequestId_idx" ON "HelpRequestPosition"("helpRequestId")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HelpRequestPosition_helpRequestId_fkey') THEN
          ALTER TABLE "HelpRequestPosition" ADD CONSTRAINT "HelpRequestPosition_helpRequestId_fkey"
            FOREIGN KEY ("helpRequestId") REFERENCES "HelpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // HelpSlot: optional FK to position
    await run(`ALTER TABLE "HelpSlot" ADD COLUMN IF NOT EXISTS "positionId" TEXT`);
    await run(`CREATE INDEX IF NOT EXISTS "HelpSlot_positionId_idx" ON "HelpSlot"("positionId")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HelpSlot_positionId_fkey') THEN
          ALTER TABLE "HelpSlot" ADD CONSTRAINT "HelpSlot_positionId_fkey"
            FOREIGN KEY ("positionId") REFERENCES "HelpRequestPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // Backfill: legacy requests without positions get one synthetic position
    await run(`
      INSERT INTO "HelpRequestPosition" ("id", "helpRequestId", "sectorKey", "sectorLabel", "shiftTimeText", "neededSpots", "sortOrder")
      SELECT
        'pos_legacy_' || hr."id",
        hr."id",
        hr."sectorKey",
        hr."sectorLabel",
        COALESCE(hr."shiftTime", 'Schicht ' || hr."shiftNumber"::text),
        hr."neededSpots",
        0
      FROM "HelpRequest" hr
      WHERE hr."neededSpots" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "HelpRequestPosition" p WHERE p."helpRequestId" = hr."id"
        )
      ON CONFLICT DO NOTHING
    `);

    // ── 17. OneOnOneTopic meeting fields ─────────────────────────────────────
    await run(`ALTER TABLE "OneOnOneTopic" ADD COLUMN IF NOT EXISTS "meetingStartsAt" TIMESTAMP(3)`);
    await run(`ALTER TABLE "OneOnOneTopic" ADD COLUMN IF NOT EXISTS "meetingEndsAt" TIMESTAMP(3)`);
    await run(`ALTER TABLE "OneOnOneTopic" ADD COLUMN IF NOT EXISTS "meetingLocation" TEXT`);
    await run(`ALTER TABLE "OneOnOneTopic" ADD COLUMN IF NOT EXISTS "requesterCalendarEventId" TEXT`);
    await run(`ALTER TABLE "OneOnOneTopic" ADD COLUMN IF NOT EXISTS "supervisorCalendarEventId" TEXT`);
    await run(`CREATE INDEX IF NOT EXISTS "OneOnOneTopic_meetingStartsAt_idx" ON "OneOnOneTopic"("meetingStartsAt")`);
    await run(`CREATE INDEX IF NOT EXISTS "OneOnOneTopic_status_idx" ON "OneOnOneTopic"("status")`);

    // ── 18. OneOnOneComment table ────────────────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "OneOnOneComment" (
        "id"        TEXT NOT NULL,
        "topicId"   TEXT NOT NULL,
        "authorId"  TEXT NOT NULL,
        "body"      TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OneOnOneComment_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "OneOnOneComment_topicId_createdAt_idx" ON "OneOnOneComment"("topicId", "createdAt")`);
    await run(`CREATE INDEX IF NOT EXISTS "OneOnOneComment_authorId_idx" ON "OneOnOneComment"("authorId")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OneOnOneComment_topicId_fkey') THEN
          ALTER TABLE "OneOnOneComment" ADD CONSTRAINT "OneOnOneComment_topicId_fkey"
            FOREIGN KEY ("topicId") REFERENCES "OneOnOneTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OneOnOneComment_authorId_fkey') THEN
          ALTER TABLE "OneOnOneComment" ADD CONSTRAINT "OneOnOneComment_authorId_fkey"
            FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    // ── 19. OneOnOneAttachment table ─────────────────────────────────────────
    await run(`
      CREATE TABLE IF NOT EXISTS "OneOnOneAttachment" (
        "id"           TEXT NOT NULL,
        "topicId"      TEXT NOT NULL,
        "commentId"    TEXT,
        "uploadedById" TEXT NOT NULL,
        "fileUrl"      TEXT NOT NULL,
        "fileName"     TEXT NOT NULL,
        "fileType"     TEXT NOT NULL,
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OneOnOneAttachment_pkey" PRIMARY KEY ("id")
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS "OneOnOneAttachment_topicId_idx" ON "OneOnOneAttachment"("topicId")`);
    await run(`CREATE INDEX IF NOT EXISTS "OneOnOneAttachment_commentId_idx" ON "OneOnOneAttachment"("commentId")`);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OneOnOneAttachment_topicId_fkey') THEN
          ALTER TABLE "OneOnOneAttachment" ADD CONSTRAINT "OneOnOneAttachment_topicId_fkey"
            FOREIGN KEY ("topicId") REFERENCES "OneOnOneTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OneOnOneAttachment_uploadedById_fkey') THEN
          ALTER TABLE "OneOnOneAttachment" ADD CONSTRAINT "OneOnOneAttachment_uploadedById_fkey"
            FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    await run(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OneOnOneAttachment_commentId_fkey') THEN
          ALTER TABLE "OneOnOneAttachment" ADD CONSTRAINT "OneOnOneAttachment_commentId_fkey"
            FOREIGN KEY ("commentId") REFERENCES "OneOnOneComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$
    `);

    console.log("[db-init] Schema sync complete.");
  }
}
