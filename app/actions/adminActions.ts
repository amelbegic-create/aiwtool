"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/access";
import { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type VacationAllowanceRow = { year: number; days: number };

type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
  departmentId?: string | null;
  permissions?: string[];
  restaurantIds?: string[];
  primaryRestaurantId?: string | null;
  supervisorId?: string | null;
  vacationEntitlement?: number;
  vacationCarryover?: number;
  vacationAllowances?: VacationAllowanceRow[];
};

type UpdateUserInput = {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  departmentId?: string | null;
  permissions?: string[];
  restaurantIds?: string[];
  primaryRestaurantId?: string | null;
  supervisorId?: string | null;
  vacationEntitlement?: number;
  vacationCarryover?: number;
  vacationAllowances?: VacationAllowanceRow[];
};

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

// --- ROLE HIJERARHIJA (1-5) ---
// 1. SYSTEM_ARCHITECT (Root) - nema nadređenog
// 2. SUPER_ADMIN (Abteilungsleiter) - nema nadređenog
// 3. MANAGER (Restaurant Manager) - mora imati nadređenog
// 4. ADMIN (Management) - mora imati nadređenog
// 5. CREW (Office/Crew) - mora imati nadređenog
function roleRank(role: Role): number {
  switch (role) {
    case "SYSTEM_ARCHITECT":
      return 1;
    case "SUPER_ADMIN":
      return 2;
    case "MANAGER":
      return 3;
    case "ADMIN":
      return 4;
    case "CREW":
      return 5;
    default:
      return 99;
  }
}

function roleRequiresSupervisor(role: Role) {
  return roleRank(role) >= 3;
}

async function validateAndResolveSupervisorId(args: {
  role: Role;
  supervisorId: string | null;
  selfId?: string | null;
}) {
  const { role, supervisorId, selfId } = args;

  // Role 1/2 nikad nemaju nadređenog
  if (!roleRequiresSupervisor(role)) return null;

  // Ako nije odabran nadređeni: dozvoli samo ako u bazi nema nijednog mogućeg nadređenog (npr. prvi korisnik)
  if (!supervisorId || supervisorId.trim() === "") {
    const possibleSupervisors = await prisma.user.count({
      where: {
        isActive: true,
        ...(selfId ? { id: { not: selfId } } : {}),
        role: { in: ["SYSTEM_ARCHITECT", "SUPER_ADMIN", "MANAGER", "ADMIN"] },
      },
    });
    if (possibleSupervisors > 0) {
      throw new Error("Za odabranu rolu nadređeni je obavezan.");
    }
    return null;
  }

  if (selfId && supervisorId === selfId) {
    throw new Error("Korisnik ne može sam sebi biti nadređeni.");
  }

  const sup = await prisma.user.findUnique({
    where: { id: supervisorId },
    select: { id: true, role: true, isActive: true },
  });

  if (!sup) throw new Error("Odabrani nadređeni ne postoji.");
  if (sup.isActive === false) throw new Error("Odabrani nadređeni nije aktivan.");

  const supRank = roleRank(sup.role);
  const meRank = roleRank(role);

  if (!(supRank < meRank)) {
    throw new Error("Odabrani nadređeni mora imati višu rolu od korisnika.");
  }

  return sup.id;
}

