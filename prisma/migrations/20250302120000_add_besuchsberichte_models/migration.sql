-- CreateTable
CREATE TABLE "VisitReportCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconName" TEXT,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitReportCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitReportItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitReportItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitReportCategory_restaurantId_idx" ON "VisitReportCategory"("restaurantId");

-- CreateIndex
CREATE INDEX "VisitReportItem_categoryId_year_idx" ON "VisitReportItem"("categoryId", "year");

-- AddForeignKey
ALTER TABLE "VisitReportCategory" ADD CONSTRAINT "VisitReportCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitReportItem" ADD CONSTRAINT "VisitReportItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "VisitReportCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
