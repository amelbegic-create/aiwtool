"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { requirePermission } from "@/lib/access";

const ROLE_RANK: Record<string, number> = {
  SYSTEM_ARCHITECT: 1,
  SUPER_ADMIN: 2,
  MANAGER: 3,
  ADMIN: 4,
  CREW: 5,
};

function roleRequiresSupervisor(role: string) {
  return (ROLE_RANK[role] ?? 99) >= 3;
}

async function validateSupervisor(role: string, supervisorId: string | null, selfId?: string) {
  if (!roleRequiresSupervisor(role)) return null;
  if (!supervisorId) throw new Error("Nadređeni je obavezan za ovu rolu.");
  if (selfId && supervisorId === selfId) throw new Error("Korisnik ne može sam sebi biti nadređeni.");
  const sup = await prisma.user.findUnique({ where: { id: supervisorId }, select: { id: true, role: true, isActive: true } });
  if (!sup) throw new Error("Odabrani nadređeni ne postoji.");
  if (!sup.isActive) throw new Error("Odabrani nadređeni nije aktivan.");
  const supRank = ROLE_RANK[sup.role] ?? 99;
  const myRank = ROLE_RANK[role] ?? 99;
  if (supRank >= myRank) throw new Error("Nadređeni mora imati višu rolu.");
  return sup.id;
}

type CreateSmartUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
  departmentId?: string | null;
  vacationEntitlement?: number;
  vacationCarryover?: number;
  permissions?: string[];
  restaurantIds?: string[];
  primaryRestaurantId?: string | null;
  supervisorId?: string | null;
};

type UpdateSmartUserInput = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: Role;
  departmentId?: string | null;
  vacationEntitlement?: number;
  vacationCarryover?: number;
  permissions?: string[];
  restaurantIds?: string[];
  primaryRestaurantId?: string | null;
  supervisorId?: string | null;
};

function buildName(firstName: string, lastName: string) {
  return `${(firstName || "").trim()} ${(lastName || "").trim()}`.trim();
}

function normalizeRestaurants(
  restaurantIds?: string[],
  primaryRestaurantId?: string | null
) {
  const ids = Array.from(new Set((restaurantIds || []).filter(Boolean)));

  // Ako je primary setovan a nije u listi, dodaj ga
  if (primaryRestaurantId && !ids.includes(primaryRestaurantId)) {
    ids.unshift(primaryRestaurantId);
  }

  // Ako nema primary, a ima restorana, prvi je primary
  const primary =
    primaryRestaurantId && ids.includes(primaryRestaurantId)
      ? primaryRestaurantId
      : ids[0] || null;

  return { ids, primary };
}

// KREIRANJE KORISNIKA
export async function createSmartUser(data: CreateSmartUserInput) {
  await requirePermission("users:manage");

  const name = buildName(data.firstName, data.lastName);
  if (!data.firstName?.trim() || !data.lastName?.trim() || !data.email?.trim()) {
    throw new Error("Ime, Prezime i Email su obavezni.");
  }
  if (!data.password?.trim()) {
    throw new Error("Lozinka je obavezna kod kreiranja.");
  }

  const email = data.email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new Error("Korisnik sa ovim emailom već postoji.");

  const hashed = await hash(data.password, 12);
  const { ids, primary } = normalizeRestaurants(data.restaurantIds, data.primaryRestaurantId ?? null);
  const supervisorId = await validateSupervisor(data.role, data.supervisorId ?? null);

  const created = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: data.role,
      departmentId: data.departmentId ?? null,
      vacationEntitlement: data.vacationEntitlement ?? 20,
      vacationCarryover: data.vacationCarryover ?? 0,
      permissions: data.permissions ?? [],
      supervisorId,
      restaurants:
        ids.length > 0
          ? {
              create: ids.map((rid) => ({ restaurantId: rid, isPrimary: primary === rid })),
            }
          : undefined,
    },
    select: { id: true },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { success: true as const, id: created.id };
}

// UPDATE KORISNIKA
export async function updateSmartUser(data: UpdateSmartUserInput) {
  await requirePermission("users:manage");

  const name = buildName(data.firstName, data.lastName);
  if (!data.id) throw new Error("Nedostaje ID korisnika.");
  if (!data.firstName?.trim() || !data.lastName?.trim() || !data.email?.trim()) {
    throw new Error("Ime, Prezime i Email su obavezni.");
  }

  const email = data.email.trim().toLowerCase();
  const { ids, primary } = normalizeRestaurants(data.restaurantIds, data.primaryRestaurantId ?? null);
  const supervisorId = await validateSupervisor(data.role, data.supervisorId ?? null, data.id);

  await prisma.$transaction([
    prisma.restaurantUser.deleteMany({ where: { userId: data.id } }),
    prisma.user.update({
      where: { id: data.id },
      data: {
        name,
        email,
        role: data.role,
        departmentId: data.departmentId ?? null,
        vacationEntitlement: data.vacationEntitlement ?? 20,
        vacationCarryover: data.vacationCarryover ?? 0,
        permissions: { set: data.permissions ?? [] },
        password: data.password?.trim() ? await hash(data.password, 12) : undefined,
        supervisorId,
      },
    }),
  ]);

  if (ids.length > 0) {
    await prisma.restaurantUser.createMany({
      data: ids.map((rid) => ({ userId: data.id, restaurantId: rid, isPrimary: primary === rid })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { success: true as const };
}

// BRISANJE (soft: isActive=false)
export async function deleteSmartUser(id: string) {
  await requirePermission("users:manage");
  if (!id) throw new Error("Nedostaje ID korisnika.");
  await prisma.user.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { success: true as const };
}
