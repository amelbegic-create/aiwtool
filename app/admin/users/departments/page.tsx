import { requirePermission } from "@/lib/access";
import prisma from "@/lib/prisma";
import { getDepartments } from "@/app/actions/departmentActions";
import DepartmentsClient from "../_components/DepartmentsClient";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  await requirePermission("users:manage");

  const [departments, restaurants] = await Promise.all([
    getDepartments(),
    prisma.restaurant.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <DepartmentsClient departments={departments} restaurants={restaurants} />
    </div>
  );
}

