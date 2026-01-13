/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { PrismaClient, PDSStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { PDSGoal, PDSScaleLevel } from './types';

const prisma = new PrismaClient();
const db = prisma as any;

export async function savePDSTemplate(year: number, goals: PDSGoal[], scale: PDSScaleLevel[]) {
  try {
    await db.pDSTemplate.upsert({
      where: { year: year },
      update: { goals, scale },
      create: { year, goals, scale }
    });
    revalidatePath('/tools/PDS');
    return { success: true };
  } catch (error) {
    console.error("Save Template Error:", error);
    return { success: false };
  }
}

export async function createBulkPDS(managerId: string, year: number) {
  try {
    const template = await db.pDSTemplate.findUnique({ where: { year } });
    if (!template) return { success: false, error: "Prvo definišite pravila za ovu godinu!" };

    // Dohvati samo aktivne korisnike
    const employees = await prisma.user.findMany({ where: { isActive: true } });
    
    let createdCount = 0;

    for (const emp of employees) {
      const exists = await db.pDS.findUnique({
        where: { userId_year: { userId: emp.id, year } }
      });

      if (!exists) {
        // Resetuj rezultate kod novog generisanja
        const cleanGoals = (template.goals as PDSGoal[]).map(g => ({
            ...g,
            result: "",
            points: 0
        }));

        await db.pDS.create({
          data: {
            userId: emp.id,
            managerId,
            year,
            status: 'OPEN' as PDSStatus,
            goals: cleanGoals,
            scale: template.scale,
          }
        });
        createdCount++;
      }
    }
    revalidatePath('/tools/PDS');
    return { success: true, count: createdCount };
  } catch (error) {
    console.error("Bulk Create Error:", error);
    return { success: false };
  }
}

export async function deleteAllPDSForYear(year: number) {
  try {
    await db.pDS.deleteMany({ where: { year } });
    revalidatePath('/tools/PDS');
    return { success: true };
  } catch { return { success: false }; }
}

export async function updatePDSContent(pdsId: string, data: any) {
  try {
    // Ponovni proračun total score-a na serveru radi sigurnosti
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