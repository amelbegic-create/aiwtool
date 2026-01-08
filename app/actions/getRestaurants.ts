"use server";

import { prisma } from "@/lib/prisma";

export async function getRestaurants() {
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    return restaurants;
  } catch (error) {
    console.error("Greška pri dohvaćanju restorana:", error);
    return [];
  }
}