"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/access";

const DEPARTMENT_ORDER_BY = [{ sortOrder: "asc" as const }, { name: "asc" as const }];

function revalidateDepartmentRelatedPaths() {
  revalidatePath("/admin/users");
  revalidatePath("/admin/users/create");
  revalidatePath("/admin/users/departments");
  revalidatePath("/team");
}

/** Dohvati sve odjele (globalne + po restoranu). */
export async function getDepartments(restaurantId?: string | null) {
  await requirePermission("users:manage");

  const where = restaurantId
    ? { OR: [{ restaurantId: null }, { restaurantId }] }
    : {};

  const list = await prisma.department.findMany({
    where,
    orderBy: DEPARTMENT_ORDER_BY,
    select: { id: true, name: true, color: true, restaurantId: true, sortOrder: true },
  });
  return list;
}

type CreateDepartmentInput = {
  name: string;
  color: string;
  restaurantId?: string | null;
};

/** Kreiraj novi odjel. */
export async function createDepartment(input: CreateDepartmentInput) {
  await requirePermission("users:manage");

  const name = (input.name || "").trim();
  if (!name) throw new Error("Naziv odjela je obavezan.");

  const color = (input.color || "#6b7280").trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw new Error("Boja mora biti HEX (npr. #ff0000).");

  const maxRow = await prisma.department.aggregate({
    _max: { sortOrder: true },
  });
  const nextOrder = (maxRow._max.sortOrder ?? -1) + 1;

  const created = await prisma.department.create({
    data: {
      name,
      color,
      restaurantId: input.restaurantId || null,
      sortOrder: nextOrder,
    },
    select: { id: true, name: true, color: true, sortOrder: true },
  });

  revalidateDepartmentRelatedPaths();
  return { success: true as const, data: created };
}

type UpdateDepartmentInput = {
  id: string;
  name: string;
  color: string;
  restaurantId?: string | null;
};

/** Ažuriraj odjel. */
export async function updateDepartment(input: UpdateDepartmentInput) {
  await requirePermission("users:manage");

  const name = (input.name || "").trim();
  if (!name) throw new Error("Naziv odjela je obavezan.");

  const color = (input.color || "#6b7280").trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw new Error("Boja mora biti HEX (npr. #ff0000).");

  await prisma.department.update({
    where: { id: input.id },
    data: {
      name,
      color,
      restaurantId: input.restaurantId ?? null,
    },
  });

  revalidateDepartmentRelatedPaths();
  return { success: true as const };
}

/** Spremi redoslijed odjela (puni niz ID-eva u željenom redoslijedu). */
export async function reorderDepartments(orderedIds: string[]) {
  await requirePermission("users:manage");

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { success: false as const, error: "Keine Abteilungen zum Sortieren." };
  }

  const unique = [...new Set(orderedIds.filter(Boolean))];
  if (unique.length !== orderedIds.length) {
    return { success: false as const, error: "Ungültige Sortierliste." };
  }

  try {
    await prisma.$transaction(
      unique.map((id, index) =>
        prisma.department.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );
    revalidateDepartmentRelatedPaths();
    return { success: true as const };
  } catch (err) {
    console.error("reorderDepartments error", err);
    return { success: false as const, error: "Reihenfolge konnte nicht gespeichert werden." };
  }
}

/** Obriši odjel. Korisnici koji su bili na ovom odjelu ostaju bez departmentId. */
export async function deleteDepartment(id: string) {
  await requirePermission("users:manage");

  try {
    // Najprije odveži sve korisnike s ovim odjelom (sigurno čak i ako FK nije SetNull svuda)
    await prisma.user.updateMany({
      where: { departmentId: id },
      data: { departmentId: null },
    });

    await prisma.department.delete({
      where: { id },
    });

    revalidateDepartmentRelatedPaths();
    return { success: true as const };
  } catch (err) {
    console.error("deleteDepartment error", err);
    return { success: false as const, error: "Fehler beim Löschen der Abteilung." };
  }
}
