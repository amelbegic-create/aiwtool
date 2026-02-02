/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import prisma from '@/lib/prisma';
import { PDSStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { PDSGoal, PDSScaleLevel } from '../tools/PDS/types';
import { cookies } from 'next/headers';

const db = prisma as any;

async function getActiveRestaurantId() {
  const cookieStore = await cookies();
  return cookieStore.get('activeRestaurantId')?.value;
}

/** Izračunaj konačnu ocjenu iz ukupnog broja bodova i skale (min–max = label). */
function getFinalGradeFromScale(totalScore: number, scale: PDSScaleLevel[] | null | undefined): string | null {
  if (!scale || !Array.isArray(scale) || scale.length === 0) return null;
  const level = scale.find((s) => totalScore >= s.min && totalScore <= s.max);
  return level ? level.label : null;
}

/** Kreiraj ili ažuriraj template za odabrane restorane; generiše PDS za zaposlenike. */
export async function createTemplate(
  year: number,
  restaurantIds: string[],
  goals: PDSGoal[],
  scale: PDSScaleLevel[],
  managerId: string
) {
  try {
    let targetRestaurantIds = restaurantIds;
    if (targetRestaurantIds.length === 0 || targetRestaurantIds.includes('all')) {
      const all = await prisma.restaurant.findMany({ where: { isActive: true }, select: { id: true } });
      targetRestaurantIds = all.map((r) => r.id);
    }

    const cleanGoals = goals.map((g) => ({
      ...g,
      type: g.type || 'NUMERIC',
      result: g.type === 'BOOLEAN' ? false : '',
      points: 0
    }));

    for (const restaurantId of targetRestaurantIds) {
      await db.pDSTemplate.upsert({
        where: { year_restaurantId: { year, restaurantId } },
        update: { goals: cleanGoals, scale },
        create: { year, restaurantId, goals: cleanGoals, scale }
      });
    }

    const restaurantUsers = await prisma.restaurantUser.findMany({
      where: { restaurantId: { in: targetRestaurantIds }, user: { isActive: true } },
      include: { user: true },
      orderBy: { user: { name: 'asc' } }
    });

    const userToRestaurant = new Map<string, string>();
    for (const ru of restaurantUsers) {
      if (!userToRestaurant.has(ru.userId)) {
        userToRestaurant.set(ru.userId, ru.restaurantId);
      }
    }

    let count = 0;
    for (const [userId, restaurantId] of userToRestaurant) {
      const existingPDS = await db.pDS.findUnique({
        where: { userId_year: { userId, year } }
      });

      if (!existingPDS) {
        await db.pDS.create({
          data: {
            userId,
            managerId,
            restaurantId,
            year,
            status: 'DRAFT',
            goals: cleanGoals,
            scale
          }
        });
        count++;
      } else if (['DRAFT', 'OPEN', 'RETURNED', 'IN_PROGRESS'].includes(existingPDS.status)) {
        await db.pDS.update({
          where: { id: existingPDS.id },
          data: { goals: cleanGoals, scale, restaurantId }
        });
      }
    }

    revalidatePath('/tools/PDS');
    return { success: true, count };
  } catch (error) {
    console.error('createTemplate Error:', error);
    return { success: false, error: 'Greška na serveru.' };
  }
}

export async function savePDSTemplate(
  year: number,
  goals: PDSGoal[],
  scale: PDSScaleLevel[],
  managerId: string
) {
  try {
    const restaurantId = await getActiveRestaurantId();
    if (!restaurantId) return { success: false, error: 'Nije odabran restoran!' };

    return createTemplate(year, [restaurantId], goals, scale, managerId);
  } catch (error) {
    console.error('Save Template Error:', error);
    return { success: false, error: 'Greška na serveru.' };
  }
}

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
    const cleanGoals = goals.map((g) => ({
      ...g,
      type: g.type || 'NUMERIC',
      result: g.type === 'BOOLEAN' ? false : '',
      points: 0
    }));

    for (const rel of restaurantUsers) {
      const emp = rel.user;
      const existingPDS = await db.pDS.findUnique({
        where: { userId_year: { userId: emp.id, year } }
      });

      if (!existingPDS) {
        await db.pDS.create({
          data: {
            userId: emp.id,
            managerId,
            restaurantId,
            year,
            status: 'DRAFT',
            goals: cleanGoals,
            scale
          }
        });
        count++;
      } else if (['DRAFT', 'OPEN', 'RETURNED', 'IN_PROGRESS'].includes(existingPDS.status)) {
        await db.pDS.update({
          where: { id: existingPDS.id },
          data: { goals: cleanGoals, scale }
        });
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
    const scale: PDSScaleLevel[] = data.scale || [];
    const finalGrade = getFinalGradeFromScale(totalScore, scale);

    const payload: any = {
      goals: data.goals,
      scale: data.scale,
      employeeComment: data.employeeComment,
      managerComment: data.managerComment,
      totalScore,
      finalGrade
    };
    if (data.employeeSignature !== undefined) payload.employeeSignature = data.employeeSignature;
    if (data.managerSignature !== undefined) payload.managerSignature = data.managerSignature;

    await db.pDS.update({
      where: { id: pdsId },
      data: payload
    });

    revalidatePath(`/tools/PDS/${pdsId}`);
    revalidatePath('/tools/PDS');
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function submitPDS(pdsId: string) {
  try {
    await db.pDS.update({ where: { id: pdsId }, data: { status: 'SUBMITTED' } });
    revalidatePath(`/tools/PDS/${pdsId}`);
    revalidatePath('/tools/PDS');
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function approvePDS(pdsId: string) {
  try {
    await db.pDS.update({ where: { id: pdsId }, data: { status: 'APPROVED' } });
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
    revalidatePath('/tools/PDS');
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

export type SignRole = 'employee' | 'manager';

/** Sprema samo canvas potpis (data URL slike). Oba potpisa = status COMPLETED. */
export async function saveSignatureImage(pdsId: string, role: SignRole, imageDataUrl: string) {
  try {
    if (!imageDataUrl || !imageDataUrl.startsWith('data:image')) {
      return { success: false, error: 'Potrebna je slika potpisa (canvas).' };
    }
    const pds = await db.pDS.findUnique({ where: { id: pdsId } });
    if (!pds) return { success: false, error: 'PDS nije pronađen.' };

    const update: any = role === 'employee'
      ? { employeeSignature: imageDataUrl }
      : { managerSignature: imageDataUrl };

    const updated = await db.pDS.update({
      where: { id: pdsId },
      data: update
    });

    const empSig = updated.employeeSignature ?? '';
    const mgrSig = updated.managerSignature ?? '';
    const bothCanvas = empSig.startsWith('data:image') && mgrSig.startsWith('data:image');

    if (bothCanvas) {
      const scale: PDSScaleLevel[] = updated.scale || [];
      const finalGrade = getFinalGradeFromScale(updated.totalScore, scale);
      await db.pDS.update({
        where: { id: pdsId },
        data: { status: 'COMPLETED', finalGrade }
      });
    }

    revalidatePath(`/tools/PDS/${pdsId}`);
    revalidatePath('/tools/PDS');
    return { success: true };
  } catch (error) {
    console.error('saveSignatureImage error:', error);
    return { success: false, error: 'Greška pri spremanju potpisa.' };
  }
}

export interface PDSExportRow {
  userName: string;
  restaurantName: string;
  finalGrade: string | null;
  totalScore: number;
}

export async function getGlobalPDSForExport(year: number): Promise<PDSExportRow[]> {
  const list = await prisma.pDS.findMany({
    where: { year },
    include: {
      user: { select: { name: true } },
      restaurant: { select: { name: true, code: true } }
    },
    orderBy: [{ restaurant: { name: 'asc' } }, { user: { name: 'asc' } }]
  });
  return list.map((p) => ({
    userName: p.user?.name ?? 'N/A',
    restaurantName: p.restaurant?.name ?? p.restaurant?.code ?? 'N/A',
    finalGrade: p.finalGrade ?? null,
    totalScore: p.totalScore ?? 0
  }));
}
