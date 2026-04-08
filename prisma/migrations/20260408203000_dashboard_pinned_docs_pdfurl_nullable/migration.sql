-- Allow creating pinned docs before uploading a PDF.
ALTER TABLE "DashboardPinnedDoc" ALTER COLUMN "pdfUrl" DROP NOT NULL;

