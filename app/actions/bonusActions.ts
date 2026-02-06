"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { BonusState } from "@/lib/bonusLogic";
import { sanitize, defaultState, uid } from "@/lib/bonusLogic";

const BONUS_SHEET_NAME = "Default Bonus Sheet";

function getBonusSheetClient(): any | null {
  const anyPrisma = prisma as any;
  const model = anyPrisma?.bonusSheet;
  if (!model || typeof model.findFirst !== "function") {
    // Prisma client nije regenerisan za BonusSheet – fallback na in-memory state.
    return null;
  }
  return model;
}

export async function loadLatestBonusSheet(): Promise<BonusState> {
  const bonusSheet = getBonusSheetClient();
  if (!bonusSheet) {
    return defaultState();
  }

  const sheet = await bonusSheet.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (!sheet) {
    return defaultState();
  }

  return sanitize(sheet.data as any);
}

export async function saveBonusSheet(rawState: any, name?: string) {
  const state = sanitize(rawState);
  const sheetName = name && name.trim().length > 0 ? name.trim() : BONUS_SHEET_NAME;

  const bonusSheet = getBonusSheetClient();

  // Ako BonusSheet model još nije dostupan u Prisma clientu (npr. generate nije prošao),
  // samo preskoči DB upis da ne bi pukao modul – UI će i dalje raditi sa lokalnim state-om.
  if (!bonusSheet) {
    return;
  }

  // upsert() zahtijeva where sa UNIQUE poljem; u shemi je unique samo id, ne name.
  // Prvo tražimo po name, pa update ili create po id.
  const existing = await bonusSheet.findFirst({ where: { name: sheetName } });
  if (existing) {
    await bonusSheet.update({
      where: { id: existing.id },
      data: { data: state },
    });
  } else {
    await bonusSheet.create({
      data: {
        id: uid(),
        name: sheetName,
        data: state,
      },
    });
  }

  revalidatePath("/tools/bonusi");
}

/** Sync: dodaje samo NOVE radnike iz baze. Podaci postojećih radnika se ne mijenjaju. */
export async function syncEmployeesWithUsers(rawState: any): Promise<BonusState> {
  const state = sanitize(rawState);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: { department: true },
    orderBy: { name: "asc" },
  });

  const existingIds = new Set(state.employees.map((e: any) => e.id));
  const newUsers = users.filter((u) => !existingIds.has(u.id));

  const defaultFactors = { tenure: 1.0, size: 1.0, office: 1.0 };
  const defaultFulfill = { fin: [] as number[], ops: [] as number[], ind: [] as number[] };

  const newEmployees = newUsers.map((u) => {
    const deptName =
      u.department?.name === "RL" ||
      u.department?.name === "AL" ||
      u.department?.name === "Office" ||
      u.department?.name === "Finanz/Lohnbuchhaltung"
        ? u.department!.name
        : "RL";

    return {
      id: u.id,
      name: u.name || "Novi korisnik",
      dept: deptName,
      salary: 0,
      baseMonths: state.settings.baseMonths,
      factors: defaultFactors,
      fulfill: defaultFulfill,
    } as any;
  });

  (state as any).employees = [...state.employees, ...newEmployees];

  return sanitize(state);
}

