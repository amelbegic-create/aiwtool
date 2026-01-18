"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { revalidatePath } from "next/cache";
import { SYSTEM_PERMISSIONS } from "@/lib/constants";
import { Role } from "@prisma/client";

// --- POBOLJŠANI HELPER ZA PERMISIJE ---
// Sada čita rolu direktno iz baze, kao što smo popravili u adminActions
async function checkPermission(permission: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) throw new Error("Niste prijavljeni.");
    
    // Dohvaćamo svježe podatke iz baze da budemo 100% sigurni u rolu
    const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true, permissions: true }
    });

    if (!dbUser) throw new Error("Korisnik ne postoji.");

    const role = dbUser.role;
    const permissions = dbUser.permissions;
    
    const bosses: Role[] = [Role.SYSTEM_ARCHITECT, Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER];
    
    // 1. Ako je šef, pusti ga
    if (bosses.includes(role)) return true;

    // 2. Ako ima specifičnu permisiju, pusti ga
    if (permissions && permissions.includes(permission)) return true;

    throw new Error("Nemate permisiju za ovu radnju.");
}

// --- BLOKIRANI DANI ---

export async function addBlockedDay(date: string, reason: string) {
    await checkPermission(SYSTEM_PERMISSIONS.SETTINGS_MANAGE);
    
    // Uzimamo prvi restoran kao default ako user nema restoran (fallback)
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!userEmail) throw new Error("Greška u sesiji.");

    const user = await prisma.user.findUnique({
        where: { email: userEmail },
        include: { restaurants: true }
    });

    const targetRestaurantId = user?.restaurants[0]?.restaurantId;
    let finalRestaurantId = targetRestaurantId;

    if (!finalRestaurantId) {
        const firstRest = await prisma.restaurant.findFirst();
        if(!firstRest) throw new Error("Nema restorana u sistemu.");
        finalRestaurantId = firstRest.id;
    } 

    await prisma.blockedDay.create({
        data: { date, reason, restaurantId: finalRestaurantId! }
    });
    
    revalidatePath("/tools/vacations");
}

export async function removeBlockedDay(id: string) {
    await checkPermission(SYSTEM_PERMISSIONS.SETTINGS_MANAGE);
    await prisma.blockedDay.delete({ where: { id } });
    revalidatePath("/tools/vacations");
}

// --- UPRAVLJANJE ZAHTJEVIMA ---

// Helper za izračun dana
async function calculateVacationDays(start: string, end: string) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const blockedDays = await prisma.blockedDay.findMany();
    const blockedDates = blockedDays.map(b => b.date); 

    let totalDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay(); 
        const dateString = currentDate.toISOString().split('T')[0];

        // 0 = Nedjelja, 6 = Subota. Brojimo samo radne dane koji nisu blokirani.
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !blockedDates.includes(dateString)) {
            totalDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return totalDays;
}

export async function createVacationRequest(data: { start: string, end: string }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) throw new Error("Niste prijavljeni.");
    
    // Sigurniji dohvat ID-a preko emaila
    const user = await prisma.user.findUnique({ where: { email: session.user.email }});
    if (!user) throw new Error("Korisnik nije pronađen.");

    const totalDays = await calculateVacationDays(data.start, data.end);
    if (totalDays === 0) throw new Error("Odabrani period nema radnih dana.");

    await prisma.vacationRequest.create({
        data: {
            userId: user.id,
            start: data.start,
            end: data.end,
            days: totalDays,
            status: "PENDING"
        }
    });
    revalidatePath("/tools/vacations");
}

// Funkcija za radnika da ažurira zahtjev (ako je bio RETURNED)
export async function updateVacationRequest(id: string, data: { start: string, end: string }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) throw new Error("Niste prijavljeni.");

    const user = await prisma.user.findUnique({ where: { email: session.user.email }});
    if (!user) throw new Error("Greška.");

    const request = await prisma.vacationRequest.findUnique({ where: { id } });
    if (!request) throw new Error("Zahtjev nije pronađen.");
    if (request.userId !== user.id) throw new Error("Nije vaš zahtjev.");

    const totalDays = await calculateVacationDays(data.start, data.end);
    if (totalDays === 0) throw new Error("Odabrani period nema radnih dana.");

    await prisma.vacationRequest.update({
        where: { id },
        data: {
            start: data.start,
            end: data.end,
            days: totalDays,
            status: "PENDING" // Vraća se u pending za admina
        }
    });
    revalidatePath("/tools/vacations");
}

// Admin mijenja status (APPROVED, REJECTED, RETURNED)
export async function updateVacationStatus(requestId: string, status: string) {
    await checkPermission(SYSTEM_PERMISSIONS.VACATION_APPROVE);
    await prisma.vacationRequest.update({ where: { id: requestId }, data: { status } });
    revalidatePath("/tools/vacations");
}

// Radnik otkazuje odobreni zahtjev
export async function cancelVacationRequest(requestId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) throw new Error("Niste prijavljeni.");

    const user = await prisma.user.findUnique({ where: { email: session.user.email }});
    if (!user) throw new Error("Greška.");

    const request = await prisma.vacationRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error("Zahtjev nije pronađen.");
    if (request.userId !== user.id) throw new Error("Nije vaš zahtjev.");

    // Može se otkazati samo ako je APPROVED ili PENDING
    if (request.status !== "APPROVED" && request.status !== "PENDING") {
        throw new Error("Ne možete otkazati ovaj zahtjev.");
    }

    await prisma.vacationRequest.update({
        where: { id: requestId },
        data: { status: "CANCELLED" }
    });
    revalidatePath("/tools/vacations");
}

export async function deleteVacationRequest(requestId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) throw new Error("Niste prijavljeni.");

    const user = await prisma.user.findUnique({ where: { email: session.user.email }});
    if (!user) throw new Error("Greška.");

    const request = await prisma.vacationRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error("Zahtjev ne postoji.");
    
    const bosses: Role[] = [Role.ADMIN, Role.SYSTEM_ARCHITECT, Role.SUPER_ADMIN, Role.MANAGER];
    const isAdmin = bosses.includes(user.role);
    
    if (!isAdmin && request.userId !== user.id) throw new Error("Nije vaš zahtjev.");

    await prisma.vacationRequest.delete({ where: { id: requestId } });
    revalidatePath("/tools/vacations");
}