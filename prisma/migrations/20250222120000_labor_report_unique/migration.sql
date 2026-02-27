-- CreateUniqueIndex (idempotentno – ne pada ako constraint već postoji)
-- Dodaje unique constraint (restaurantId, month, year) za LaborReport.upsert()
CREATE UNIQUE INDEX IF NOT EXISTS "LaborReport_restaurantId_month_year_key" ON "LaborReport"("restaurantId", "month", "year");
