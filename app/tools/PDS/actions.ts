/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { PrismaClient, PDSStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { PDSGoal, PDSScaleLevel } from './types';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();
const db = prisma as any;

// Helper: Dohvati aktivni restoran
async function getActiveRestaurantId() {
  const cookieStore = await cookies();
  return cookieStore.get('activeRestaurantId')?.value;
}

// --- GLAVNA FUNKCIJA: SPREMI I GENERIRAJ ---
export async function savePDSTemplate(
  year: number, 
  goals: PDSGoal[], 
  scale: PDSScaleLevel[],
  managerId: string
) {
  try {
    // 1. Provjera restorana
    const restaurantId = await getActiveRestaurantId();
    if (!restaurantId) return { success: false, error: "Nije odabran restoran!" };

    console.log(`Spremanje PDS-a za Restoran: ${restaurantId}, Godina: ${year}`);

    // 2. Spremi Template
    await db.pDSTemplate.upsert({
      where: { 
        year_restaurantId: { year, restaurantId }
      },
      update: { goals, scale },
      create: { year, restaurantId, goals, scale }
    });

    // 3. AUTO-GENERIRANJE
    // Nađi sve ljude koji su dodijeljeni OVOM restoranu
    const restaurantUsers = await prisma.restaurantUser.findMany({
        where: { restaurantId: restaurantId, user: { isActive: true } },
        include: { user: true }
    });

    if (restaurantUsers.length === 0) {
        console.log("Nema korisnika u ovom restoranu.");
        return { success: true, count: 0, message: "Pravila spremljena, ali nema korisnika u restoranu." };
    }

    let count = 0;

    for (const rel of restaurantUsers) {
        const emp = rel.user;
        
        // Provjeri postoji li već PDS
        const existingPDS = await db.pDS.findUnique({
            where: { userId_year: { userId: emp.id, year } }
        });

        // Resetiraj ciljeve za korisnika na osnovu novih pravila
        const cleanGoals = goals.map(g => ({
            ...g,
            type: g.type || 'NUMERIC',
            // Ako je boolean, default je false (NE), ako je numeric onda prazno
            result: g.type === 'BOOLEAN' ? false : "",
            points: 0 // Reset bodova
        }));

        if (!existingPDS) {
            // KREIRAJ NOVI
            await db.pDS.create({
                data: {
                    userId: emp.id,
                    managerId,
                    restaurantId, // Vežemo PDS za ovaj restoran
                    year,
                    status: 'OPEN',
                    goals: cleanGoals,
                    scale: scale,
                }
            });
            count++;
        } else {
            // AŽURIRAJ POSTOJEĆI (Ako nije zaključen)
            if (['DRAFT', 'OPEN', 'RETURNED'].includes(existingPDS.status)) {
                await db.pDS.update({
                    where: { id: existingPDS.id },
                    data: { 
                        goals: cleanGoals, 
                        scale: scale 
                    } 
                });
            }
        }
    }

    revalidatePath('/tools/PDS');
    return { success: true, count };
  } catch (error) {
    console.error("Save Template Error:", error);
    return { success: false, error: "Greška na serveru." };
  }
}

// Brisanje svih PDS-ova za godinu i restoran
export async function deleteAllPDSForYear(year: number) {
  try {
    const restaurantId = await getActiveRestaurantId();
    if (!restaurantId) return { success: false };

    // Briše samo za ovaj restoran
    await db.pDS.deleteMany({ where: { year, restaurantId } });
    revalidatePath('/tools/PDS');
    return { success: true };
  } catch { return { success: false }; }
}

// Ažuriranje sadržaja (kad radnik/manager unosi podatke)
export async function updatePDSContent(pdsId: string, data: any) {
  try {
    // Sigurnosni izračun ukupnih bodova na serveru
    const totalScore = data.goals.reduce((acc: number, g: any) => acc + (Number(g.points) || 0), 0);
    
    await db.pDS.update({
      where: { id: pdsId },
      data: {
        ...data,
        totalScore,
        goals: data.goals,
        scale: data.scale
      }
    });
    revalidatePath(`/tools/PDS/${pdsId}`);
    revalidatePath('/tools/PDS');
    return { success: true };
  } catch { return { success: false }; }
}

export async function changePDSStatus(pdsId: string, newStatus: PDSStatus) {
  try {
    await db.pDS.update({ where: { id: pdsId }, data: { status: newStatus } });
    revalidatePath(`/tools/PDS/${pdsId}`);
    return { success: true };
  } catch { return { success: false }; }
}

export async function returnPDS(pdsId: string, comment?: string) {
    try {
        await db.pDS.update({
            where: { id: pdsId },
            data: { status: 'RETURNED', managerComment: comment }
        });
        revalidatePath(`/tools/PDS/${pdsId}`);
        revalidatePath('/tools/PDS');
        return { success: true };
    } catch { return { success: false }; }
}