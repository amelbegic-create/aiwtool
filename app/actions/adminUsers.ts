"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";

/** Stealth: SYSTEM_ARCHITECT se ne prikazuje u listama (Admin panel, exporti). */
const STEALTH_ROLE_FILTER = { role: { not: Role.SYSTEM_ARCHITECT } };

// 1. DOHVATI SVE KORISNIKE
export async function getAllUsers() {
  try {
    const users = await prisma.user.findMany({
      where: STEALTH_ROLE_FILTER,
      orderBy: { createdAt: 'desc' },
      include: { 
        restaurants: { 
          include: { restaurant: true } 
        },
        department: true // Dodali smo ovo da vidis i odjel kad dovuces korisnike
      }
    });
    return users;
  } catch (error) {
    console.error("Greška getAllUsers:", error);
    return []; 
  }
}

// 2. KREIRAJ KORISNIKA
export async function createUser(formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as Role;
    
    // Ovdje dobijamo ID odjela, ne ime
    const departmentId = formData.get("department") as string; 
    
    const restaurantIdsJson = formData.get("restaurantIds") as string;
    const restaurantIds: string[] = JSON.parse(restaurantIdsJson || "[]");

    await prisma.user.create({
      data: {
        name,
        email,
        password,
        role,
        // FIX: Umjesto stringa, koristimo 'connect'
        department: departmentId ? {
          connect: { id: departmentId }
        } : undefined, 
        restaurants: {
          create: restaurantIds.map((restId, index) => ({
            restaurantId: restId,
            isPrimary: index === 0
          }))
        }
      },
    });
    
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Create error:", error);
    return { success: false, error: "Fehler beim Erstellen." };
  }
}

// 3. AŽURIRAJ KORISNIKA
export async function updateUser(formData: FormData) {
  try {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as Role;
    
    // Ovdje dobijamo ID odjela
    const departmentId = formData.get("department") as string;
    
    const restaurantIdsJson = formData.get("restaurantIds") as string;
    const restaurantIds: string[] = JSON.parse(restaurantIdsJson || "[]");

    // Priprema podataka za update
    const updateData: any = { 
      name, 
      email, 
      role,
      // FIX: Update relacije
      department: departmentId ? {
        connect: { id: departmentId }
      } : undefined
    };

    if (password && password.trim() !== "") {
      updateData.password = password; 
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update osnovnih podataka i odjela
      await tx.user.update({ 
        where: { id }, 
        data: updateData 
      });

      // 2. Reset restorana (brisanje starih, dodavanje novih)
      await tx.restaurantUser.deleteMany({ where: { userId: id } });
      
      if (restaurantIds.length > 0) {
        await tx.restaurantUser.createMany({
          data: restaurantIds.map((restId, index) => ({
            userId: id,
            restaurantId: restId,
            isPrimary: index === 0
          }))
        });
      }
    });
    
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Update error:", error);
    return { success: false, error: "Fehler beim Aktualisieren." };
  }
}

// 4. OBRIŠI KORISNIKA
export async function deleteUser(userId: string) {
  try {
    await prisma.user.delete({ where: { id: userId } });
    revalidatePath("/admin/users");
    return { success: true };
  } catch {
    return { success: false };
  }
}