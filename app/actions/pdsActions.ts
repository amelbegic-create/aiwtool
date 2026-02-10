/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import prisma from '@/lib/prisma';
import { PDSStatus, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { PDSGoal, PDSScaleLevel } from '../tools/PDS/types';
import { cookies } from 'next/headers';

const db = prisma as any;

/** Samo SYSTEM_ARCHITECT, SUPER_ADMIN i ADMIN smiju generisati (kreirati) PDS. Manageri samo popunjavaju. */
const PDS_CREATE_ROLES = new Set(['SYSTEM_ARCHITECT', 'SUPER_ADMIN', 'ADMIN']);

async function requirePdsCreateRole() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) throw new Error('Sie sind nicht angemeldet.');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || !PDS_CREATE_ROLES.has(String(user.role))) {
    throw new Error('Nicht berechtigt: Nur ADMIN (oder System Architect / Super Admin) können PDS-Vorlagen erstellen.');
  }
}

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

type RestaurantSelect = { id: string; name: string | null; code: string };
type TemplateWithRestaurants = { id: string; title: string; year: number; isGlobal: boolean; isActive: boolean; goals: Prisma.JsonValue; scale: Prisma.JsonValue; createdAt: Date; restaurants: RestaurantSelect[] };

/** Lista svih PDS templatea za Admin (za listu u /admin/pds). */
export async function listPDSTemplatesForAdmin() {
  await requirePdsCreateRole();
  const list = await db.pDSTemplate.findMany({
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    include: { restaurants: { select: { id: true, name: true, code: true } } }
  }) as TemplateWithRestaurants[];
  return list.map((t) => ({
    id: t.id,
    title: t.title,
    year: t.year,
    isGlobal: t.isGlobal,
    isActive: t.isActive,
    goals: t.goals,
    scale: t.scale,
    restaurantIds: t.restaurants.map((r: RestaurantSelect) => r.id),
    restaurantNames: t.restaurants.map((r: RestaurantSelect) => r.name || r.code || r.id),
    createdAt: t.createdAt
  }));
}

/** Jedan PDS template po ID (za edit formu). */
export async function getPDSTemplateById(id: string) {
  await requirePdsCreateRole();
  const t = await prisma.pDSTemplate.findUnique({
    where: { id },
    include: { restaurants: { select: { id: true, name: true, code: true } } }
  });
  if (!t) return null;
  return {
    id: t.id,
    title: t.title,
    year: t.year,
    isGlobal: t.isGlobal,
    isActive: t.isActive,
    goals: (t.goals ?? []) as unknown as PDSGoal[],
    scale: (t.scale ?? []) as unknown as PDSScaleLevel[],
    restaurantIds: t.restaurants.map((r) => r.id),
    restaurantNames: t.restaurants.map((r) => r.name || r.code || r.id)
  };
}

/** Ažuriraj postojeći PDS template (ciljani restorani + pitanja). */
export async function updatePDSTemplate(
  id: string,
  params: { title: string; year: number; isGlobal: boolean; restaurantIds: string[]; goals: PDSGoal[]; scale: PDSScaleLevel[] }
) {
  try {
    await requirePdsCreateRole();
    const { title, year, isGlobal, restaurantIds, goals, scale } = params;

    const cleanGoals = goals.map((g) => ({
      ...g,
      type: g.type || 'NUMERIC',
      result: g.type === 'BOOLEAN' ? false : '',
      points: 0
    }));

    let targetRestaurantIds: string[] = [];
    if (isGlobal) {
      const all = await prisma.restaurant.findMany({ where: { isActive: true }, select: { id: true } });
      targetRestaurantIds = all.map((r) => r.id);
    } else {
      targetRestaurantIds = restaurantIds.filter(Boolean);
      if (targetRestaurantIds.length === 0) {
        return { success: false as const, error: 'Bitte wählen Sie mindestens ein Restaurant oder aktivieren Sie „Alle Restaurants“.' };
      }
    }

    await db.pDSTemplate.update({
      where: { id },
      data: {
        title: title.trim() || `PDS ${year}`,
        year,
        isGlobal,
        goals: cleanGoals as unknown as Prisma.InputJsonValue,
        scale: scale as unknown as Prisma.InputJsonValue,
        restaurants: { set: targetRestaurantIds.map((rid) => ({ id: rid })) }
      }
    });

    revalidatePath('/admin/pds');
    revalidatePath('/tools/PDS');
    return { success: true as const };
  } catch (error) {
    console.error('updatePDSTemplate Error:', error);
    return { success: false as const, error: 'Serverfehler.' };
  }
}

