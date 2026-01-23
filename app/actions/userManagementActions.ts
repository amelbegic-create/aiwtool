"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { hash } from "bcryptjs";

type CreateSmartUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
  department?: string | null;
  vacationEntitlement?: number;
  vacationCarryover?: number;
  permissions?: string[];
  restaurantIds?: string[];
  primaryRestaurantId?: string | null;
};

type UpdateSmartUserInput = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string; // optional
  role: Role;
  department?: string | null;
  vacationEntitlement?: number;
  vacationCarryover?: number;
  permissions?: string[];
  restaurantIds?: string[];
  primaryRestaurantId?: string | null;
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
  const name = buildName(data.firstName, data.lastName);

  if (!data.firstName?.trim() || !data.lastName?.trim() || !data.email?.trim()) {
    throw new Error("Ime, Prezime i Email su obavezni.");
  }
  if (!data.password?.trim()) {
    throw new Error("Lozinka je obavezna kod kreiranja.");
  }

  const email = data.email.trim().toLowerCase();
  const hashed = await hash(data.password, 10);

  const { ids, primary } = normalizeRestaurants(
    data.restaurantIds,
    data.primaryRestaurantId ?? null
  );

  await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: data.role, // ✅ ENUM, nema connect
      department: data.department ?? "RL",
      vacationEntitlement: data.vacationEntitlement ?? 20,
      vacationCarryover: data.vacationCarryover ?? 0,
      permissions: data.permissions ?? [],
      restaurants: ids.length
        ? {
            create: ids.map((rid) => ({
              restaurantId: rid,
              isPrimary: primary === rid,
            })),
          }
        : undefined,
    },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

// UPDATE KORISNIKA
export async function updateSmartUser(data: UpdateSmartUserInput) {
  const name = buildName(data.firstName, data.lastName);

  if (!data.id) throw new Error("Nedostaje ID korisnika.");
  if (!data.firstName?.trim() || !data.lastName?.trim() || !data.email?.trim()) {
    throw new Error("Ime, Prezime i Email su obavezni.");
  }

  const email = data.email.trim().toLowerCase();

  const { ids, primary } = normalizeRestaurants(
    data.restaurantIds,
    data.primaryRestaurantId ?? null
  );

  await prisma.user.update({
    where: { id: data.id },
    data: {
      name,
      email,
      role: data.role, // ✅ ENUM, nema connect
      department: data.department ?? "RL",
      vacationEntitlement: data.vacationEntitlement ?? 20,
      vacationCarryover: data.vacationCarryover ?? 0,
      permissions: { set: data.permissions ?? [] }, // ✅ siguran update niza
      password: data.password?.trim() ? await hash(data.password, 10) : undefined,

      // Reset + re-create user->restaurants veza
      restaurants: {
        deleteMany: {}, // obriši sve prethodne veze
        create: ids.map((rid) => ({
          restaurantId: rid,
          isPrimary: primary === rid,
        })),
      },
    },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

// BRISANJE KORISNIKA
export async function deleteSmartUser(id: string) {
  if (!id) throw new Error("Nedostaje ID korisnika.");
  await prisma.user.delete({ where: { id } });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
}
