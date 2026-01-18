"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hash } from "bcrypt";

// KREIRANJE KORISNIKA
export async function createSmartUser(data: {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  roleId: string; 
  unitIds: string[];
  supervisorId?: string;
  vacationEntitlement: number;
  vacationCarryover: number;
}) {
  try {
    const hashedPassword = data.password ? await hash(data.password, 10) : undefined;
    const fullName = `${data.firstName} ${data.lastName}`.trim();

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error("Korisnik s ovim emailom već postoji.");

    // PRIPREMA SUPERVISOR ID-a (Fix za grešku 'incompatible types')
    // Ako je prazan string, šaljemo undefined (ne null, jer Prisma nekad zeza s null u create)
    const supervisorConnect = (data.supervisorId && data.supervisorId.trim() !== "") 
      ? { connect: { id: data.supervisorId } } 
      : undefined;

    await prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        name: fullName,
        email: data.email,
        password: hashedPassword,
        
        role: { connect: { id: data.roleId } }, 
        
        supervisor: supervisorConnect, // Ovako je sigurnije

        vacationEntitlement: Number(data.vacationEntitlement) || 20,
        vacationCarryover: Number(data.vacationCarryover) || 0,
        
        restaurants: {
          create: data.unitIds.map((id, index) => ({
            restaurantId: id,
            isPrimary: index === 0
          }))
        }
      }
    });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: any) {
    console.error("Create User Error:", error);
    throw new Error(error.message || "Greška pri kreiranju korisnika.");
  }
}

// AŽURIRANJE KORISNIKA
export async function updateSmartUser(userId: string, data: {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string; 
  unitIds: string[];
  supervisorId?: string;
  vacationEntitlement: number;
  vacationCarryover: number;
}) {
  try {
    const fullName = `${data.firstName} ${data.lastName}`.trim();

    // Logika za disconnect/connect supervisora
    const supervisorUpdate = (data.supervisorId && data.supervisorId.trim() !== "")
        ? { connect: { id: data.supervisorId } }
        : { disconnect: true };

    await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        name: fullName,
        email: data.email,
        
        role: { connect: { id: data.roleId } }, 
        
        supervisor: supervisorUpdate,
        
        vacationEntitlement: Number(data.vacationEntitlement),
        vacationCarryover: Number(data.vacationCarryover),
      }
    });

    // Ažuriranje restorana
    await prisma.restaurantUser.deleteMany({ where: { userId } });
    
    if (data.unitIds.length > 0) {
      await prisma.restaurantUser.createMany({
        data: data.unitIds.map((id, index) => ({
          userId,
          restaurantId: id,
          isPrimary: index === 0
        }))
      });
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error(error);
    throw new Error("Greška pri ažuriranju.");
  }
}

export async function deleteSmartUser(userId: string) {
  try {
    await prisma.user.delete({ where: { id: userId } });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    throw new Error("Greška pri brisanju korisnika.");
  }
}