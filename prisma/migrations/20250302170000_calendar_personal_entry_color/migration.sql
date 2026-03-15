-- AlterTable CalendarPersonalEntry: add color column (optional)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CalendarPersonalEntry' AND column_name = 'color') THEN
    ALTER TABLE "CalendarPersonalEntry" ADD COLUMN "color" TEXT;
  END IF;
END $$;