export async function createUser(input: CreateUserInput) {
  try {
    await requirePermission("users:manage");
  } catch (e) {
    throw e instanceof Error ? e : new Error("Nemate permisije za kreiranje korisnika.");
  }

  const email = normalizeEmail(input.email);
  if (!input.name?.trim()) throw new Error("Ime i prezime su obavezni.");
  if (!email) throw new Error("Email je obavezan.");
  if (!input.password) throw new Error("Lozinka je obavezna.");

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new Error("Korisnik sa ovim emailom već postoji.");

  const passwordHash = await bcrypt.hash(input.password, 10);
  const restaurantIds = Array.isArray(input.restaurantIds) ? input.restaurantIds : [];

  const supervisorIdFinal = await validateAndResolveSupervisorId({
    role: input.role,
    supervisorId: input.supervisorId ?? null,
    selfId: null,
  });

  let created: { id: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: input.name.trim(),
          email,
          password: passwordHash,
          role: input.role,
          departmentId: input.departmentId ?? null,
          permissions: Array.isArray(input.permissions) ? input.permissions : [],
          supervisorId: supervisorIdFinal,
          vacationEntitlement: Number.isFinite(Number(input.vacationEntitlement)) ? Number(input.vacationEntitlement) : 20,
          vacationCarryover: Number.isFinite(Number(input.vacationCarryover)) ? Number(input.vacationCarryover) : 0,
          isActive: true,
        },
        select: { id: true },
      });

      if (restaurantIds.length) {
        await tx.restaurantUser.createMany({
          data: restaurantIds.map((rid) => ({
            userId: u.id,
            restaurantId: rid,
            isPrimary: input.primaryRestaurantId ? rid === input.primaryRestaurantId : false,
          })),
          skipDuplicates: true,
        });
      }

      const allowanceRows = Array.isArray(input.vacationAllowances)
        ? input.vacationAllowances
            .map((r) => ({ year: Number(r.year), days: Number(r.days) }))
            .filter((x) => Number.isFinite(x.year) && Number.isFinite(x.days))
        : [];
      if (allowanceRows.length) {
        for (const r of allowanceRows) {
          await tx.vacationAllowance.upsert({
            where: { userId_year: { userId: u.id, year: r.year } },
            create: { userId: u.id, year: r.year, days: r.days },
            update: { days: r.days },
          });
        }
      }

      return u;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("departmentId") || msg.includes("department") || msg.includes("Unknown arg")) {
      throw new Error(
        "Greška baze: shema nije ažurirana. Pokrenite: npx prisma migrate deploy (ili npx prisma db push)."
      );
    }
    throw e;
  }

  revalidatePath("/admin/users");
  return { success: true, id: created.id };
}

export async function updateUser(input: UpdateUserInput) {
  await requirePermission("users:manage");

  if (!input.id) throw new Error("ID nedostaje.");
  const email = normalizeEmail(input.email);
  if (!input.name?.trim()) throw new Error("Ime i prezime su obavezni.");
  if (!email) throw new Error("Email je obavezan.");

  const restaurantIds = Array.isArray(input.restaurantIds) ? input.restaurantIds : [];

  const supervisorIdFinal = await validateAndResolveSupervisorId({
    role: input.role,
    supervisorId: input.supervisorId ?? null,
    selfId: input.id,
  });

  await prisma.$transaction(async (tx) => {
    const data: Prisma.UserUncheckedUpdateInput = {
      name: input.name.trim(),
      email,
      role: input.role,
      departmentId: input.departmentId ?? null,
      permissions: Array.isArray(input.permissions) ? input.permissions : [],
      supervisorId: supervisorIdFinal,
      vacationEntitlement: Number.isFinite(Number(input.vacationEntitlement)) ? Number(input.vacationEntitlement) : undefined,
      vacationCarryover: Number.isFinite(Number(input.vacationCarryover)) ? Number(input.vacationCarryover) : undefined,
    };

    if (input.password && input.password.trim()) {
      data.password = await bcrypt.hash(input.password, 10);
    }

    await tx.user.update({
      where: { id: input.id },
      data,
    });

    await tx.restaurantUser.deleteMany({ where: { userId: input.id } });

    if (restaurantIds.length) {
      await tx.restaurantUser.createMany({
        data: restaurantIds.map((rid) => ({
          userId: input.id,
          restaurantId: rid,
          isPrimary: input.primaryRestaurantId ? rid === input.primaryRestaurantId : false,
        })),
        skipDuplicates: true,
      });
    }

    const allowanceRows = Array.isArray(input.vacationAllowances)
      ? input.vacationAllowances
          .map((r) => ({ year: Number(r.year), days: Number(r.days) }))
          .filter((x) => Number.isFinite(x.year) && Number.isFinite(x.days))
      : [];
    for (const r of allowanceRows) {
      await tx.vacationAllowance.upsert({
        where: { userId_year: { userId: input.id, year: r.year } },
        create: { userId: input.id, year: r.year, days: r.days },
        update: { days: r.days },
      });
    }
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteUser(id: string) {
  await requirePermission("users:manage");
  if (!id) throw new Error("ID nedostaje.");

  await prisma.$transaction(async (tx) => {
    // EvaluationSubmission nema onDelete: Cascade – brišemo ručno
    await tx.evaluationSubmission.deleteMany({ where: { userId: id } });
    await tx.user.delete({ where: { id } });
  });

  revalidatePath("/admin/users");
  return { success: true };
}
