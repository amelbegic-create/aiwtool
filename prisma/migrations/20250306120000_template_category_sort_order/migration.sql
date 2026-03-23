-- AlterTable
ALTER TABLE "TemplateCategory" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Stable order for existing rows (by creation time)
UPDATE "TemplateCategory" AS tc
SET "sortOrder" = sq.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) - 1)::int AS rn
  FROM "TemplateCategory"
) AS sq
WHERE tc.id = sq.id;

-- CreateIndex
CREATE INDEX "TemplateCategory_sortOrder_idx" ON "TemplateCategory"("sortOrder");
