"use server";

import { prisma } from "@/lib/prisma";

export async function getRestaurantUsers(restaurantId: string) {
  if (!restaurantId) return [];

  try {
    const restaurantUsers = await prisma.restaurantUser.findMany({
      where: {
        restaurantId: restaurantId,
      },
      include: {
        user: true,
      },
    });

    return restaurantUsers.map((ru) => ({
      id: ru.user.id,
      name: ru.user.name || "Nepoznat Korisnik",
      email: ru.user.email,
      role: ru.user.role,
      department: ru.user.department || "RL",
    }));
  } catch (error) {
    console.error("Greška pri dohvaćanju radnika:", error);
    return [];
  }
}