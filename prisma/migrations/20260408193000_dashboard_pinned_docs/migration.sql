-- DashboardPinnedDoc: two pinned global PDFs (e.g. "AIW Bible").

CREATE TABLE "DashboardPinnedDoc" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "pdfUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DashboardPinnedDoc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DashboardPinnedDoc_key_key" ON "DashboardPinnedDoc"("key");

