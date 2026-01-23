/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import prisma from '@/lib/prisma';
import { PDSStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { PDSGoal, PDSScaleLevel } from '../tools/PDS/types';
import { cookies } from 'next/headers';

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
    const restaurantId = await getActiveRestaurantId();
    if (!restaurantId) return { success: false, error: 'Nije odabran restoran!' };

    await db.pDSTemplate.upsert({
      where: { year_restaurantId: { year, restaurantId } },
      update: { goals, scale },
      create: { year, restaurantId, goals, scale }
    });

    const restaurantUsers = await prisma.restaurantUser.findMany({
      where: { restaurantId, user: { isActive: true } },
      include: { user: true }
    });

    if (restaurantUsers.length === 0) {
      return { success: true, count: 0, message: 'Pravila spremljena, ali nema korisnika u restoranu.' };
    }

    let count = 0;

    for (const rel of restaurantUsers) {
      const emp = rel.user;

      const existingPDS = await db.pDS.findUnique({
        where: { userId_year: { userId: emp.id, year } }
      });

      const cleanGoals = goals.map((g) => ({
        ...g,
        type: g.type || 'NUMERIC',
        result: g.type === 'BOOLEAN' ? false : '',
        points: 0
      }));

      if (!existingPDS) {
        await db.pDS.create({
          data: {
            userId: emp.id,
            managerId,
            restaurantId,
            year,
            status: 'OPEN',
            goals: cleanGoals,
            scale
          }
        });
        count++;
      } else {
        if (['DRAFT', 'OPEN', 'RETURNED'].includes(existingPDS.status)) {
          await db.pDS.update({
            where: { id: existingPDS.id },
            data: { goals: cleanGoals, scale }
          });
        }
      }
    }

    revalidatePath('/tools/PDS');
    return { success: true, count };
  } catch (error) {
    console.error('Save Template Error:', error);
    return { success: false, error: 'Greška na serveru.' };
  }
}

// Bulk generiše PDS-ove iz već snimljenog template-a
export async function createBulkPDS(year: number, managerId: string) {
  try {
    const restaurantId = await getActiveRestaurantId();
    if (!restaurantId) return { success: false, error: 'Nije odabran restoran!' };

    const tpl = await db.pDSTemplate.findUnique({
      where: { year_restaurantId: { year, restaurantId } }
    });

    if (!tpl) return { success: false, error: 'Nema PDS template-a za ovu godinu i restoran.' };

    const goals: PDSGoal[] = tpl.goals || [];
    const scale: PDSScaleLevel[] = tpl.scale || [];

    const restaurantUsers = await prisma.restaurantUser.findMany({
      where: { restaurantId, user: { isActive: true } },
      include: { user: true }
    });

    if (restaurantUsers.length === 0) {
      return { success: true, count: 0, message: 'Nema korisnika u restoranu.' };
    }

    let count = 0;

    for (const rel of restaurantUsers) {
      const emp = rel.user;

      const existingPDS = await db.pDS.findUnique({
        where: { userId_year: { userId: emp.id, year } }
      });

      const cleanGoals = goals.map((g) => ({
        ...g,
        type: g.type || 'NUMERIC',
        result: g.type === 'BOOLEAN' ? false : '',
        points: 0
      }));

      if (!existingPDS) {
        await db.pDS.create({
          data: {
            userId: emp.id,
            managerId,
            restaurantId,
            year,
            status: 'OPEN',
            goals: cleanGoals,
            scale
          }
        });
        count++;
      } else {
        if (['DRAFT', 'OPEN', 'RETURNED'].includes(existingPDS.status)) {
          await db.pDS.update({
            where: { id: existingPDS.id },
            data: { goals: cleanGoals, scale }
          });
        }
      }
    }

    revalidatePath('/tools/PDS');
    return { success: true, count };
  } catch (error) {
    console.error('createBulkPDS error:', error);
    return { success: false, error: 'Greška na serveru.' };
  }
}

export async function deleteAllPDSForYear(year: number) {
  try {
    const restaurantId = await getActiveRestaurantId();
    if (!restaurantId) return { success: false };

    await db.pDS.deleteMany({ where: { year, restaurantId } });
    revalidatePath('/tools/PDS');
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function updatePDSContent(pdsId: string, data: any) {
  try {
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
  } catch {
    return { success: false };
  }
}

export async function changePDSStatus(pdsId: string, newStatus: PDSStatus) {
  try {
    await db.pDS.update({ where: { id: pdsId }, data: { status: newStatus } });
    revalidatePath(`/tools/PDS/${pdsId}`);
    return { success: true };
  } catch {
    return { success: false };
  }
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
  } catch {
    return { success: false };
  }
}
