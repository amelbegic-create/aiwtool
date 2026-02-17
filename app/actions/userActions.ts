"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

/** Stealth: SYSTEM_ARCHITECT se ne prikazuje u listama/tabelama/pretragama. NE koristiti za login (auth koristi prisma direktno). */
const STEALTH_ROLE_FILTER = { role: { not: Role.SYSTEM_ARCHITECT } as const };

// 1. DOHVATI KORISNIKE ZA RESTORAN
export async function getUsersByRestaurant(restaurantId: string) {
  try {
    const users = await prisma.user.findMany({
      where: {
        ...STEALTH_ROLE_FILTER,
        restaurants: {
          some: { restaurantId: restaurantId }
        }
      },
      include: {
        restaurants: true 
      },
      orderBy: { name: 'asc' }
    });
    return users;
  } catch (error) {
    console.error("Greška pri dohvatu korisnika:", error);
    return [];
  }
}

// 2. KREIRAJ ILI AŽURIRAJ KORISNIKA (MULTI-RESTORAN PODRŠKA)
export async function upsertUser(data: any, restaurantIds: string[]) {
  try {
    const { id, name, email, password, role, departmentId, entitlement, carryover, permissions } = data;

    let hashedPassword = undefined;
    if (password && password.length > 0) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Default permission object
    const perms = permissions || {};

    // Priprema konekcija za restorane (Prvi u nizu je Primary)
    const restaurantConnections = restaurantIds.map((rId, index) => ({
        restaurantId: rId,
        isPrimary: index === 0 
    }));

    if (id) {
      // --- UPDATE ---
      await prisma.user.update({
        where: { id },
        data: {
          name,
          email,
          role,
          departmentId: departmentId || null,
          vacationEntitlement: Number(entitlement || 0),
          vacationCarryover: Number(carryover || 0),
          permissions: perms,
          ...(hashedPassword && { password: hashedPassword }),
          restaurants: {
            deleteMany: {},
            create: restaurantConnections,
          },
        },
      });
    } else {
      // --- CREATE ---
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return { success: false, message: "Email već postoji!" };
      }

      await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,
          departmentId: departmentId || null,
          vacationEntitlement: Number(entitlement || 20),
          vacationCarryover: Number(carryover || 0),
          permissions: perms,
          restaurants: {
            create: restaurantConnections,
          },
        },
      });
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Greška pri snimanju:", error);
    return { success: false, message: "Greška na serveru." };
  }
}

// 3. OBRIŠI VEZU KORISNIKA I RESTORANA
export async function deleteUserFromRestaurant(userId: string, restaurantId: string) {
    try {
        await prisma.restaurantUser.deleteMany({
            where: { userId, restaurantId }
        });
        revalidatePath("/admin/users");
        return { success: true };
    } catch {
        return { success: false };
    }
}