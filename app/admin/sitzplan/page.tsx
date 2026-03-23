import prisma from "@/lib/prisma";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import AdminSitzplanClient from "./AdminSitzplanClient";
import { mergeSitzplanPdfs } from "@/lib/sitzplanUrls";

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
      sitzplanPdfsData: true,
    },
  });

  const rows = restaurants.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    city: r.city,
    sitzplanPdfs: mergeSitzplanPdfs(r),
  }));

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <AdminSitzplanClient restaurants={rows} />
    </div>
  );
}
