-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "CalendarEventCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER,

    CONSTRAINT "CalendarEventCategory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CalendarEventCategory_sortOrder_idx" ON "CalendarEventCategory"("sortOrder");

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "CalendarPersonalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarPersonalEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarPersonalEntry_userId_date_key" ON "CalendarPersonalEntry"("userId", "date");
CREATE INDEX IF NOT EXISTS "CalendarPersonalEntry_userId_idx" ON "CalendarPersonalEntry"("userId");
CREATE INDEX IF NOT EXISTS "CalendarPersonalEntry_userId_date_idx" ON "CalendarPersonalEntry"("userId", "date");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarPersonalEntry_userId_fkey') THEN
    ALTER TABLE "CalendarPersonalEntry" ADD CONSTRAINT "CalendarPersonalEntry_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable CalendarEvent: add columns if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CalendarEvent' AND column_name = 'endDate') THEN
    ALTER TABLE "CalendarEvent" ADD COLUMN "endDate" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CalendarEvent' AND column_name = 'color') THEN
    ALTER TABLE "CalendarEvent" ADD COLUMN "color" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CalendarEvent' AND column_name = 'categoryId') THEN
    ALTER TABLE "CalendarEvent" ADD COLUMN "categoryId" TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CalendarEvent_categoryId_idx" ON "CalendarEvent"("categoryId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_categoryId_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "CalendarEventCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
