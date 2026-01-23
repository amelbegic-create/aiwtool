"use server";

import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { requirePermission } from "@/lib/access";
import { ALL_PERMISSION_KEYS, GOD_MODE_ROLES } from "@/lib/permissions";

interface CreateUserDTO {
  name: string;
  email: string;
  password?: string;
  role: Role;
  department: string;
  vacationEntitlement: number;
  vacationCarryover: number;
  restaurantIds: string[];
  primaryRestaurantId?: string;
  permissions: string[];
}

function isGodModeRole(role: Role) {
  return GOD_MODE_ROLES.has(String(role));
}

export async function createUser(data: CreateUserDTO) {
  // Global guard: ko može kreirati korisnike
  await requirePermission("users:create");

  if (!data.password) throw new Error("Lozinka je obavezna.");
  const hashedPassword = await hash(data.password, 12);

  const finalPermissions = isGodModeRole(data.role)
    ? ALL_PERMISSION_KEYS
    : (data.permissions || []);

  await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role,
      department: data.department,
      vacationEntitlement: Number(data.vacationEntitlement),
      vacationCarryover: Number(data.vacationCarryover),
      permissions: finalPermissions,
      restaurants: {
        create: (data.restaurantIds || []).map((rid) => ({
          restaurantId: rid,
          isPrimary: rid === data.primaryRestaurantId,
        })),
      },
    },
  });

  revalidatePath("/admin/users");
}

export async function updateUser(data: any) {
  await requirePermission("users:edit");

  const updateData: any = {
    name: data.name,
    email: data.email,
    role: data.role,
    department: data.department,
    vacationEntitlement: Number(data.vacationEntitlement),
    vacationCarryover: Number(data.vacationCarryover),
  };

  // Permissions: admin role uvijek dobije sve
  updateData.permissions = isGodModeRole(data.role)
    ? ALL_PERMISSION_KEYS
    : (data.permissions || []);

  if (data.password && data.password.trim() !== "") {
    updateData.password = await hash(data.password, 12);
  }

  // reset user->restaurant mapping
  await prisma.restaurantUser.deleteMany({
    where: { userId: data.id },
  });

  await prisma.user.update({
    where: { id: data.id },
    data: {
      ...updateData,
      restaurants: {
        create: (data.restaurantIds || []).map((rid: string) => ({
          restaurantId: rid,
          isPrimary: rid === data.primaryRestaurantId,
        })),
      },
    },
  });

  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
  await requirePermission("users:delete");

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (targetUser?.role === Role.SYSTEM_ARCHITECT) {
    throw new Error("Ne možete obrisati System Architect-a.");
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
}
