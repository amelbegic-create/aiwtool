-- AlterTable: Add orgChartSubtitle to User (Organigramm – editierbarer Text unter dem Namen)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "orgChartSubtitle" TEXT;
