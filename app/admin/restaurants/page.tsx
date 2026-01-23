import prisma from "@/lib/prisma";
import RestaurantClient from "./RestaurantClient";
import { requirePermission } from "@/lib/access";

export default async function RestaurantsPage() {
  await requirePermission("restaurants:access");

  const restaurants = await prisma.restaurant.findMany({
    orderBy: { name: "asc" },
  });

  const formatted = restaurants.map((r) => ({
    ...r,
    name: r.name || "Nepoznat restoran",
    city: r.city || "",
    address: r.address || "",
  }));

  return <RestaurantClient restaurants={formatted as any} />;
}
