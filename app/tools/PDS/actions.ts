/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { PrismaClient, PDSStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();
const db = prisma as any;

// Spremanje šablona za specifičnu godinu
export async function savePDSTemplate(year: number, goals: any[], scale: any[]) {
  try {
    await db.pDSTemplate.upsert({
      where: { year: year },
      update: { goals, scale },
      create: { year, goals, scale }
    });
    revalidatePath('/tools/PDS');
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

// Generisanje PDS-ova za sve radnike za tu godinu
export async function createBulkPDS(managerId: string, year: number) {
  try {
    const template = await db.pDSTemplate.findUnique({ where: { year } });
    if (!template) return { success: false, error: "Prvo definišite pravila za ovu godinu!" };

    const employees = await prisma.user.findMany({ where: { isActive: true } });
    for (const emp of employees) {
      const exists = await db.pDS.findUnique({
        where: { userId_year: { userId: emp.id, year } }
      });

      if (!exists) {
        await db.pDS.create({
          data: {
            userId: emp.id,
            managerId,
            year,
            status: 'OPEN' as PDSStatus,
            goals: template.goals,
            scale: template.scale,
          }
        });
      }
    }
    revalidatePath('/tools/PDS');
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

// Brisanje svih zapisa za godinu
export async function deleteAllPDSForYear(year: number) {
  try {
    await db.pDS.deleteMany({ where: { year } });
    revalidatePath('/tools/PDS');
    return { success: true };
  } catch { return { success: false }; }
}

// Ažuriranje sadržaja pojedinačnog PDS-a
export async function updatePDSContent(pdsId: string, data: any) {
  try {
    const totalScore = data.goals.reduce((acc: number, g: any) => acc + (g.points || 0), 0);
    await db.pDS.update({
      where: { id: pdsId },
      data: {
        ...data,
        totalScore,
        goals: data.goals,
        scale: data.scale
      }
    });
    revalidatePath('/tools/PDS');
    return { success: true };
  } catch { return { success: false }; }
}

export async function changePDSStatus(pdsId: string, newStatus: PDSStatus) {
  try {
    await db.pDS.update({ where: { id: pdsId }, data: { status: newStatus } });
    revalidatePath('/tools/PDS');
    return { success: true };
  } catch { return { success: false }; }
}