-- Allow up to 5 personal entries per user per day (remove unique on userId+date).
DROP INDEX IF EXISTS "CalendarPersonalEntry_userId_date_key";

ALTER TABLE "CalendarPersonalEntry" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "CalendarPersonalEntry_userId_date_sortOrder_idx" ON "CalendarPersonalEntry"("userId", "date", "sortOrder");
