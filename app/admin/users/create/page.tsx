import Link from "next/link";
import { requirePermission } from "@/lib/access";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getDepartments } from "@/app/actions/departmentActions";
import UserForm from "../_components/UserForm";

export const dynamic = "force-dynamic";

export default async function CreateUserPage() {
  await requirePermission("users:manage");

  const [restaurants, supervisors, departments] = await Promise.all([
    prisma.restaurant.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { not: Role.SYSTEM_ARCHITECT } },
      select: { id: true, name: true, email: true, role: true },
    }),
    getDepartments(),
  ]);

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
          <h2 className="text-2xl font-black text-slate-900">Neuer Benutzer</h2>
          <p className="text-sm text-slate-600 mt-1">Geben Sie die Daten für den neuen Mitarbeiter ein</p>
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
      />
    </div>
  );
}
