// app/actions/userActions.ts
"use server";
import prisma from "@/lib/prisma";

export async function getRestaurantStaff(restaurantId: string) {
  try {
    // Tražimo sve korisnike koji su povezani sa ovim restoranom u bazi
    const staff = await prisma.user.findMany({
      where: {
        restaurants: {
          some: {
            restaurantId: restaurantId
          }
        }
      },
      select: {
        id: true,
        name: true,
        role: true,
        email: true
      }
    });
    return staff;
  } catch (error) {
    console.error("Greška pri dohvatu osoblja:", error);
    return [];
  }
}