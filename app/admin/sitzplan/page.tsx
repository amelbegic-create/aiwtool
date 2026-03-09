import prisma from "@/lib/prisma";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import AdminSitzplanClient from "./AdminSitzplanClient";

export default async function AdminSitzplanPage() {
  const access = await tryRequirePermission("restaurants:access");
  if (!access.ok) {
    return <NoPermission moduleName="Sitzplan" />;
  }

  const restaurants = await prisma.restaurant.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      city: true,
      sitzplanPdfUrl: true,
    },
  });

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <AdminSitzplanClient restaurants={restaurants} />
    </div>
  );
}
