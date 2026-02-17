import prisma from "@/lib/prisma";
import RestaurantClient from "./RestaurantClient";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";

export default async function RestaurantsPage() {
  const accessResult = await tryRequirePermission("restaurants:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="Standortverwaltung" />;
  }

  const restaurants = await prisma.restaurant.findMany({
    orderBy: { name: "asc" },
  });

  const formatted = restaurants.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name || "Unbekannt",
    city: r.city || "",
    address: r.address || "",
    isActive: r.isActive,
  }));

  return <RestaurantClient restaurants={formatted} />;
}