/** Obriši PDS template (ne briše postojeće PDS zapisnike). */
export async function deletePDSTemplate(id: string) {
  try {
    await requirePdsCreateRole();
    await db.pDSTemplate.delete({ where: { id } });
    revalidatePath('/admin/pds');
    revalidatePath('/tools/PDS');
    return { success: true as const };
  } catch {
    return { success: false as const, error: 'Fehler beim Löschen.' };
  }
}

/** Dohvati template za restoran i godinu (za prikaz radniku): isGlobal ILI restoran u listi. */
export async function getTemplateForRestaurantAndYear(restaurantId: string, year: number) {
  const template = await db.pDSTemplate.findFirst({
    where: {
      year,
      isActive: true,
      OR: [
        { isGlobal: true },
        { restaurants: { some: { id: restaurantId } } }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });
  return template;
}

/** Kreiraj novi PDS obrazac (jedan red) i generiši PDS za sve ciljane restorane. */
export async function createPDSTemplate(params: {
  title: string;
  year: number;
  isGlobal: boolean;
  restaurantIds: string[];
  goals: PDSGoal[];
  scale: PDSScaleLevel[];
  managerId: string;
}) {
  try {
    await requirePdsCreateRole();
    const { title, year, isGlobal, restaurantIds, goals, scale, managerId } = params;

    const cleanGoals = goals.map((g) => ({
      ...g,
      type: g.type || 'NUMERIC',
      result: g.type === 'BOOLEAN' ? false : '',
      points: 0
    }));

    let targetRestaurantIds: string[] = [];
    if (isGlobal) {
      const all = await prisma.restaurant.findMany({ where: { isActive: true }, select: { id: true } });
      targetRestaurantIds = all.map((r) => r.id);
    } else {
      targetRestaurantIds = restaurantIds.filter(Boolean);
      if (targetRestaurantIds.length === 0) {
        return { success: false as const, error: 'Bitte wählen Sie mindestens ein Restaurant oder aktivieren Sie „Alle Restaurants“.' };
      }
    }

    const template = await db.pDSTemplate.create({
      data: {
        title: title.trim() || `PDS ${year}`,
        year,
        isGlobal,
        isActive: true,
        goals: cleanGoals as unknown as Prisma.InputJsonValue,
        scale: scale as unknown as Prisma.InputJsonValue,
        restaurants: { connect: targetRestaurantIds.map((id) => ({ id })) }
      }
    });

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
      const existingPDS = await prisma.pDS.findUnique({
        where: { userId_year: { userId, year } }
      });

      if (!existingPDS) {
        await db.pDS.create({
          data: {
            userId,
            managerId,
            restaurantId,
            year,
            templateId: template.id,
            status: 'DRAFT',
            goals: cleanGoals as unknown as Prisma.InputJsonValue,
            scale: scale as unknown as Prisma.InputJsonValue
          }
        });
        count++;
      } else if (['DRAFT', 'OPEN', 'RETURNED', 'IN_PROGRESS'].includes(existingPDS.status)) {
        await db.pDS.update({
          where: { id: existingPDS.id },
          data: { goals: cleanGoals as unknown as Prisma.InputJsonValue, scale: scale as unknown as Prisma.InputJsonValue, restaurantId, templateId: template.id }
        });
      }
    }

    revalidatePath('/tools/PDS');
    revalidatePath('/admin/pds');
    return { success: true as const, templateId: template.id, count };
  } catch (error) {
    console.error('createPDSTemplate Error:', error);
    return { success: false as const, error: 'Serverfehler.' };
  }
}

/** Kreiraj ili ažuriraj template za odabrane restorane; generiše PDS za zaposlenike. (Legacy / iz SettingsModal.) */
export async function createTemplate(
  year: number,
  restaurantIds: string[],
  goals: PDSGoal[],
  scale: PDSScaleLevel[],
  managerId: string
) {
  const isGlobal = restaurantIds.length === 0 || restaurantIds.includes('all');
  const list = await createPDSTemplate({
    title: `PDS ${year}`,
    year,
    isGlobal,
    restaurantIds: isGlobal ? [] : restaurantIds,
    goals,
    scale,
    managerId
  });
  return list;
}

export async function savePDSTemplate(
  year: number,
  goals: PDSGoal[],
  scale: PDSScaleLevel[],
  managerId: string
) {
  try {
    const restaurantId = await getActiveRestaurantId();
    if (!restaurantId) return { success: false, error: 'Kein Restaurant ausgewählt!' };

    return createTemplate(year, [restaurantId], goals, scale, managerId);
  } catch (error) {
    console.error('Save Template Error:', error);
    return { success: false, error: 'Serverfehler.' };
  }
}

export async function createBulkPDS(year: number, managerId: string) {
  try {
    await requirePdsCreateRole();
    const restaurantId = await getActiveRestaurantId();
    if (!restaurantId) return { success: false, error: 'Kein Restaurant ausgewählt!' };

    const tpl = await getTemplateForRestaurantAndYear(restaurantId, year);

    if (!tpl) return { success: false, error: 'Nema PDS template-a za ovu godinu i restoran.' };

    const goals: PDSGoal[] = (tpl.goals ?? []) as unknown as PDSGoal[];
    const scale: PDSScaleLevel[] = (tpl.scale ?? []) as unknown as PDSScaleLevel[];

    const restaurantUsers = await prisma.restaurantUser.findMany({
      where: { restaurantId, user: { isActive: true } },
      include: { user: true }
    });

    if (restaurantUsers.length === 0) {
      return { success: true, count: 0, message: 'Keine Mitarbeiter im Restaurant.' };
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
            goals: cleanGoals as unknown as Prisma.InputJsonValue,
            scale: scale as unknown as Prisma.InputJsonValue
          }
        });
        count++;
      } else if (['DRAFT', 'OPEN', 'RETURNED', 'IN_PROGRESS'].includes(existingPDS.status)) {
        await db.pDS.update({
          where: { id: existingPDS.id },
          data: { goals: cleanGoals as unknown as Prisma.InputJsonValue, scale: scale as unknown as Prisma.InputJsonValue }
        });
      }
    }

    revalidatePath('/tools/PDS');
    return { success: true, count };
  } catch (error) {
    console.error('createBulkPDS error:', error);
    return { success: false, error: 'Serverfehler.' };
  }
}

export async function deleteAllPDSForYear(year: number) {
  try {
    await requirePdsCreateRole();
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
      return { success: false, error: 'Unterschriftsbild (Canvas) erforderlich.' };
    }
    const pds = await db.pDS.findUnique({ where: { id: pdsId } });
    if (!pds) return { success: false, error: 'PDS nicht gefunden.' };

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
    return { success: false, error: 'Fehler beim Speichern der Unterschrift.' };
  }
}

export interface PDSExportRow {
  userName: string;
  restaurantName: string;
  finalGrade: string | null;
  totalScore: number;
}

export async function getGlobalPDSForExport(year: number): Promise<PDSExportRow[]> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const where: { year: number; restaurantId?: { in: string[] } } = { year };
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, restaurants: { select: { restaurantId: true } } },
    });
    if (user?.role === 'MANAGER' && user.restaurants?.length) {
      where.restaurantId = { in: user.restaurants.map((r) => r.restaurantId) };
    }
  }
  const list = await prisma.pDS.findMany({
    where,
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
