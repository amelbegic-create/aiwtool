"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/access";

export async function createRestaurant(data: { code: string; name: string; city?: string; address?: string }) {
  await requirePermission("restaurants:create");

  if (!data.code?.trim()) throw new Error("Code je obavezan.");
  if (!data.name?.trim()) throw new Error("Naziv je obavezan.");

  await prisma.restaurant.create({
    data: {
      code: data.code.trim(),
      name: data.name.trim(),
      city: data.city?.trim() || null,
      address: data.address?.trim() || null,
      isActive: true,
    },
  });

  revalidatePath("/admin/restaurants");
  revalidatePath("/admin/users");
}

export async function updateRestaurant(data: {
  id: string;
  code: string;
  name: string;
  city?: string;
  address?: string;
  isActive?: boolean;
}) {
  await requirePermission("restaurants:edit");

  await prisma.restaurant.update({
    where: { id: data.id },
    data: {
      code: data.code.trim(),
      name: data.name.trim(),
      city: data.city?.trim() || null,
      address: data.address?.trim() || null,
      ...(typeof data.isActive === "boolean" ? { isActive: data.isActive } : {}),
    },
  });

  revalidatePath("/admin/restaurants");
  revalidatePath("/admin/users");
}

export async function toggleRestaurantStatus(id: string, current: boolean) {
  await requirePermission("restaurants:toggle");

  await prisma.restaurant.update({
    where: { id },
    data: { isActive: !current },
  });

  revalidatePath("/admin/restaurants");
  revalidatePath("/admin/users");
}

export async function deleteRestaurant(id: string) {
  await requirePermission("restaurants:delete");

  // zaštita: ne možeš obrisati restoran ako ima user mapping (po želji)
  const usersCount = await prisma.restaurantUser.count({ where: { restaurantId: id } });
  if (usersCount > 0) throw new Error("Ne možete obrisati restoran koji ima dodijeljene korisnike.");

  await prisma.restaurant.delete({ where: { id } });

  revalidatePath("/admin/restaurants");
  revalidatePath("/admin/users");
}
