import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import NoPermission from "@/components/NoPermission";
import { GOD_MODE_ROLES } from "@/lib/permissions";
import { hasPermission } from "@/lib/access";
import { redirect } from "next/navigation";

export default async function ProductivityLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true, permissions: true, isActive: true },
  });

  if (!dbUser || !dbUser.isActive) return <NoPermission moduleName="Produktivnost" />;

  const role = String(dbUser.role);
  const perms = dbUser.permissions || [];
  const isGodMode = GOD_MODE_ROLES.has(role);

  if (!isGodMode && !hasPermission(role, perms, "productivity:access")) {
    return <NoPermission moduleName="Produktivnost" />;
  }

  return <>{children}</>;
}
