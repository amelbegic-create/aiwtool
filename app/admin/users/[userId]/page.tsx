import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { requirePermission } from "@/lib/access";
import prisma from "@/lib/prisma";
import { getDepartments } from "@/app/actions/departmentActions";
import UserForm, { UserFormInitialData } from "../_components/UserForm";

const STEALTH_ROLE_FILTER = { role: { not: Role.SYSTEM_ARCHITECT } };

export const dynamic = "force-dynamic";

const ROLE_RANK: Record<string, number> = {
  SYSTEM_ARCHITECT: 1,
  SUPER_ADMIN: 2,
  MANAGER: 3,
  ADMIN: 4,
  CREW: 5,
};

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function EditUserPage({ params }: PageProps) {
  await requirePermission("users:manage");

  const { userId } = await params;

  const [user, restaurants, allUsers, departments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        restaurants: { select: { restaurantId: true } },
        vacationAllowances: { select: { year: true, days: true } },
      },
    }),
    prisma.restaurant.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, ...STEALTH_ROLE_FILTER },
      select: { id: true, name: true, email: true, role: true },
    }),
    getDepartments(),
  ]);

  if (!user) {
    notFound();
  }

  const fullName = (user.name || "").trim();
  const parts = fullName.split(/\s+/);
  const firstName = parts.shift() || "";
  const lastName = parts.join(" ");

  const restaurantIds = (user.restaurants || []).map((r) => r.restaurantId);
  const primaryRestaurantId = restaurantIds.length > 0 ? restaurantIds[0] : null;

  const vacationAllowances = (user.vacationAllowances || []).map((a) => ({ year: a.year, days: a.days }));
  if (vacationAllowances.length === 0) {
    vacationAllowances.push({ year: new Date().getFullYear(), days: user.vacationEntitlement ?? 20 });
  }

  const initialData: UserFormInitialData = {
    id: user.id,
    firstName,
    lastName,
    email: user.email || "",
    role: user.role,
    departmentId: user.departmentId ?? null,
    vacationAllowances,
    restaurantIds,
    primaryRestaurantId,
    supervisorId: user.supervisorId ?? null,
    permissions: user.permissions || [],
  };

  const supervisorCandidates = allUsers
    .filter((u) => u.id !== userId && u.role && ROLE_RANK[u.role] < 5)
    .map((u) => ({
      id: u.id,
      name: u.name || "Korisnik",
      email: u.email || "",
      role: u.role,
    }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Uredi korisnika</h2>
          <p className="text-sm text-slate-600 mt-1">
            Izmjena podataka za {user.name || "korisnika"}
          </p>
        </div>
        <Link
          href="/admin/users"
          className="inline-flex items-center min-h-[44px] text-sm font-bold text-slate-600 hover:text-[#1a3826] transition-colors"
        >
          ← Nazad na listu
        </Link>
      </div>
      <UserForm
        restaurants={restaurants.map((r) => ({
          id: r.id,
          name: r.name ?? null,
          code: r.code,
        }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name, color: d.color, restaurantId: d.restaurantId }))}
        supervisorCandidates={supervisorCandidates}
        initialData={initialData}
      />
    </div>
  );
}
