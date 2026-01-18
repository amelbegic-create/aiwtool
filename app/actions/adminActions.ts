"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions"; 
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { SYSTEM_PERMISSIONS } from "@/lib/constants";

interface CreateUserDTO {
    name: string;
    email: string;
    password?: string;
    role: Role;
    department: string;
    vacationEntitlement: number;
    vacationCarryover: number;
    restaurantIds: string[];
    primaryRestaurantId?: string;
    permissions: string[];
}

// --- GLAVNA PROMJENA OVDJE ---
async function checkPermission(permission: string) {
    // 1. Dohvati osnovnu sesiju (samo da dobijemo email)
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.email) {
        throw new Error("Niste prijavljeni.");
    }

    // 2. SIGURNOST: Dohvati NAJSVJEŽIJE podatke direktno iz baze
    // Ne vjerujemo sesiji jer može biti "bajat" kolačić
    const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true, permissions: true } // Dohvaćamo samo što nam treba
    });

    if (!dbUser) {
        throw new Error("Korisnik nije pronađen u bazi.");
    }

    console.log("DB Permission Check -> Role:", dbUser.role); // Debug

    const userRole = String(dbUser.role);

    // 3. Provjera "God Mode" uloga
    if (
        userRole === 'SYSTEM_ARCHITECT' || 
        userRole === 'SUPER_ADMIN' || 
        userRole === 'ADMIN' ||
        userRole === Role.SYSTEM_ARCHITECT ||
        userRole === Role.ADMIN
    ) {
        return true;
    }

    // 4. Provjera specifičnih permisija
    if (dbUser.permissions && dbUser.permissions.includes(permission)) {
        return true;
    }

    throw new Error(`NEMAŠ PERMISIJE! Tvoja rola je: ${userRole}`);
}

// --- AKCIJE ---

export async function createUser(data: CreateUserDTO) {
    await checkPermission(SYSTEM_PERMISSIONS.USERS_MANAGE);

    if (!data.password) throw new Error("Lozinka je obavezna.");

    const hashedPassword = await hash(data.password, 12);
    
    const adminRoles: Role[] = [Role.SYSTEM_ARCHITECT, Role.ADMIN];
    const allPermissions = Object.values(SYSTEM_PERMISSIONS) as string[];
    
    const finalPermissions: string[] = adminRoles.includes(data.role) 
        ? allPermissions
        : data.permissions;

    await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            password: hashedPassword,
            role: data.role,
            permissions: finalPermissions,
            department: data.department,
            vacationEntitlement: Number(data.vacationEntitlement),
            vacationCarryover: Number(data.vacationCarryover),
            restaurants: {
                create: data.restaurantIds.map((rid) => ({
                    restaurantId: rid,
                    isPrimary: rid === data.primaryRestaurantId
                }))
            }
        }
    });
    revalidatePath("/admin/users");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateUser(data: any) {
    await checkPermission(SYSTEM_PERMISSIONS.USERS_MANAGE);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
        name: data.name,
        email: data.email,
        role: data.role,
        department: data.department,
        vacationEntitlement: Number(data.vacationEntitlement),
        vacationCarryover: Number(data.vacationCarryover),
        permissions: data.permissions
    };

    if (data.password && data.password.trim() !== "") {
        updateData.password = await hash(data.password, 12);
    }

    await prisma.restaurantUser.deleteMany({
        where: { userId: data.id }
    });

    await prisma.user.update({
        where: { id: data.id },
        data: {
            ...updateData,
            restaurants: {
                create: data.restaurantIds.map((rid: string) => ({
                    restaurantId: rid,
                    isPrimary: rid === data.primaryRestaurantId
                }))
            }
        }
    });

    revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
    await checkPermission(SYSTEM_PERMISSIONS.USERS_MANAGE);
    
    const targetUser = await prisma.user.findUnique({ where: { id: userId }});
    
    if (targetUser?.role === Role.SYSTEM_ARCHITECT) {
        throw new Error("Ne možete obrisati System Architect-a.");
    }

    await prisma.user.delete({ where: { id: userId } });
    revalidatePath("/admin/users");
}