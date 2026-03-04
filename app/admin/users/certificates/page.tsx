import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import CertificatesAdminClient from "../_components/CertificatesAdminClient";

export const dynamic = "force-dynamic";

export default async function CertificatesPage() {
  try {
    await requirePermission("users:access");
  } catch {
    return <NoPermission moduleName="Mitarbeiter-Zertifikate" />;
  }

  const users = await prisma.user.findMany({
    where: { isActive: true, NOT: { role: "SYSTEM_ARCHITECT" } },
    orderBy: { name: "asc" },
    include: {
      department: { select: { name: true, color: true } },
      certificates: {
        select: { id: true },
      },
    },
  });

  const formattedUsers = users.map((u) => ({
    id: u.id,
    name: u.name || "Benutzer",
    email: u.email || "",
    image: u.image ?? null,
    department: u.department?.name ?? null,
    departmentColor: u.department?.color ?? null,
    restaurants: [] as { id: string; name: string | null; code: string }[],
    certificatesCount: u.certificates.length,
  }));

  return (
    <div className="space-y-6">
      <CertificatesAdminClient users={formattedUsers} />
    </div>
  );
}

