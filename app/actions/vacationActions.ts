"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import { SYSTEM_PERMISSIONS } from "@/lib/constants";
import { Role } from "@prisma/client";

// Helper za permisije
async function checkPermission(permission: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Niste prijavljeni.");
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = session.user as any; 
    const role = user.role as Role;
    
    const bosses: Role[] = [Role.SYSTEM_ARCHITECT, Role.SUPER_ADMIN, Role.ADMIN];
    if (bosses.includes(role)) return true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((user as any).permissions && (user as any).permissions.includes(permission)) return true;

    throw new Error("Nemate permisiju.");
}

// --- BLOKIRANI DANI ---

export async function addBlockedDay(date: string, reason: string) {
    await checkPermission(SYSTEM_PERMISSIONS.SETTINGS_MANAGE);
    
    const session = await getServerSession(authOptions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionUserId = (session?.user as any).id;

    const user = await prisma.user.findUnique({
        where: { id: sessionUserId },
        include: { restaurants: true }
    });

    // Uzmi prvi restoran kojem ovaj admin pripada
    const targetRestaurantId = user?.restaurants[0]?.restaurantId;

    if (!targetRestaurantId) {
        // Fallback za System Architecta ako nema dodijeljen restoran
        const firstRest = await prisma.restaurant.findFirst();
        if(!firstRest) throw new Error("Nema restorana u sistemu.");
        
        await prisma.blockedDay.create({
            data: { date, reason, restaurantId: firstRest.id }
        });
    } else {
        await prisma.blockedDay.create({
            data: { date, reason, restaurantId: targetRestaurantId }
        });
    }
    revalidatePath("/tools/vacations");
}

export async function removeBlockedDay(id: string) {
    await checkPermission(SYSTEM_PERMISSIONS.SETTINGS_MANAGE);
    await prisma.blockedDay.delete({ where: { id } });
    revalidatePath("/tools/vacations");
}

// --- KREIRANJE ZAHTJEVA ---

export async function createVacationRequest(data: { start: string, end: string }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Niste prijavljeni.");
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session.user as any).id;

    const startDate = new Date(data.start);
    const endDate = new Date(data.end);
    
    // Dohvati praznike
    const blockedDays = await prisma.blockedDay.findMany();
    const blockedDates = blockedDays.map(b => b.date); 

    let totalDays = 0;
    // FIX: Koristimo const jer objekt (Date) mutiramo, ne reasiramo varijablu
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay(); 
        const dateString = currentDate.toISOString().split('T')[0];

        // Ako nije vikend I nije praznik
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !blockedDates.includes(dateString)) {
            totalDays++;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }

    if (totalDays === 0) throw new Error("Odabrani period nema radnih dana.");

    await prisma.vacationRequest.create({
        data: {
            userId: userId,
            start: data.start,
            end: data.end,
            days: totalDays,
            // FIX: Uklonjen realDays jer ne postoji u šemi
            status: "PENDING"
        }
    });
    revalidatePath("/tools/vacations");
}

export async function updateVacationStatus(requestId: string, status: "APPROVED" | "REJECTED") {
    await checkPermission(SYSTEM_PERMISSIONS.VACATION_APPROVE);
    await prisma.vacationRequest.update({ where: { id: requestId }, data: { status } });
    revalidatePath("/tools/vacations");
}

export async function deleteVacationRequest(requestId: string) {
    const session = await getServerSession(authOptions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session?.user as any).id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = (session?.user as any).role as Role;

    const request = await prisma.vacationRequest.findUnique({ where: { id: requestId } });
    
    if (!request) throw new Error("Zahtjev ne postoji.");
    
    const bosses: Role[] = [Role.ADMIN, Role.SYSTEM_ARCHITECT, Role.SUPER_ADMIN];
    const isAdmin = bosses.includes(role);
    
    if (!isAdmin && request.userId !== userId) throw new Error("Nije vaš zahtjev.");

    await prisma.vacationRequest.delete({ where: { id: requestId } });
    revalidatePath("/tools/vacations");
}