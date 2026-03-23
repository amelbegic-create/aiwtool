import prisma from "@/lib/prisma";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { notFound, redirect } from "next/navigation";
import { mergeSitzplanPdfs } from "@/lib/sitzplanUrls";
import AdminSitzplanDetailClient from "./AdminSitzplanDetailClient";

type Props = { params: Promise<{ restaurantId: string }> };

export default async function AdminSitzplanDetailPage({ params }: Props) {
  const access = await tryRequirePermission("restaurants:access");
  if (!access.ok) {
    return <NoPermission moduleName="Sitzplan" />;
  }

  const { restaurantId } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      code: true,
      name: true,
      city: true,
      sitzplanPdfUrl: true,
      sitzplanPdfsData: true,
    },
  });

  if (!restaurant) notFound();

  const pdfs = mergeSitzplanPdfs(restaurant);
  if (pdfs.length <= 1) {
    redirect("/admin/sitzplan");
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <AdminSitzplanDetailClient
        restaurantId={restaurant.id}
        restaurantLabel={restaurant.name ?? restaurant.code}
        pdfs={pdfs}
      />
    </div>
  );
}
