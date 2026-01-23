import prisma from "@/lib/prisma";
import UserClient from "./UserClient";
import { requirePermission } from "@/lib/access";

export default async function UsersPage() {
  await requirePermission("users:access");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { restaurants: true },
  });

  const rawRestaurants = await prisma.restaurant.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const formattedRestaurants = rawRestaurants.map((r) => ({
    id: r.id,
    name: r.name || "Nepoznat restoran",
  }));

  const formattedUsers = users.map((u) => ({
    ...u,
    name: u.name || "Korisnik",
    email: u.email || "",
    restaurantIds: u.restaurants.map((rr) => rr.restaurantId),
  }));

  return <UserClient users={formattedUsers as any} restaurants={formattedRestaurants} />;
}
