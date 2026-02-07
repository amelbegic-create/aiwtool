import Link from "next/link";
import { Role } from "@prisma/client";
import { requirePermission } from "@/lib/access";
import prisma from "@/lib/prisma";
import { getDepartments } from "@/app/actions/departmentActions";
import UserForm from "../_components/UserForm";

const STEALTH_ROLE_FILTER = { role: { not: Role.SYSTEM_ARCHITECT } };

export const dynamic = "force-dynamic";

const ROLE_RANK: Record<string, number> = {
  SYSTEM_ARCHITECT: 1,
  SUPER_ADMIN: 2,
  MANAGER: 3,
  ADMIN: 4,
  CREW: 5,
};

export default async function CreateUserPage() {
  await requirePermission("users:manage");

  const [restaurants, users, departments] = await Promise.all([
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

  const supervisorCandidates = users
    .filter((u) => u.role && ROLE_RANK[u.role] < 5)
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
          <h2 className="text-2xl font-black text-slate-900">Novi korisnik</h2>
          <p className="text-sm text-slate-600 mt-1">Unesite podatke za novog zaposlenika</p>
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
      />
    </div>
  );
}
