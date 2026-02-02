"use server";

import { prisma } from "@/lib/prisma";

export async function loginUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    // 1. Pronađi korisnika u bazi
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        department: { select: { name: true } },
        restaurants: {
          include: { restaurant: true }
        }
      }
    });

    // 2. Provjeri da li postoji i da li je šifra tačna
    if (!user || user.password !== password) {
      return { success: false, error: "Pogrešan email ili lozinka." };
    }

    if (!user.isActive) {
      return { success: false, error: "Vaš nalog je deaktiviran." };
    }

    // 3. Vrati podatke o korisniku (bez šifre)
    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role, // ADMIN, WORKER, MANAGER...
        department: user.department?.name ?? null,
        // Vraćamo listu ID-eva restorana kojima ima pristup
        allowedRestaurants: user.restaurants.map(ur => ur.restaurantId)
      }
    };

  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "Greška na serveru." };
  }
}