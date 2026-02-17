import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/access";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getDepartments } from "@/app/actions/departmentActions";
import UserForm, { UserFormInitialData } from "../_components/UserForm";

export const dynamic = "force-dynamic";

const STEALTH_ROLE_FILTER = { role: { not: Role.SYSTEM_ARCHITECT } };

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function EditUserPage({ params }: PageProps) {
  await requirePermission("users:manage");

  const { userId } = await params;

  const [user, restaurants, supervisors, departments] = await Promise.all([
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
    supervisorId: user.supervisorId ?? null,
    vacationAllowances,
    restaurantIds,
    primaryRestaurantId,
    permissions: user.permissions || [],
  };

  const eligibleSupervisors = supervisors.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
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
          ← Zurück zur Liste
        </Link>
      </div>
      <UserForm
        restaurants={restaurants.map((r) => ({
          id: r.id,
          name: r.name ?? null,
          code: r.code,
        }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name, color: d.color, restaurantId: d.restaurantId }))}
        eligibleSupervisors={eligibleSupervisors}
        initialData={initialData}
      />
    </div>
  );
}
