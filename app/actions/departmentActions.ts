"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/access";

/** Dohvati sve odjele (globalne + po restoranu). */
export async function getDepartments(restaurantId?: string | null) {
  await requirePermission("users:manage");

  const where = restaurantId
    ? { OR: [{ restaurantId: null }, { restaurantId }] }
    : {};

  const list = await prisma.department.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true, restaurantId: true },
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

  const created = await prisma.department.create({
    data: {
      name,
      color,
      restaurantId: input.restaurantId || null,
    },
    select: { id: true, name: true, color: true },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/users/create");
  return { success: true as const, data: created };
}
