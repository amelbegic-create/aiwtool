import prisma from "@/lib/prisma";
import UserClient from "./UserClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { restaurants: true }
  });

  const rawRestaurants = await prisma.restaurant.findMany({
    select: { id: true, name: true }
  });

  // --- FIX ZA TYPE ERROR ---
  const formattedRestaurants = rawRestaurants.map(r => ({
    id: r.id,
    name: r.name || "Nepoznat restoran" // Obavezna konverzija null -> string
  }));

  const formattedUsers = users.map(u => ({
    ...u,
    name: u.name || "Korisnik",
    email: u.email || "",
    restaurantIds: u.restaurants.map(r => r.restaurantId)
  }));

  return <UserClient users={formattedUsers} restaurants={formattedRestaurants} />;
}