-- AlterTable
ALTER TABLE "RestaurantUser" ADD COLUMN "vacationListOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "RestaurantUser_restaurantId_vacationListOrder_idx" ON "RestaurantUser"("restaurantId", "vacationListOrder");
