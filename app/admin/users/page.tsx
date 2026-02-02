import prisma from "@/lib/prisma";
import UserClient from "./UserClient";
import { requirePermission } from "@/lib/access";

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

export default async function UsersPage() {
  await requirePermission("users:access");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      restaurants: true,
      department: { select: { id: true, name: true } },
      vacationAllowances: {
        where: { year: { in: YEARS } },
        select: { year: true, days: true },
      },
    },
  });

  const rawRestaurants = await prisma.restaurant.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const formattedRestaurants = rawRestaurants.map((r) => ({
    id: r.id,
    name: r.name || "Nepoznat restoran",
  }));

  // ✅ šaljemo "plain" objekte u client (bez Date, bez spread u)
  const formattedUsers = users.map((u) => {
    const allowanceMap: Record<number, number> = {};
    for (const y of YEARS) allowanceMap[y] = 0;
    for (const row of u.vacationAllowances || []) {
      allowanceMap[row.year] = row.days;
    }

    return {
      id: u.id,
      name: u.name || "Korisnik",
      email: u.email || "",
      role: u.role,
      departmentId: u.departmentId ?? null,
      departmentName: u.department?.name ?? null,
      isActive: u.isActive,
      permissions: u.permissions || [],
      vacationEntitlement: u.vacationEntitlement ?? 20,
      vacationCarryover: u.vacationCarryover ?? 0,
      restaurantIds: (u.restaurants || []).map((rr) => rr.restaurantId),
      supervisorId: u.supervisorId || null,
      vacationAllowances: allowanceMap,
    };
  });

  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <UserClient
      users={formattedUsers}
      restaurants={formattedRestaurants}
      departments={departments}
      embedded
    />
  );
}
