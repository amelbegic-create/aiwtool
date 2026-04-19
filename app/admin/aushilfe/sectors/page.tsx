import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { listAushilfeCustomSectors } from "@/app/actions/aushilfeActions";
import AushilfeSectorsClient from "./AushilfeSectorsClient";
import NoPermission from "@/components/NoPermission";

export default async function AushilfeSectorsPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurantId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = (session.user as { role?: string }).role ?? "";
  if (!["SYSTEM_ARCHITECT", "ADMIN", "MANAGER"].includes(role)) {
    return <NoPermission moduleName="Aushilfe Sektoren" />;
  }

  const params = await searchParams;

  // Fetch all active restaurants (Admin/SA see all; Manager sees only their own)
  let restaurants: { id: string; code: string; name: string | null }[] = [];
  if (role === "SYSTEM_ARCHITECT" || role === "ADMIN") {
    restaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    });
  } else {
    // MANAGER – only their restaurants
    const userId = (session.user as { id?: string }).id ?? "";
    const rels = await prisma.restaurantUser.findMany({
      where: { userId },
      include: { restaurant: { select: { id: true, code: true, name: true, isActive: true } } },
    });
    restaurants = rels
      .filter(r => r.restaurant.isActive)
      .map(r => r.restaurant);
  }

  if (restaurants.length === 0) {
    return <NoPermission moduleName="Aushilfe Sektoren" />;
  }

  const activeRestId = params.restaurantId && restaurants.some(r => r.id === params.restaurantId)
    ? params.restaurantId
    : restaurants[0]!.id;

  const sectors = await listAushilfeCustomSectors(activeRestId);

  return (
    <AushilfeSectorsClient
      initialSectors={sectors.map(s => ({
        id: s.id,
        key: s.key,
        label: s.label,
        group: s.group,
        sortOrder: s.sortOrder,
      }))}
      restaurants={restaurants}
      defaultRestaurantId={activeRestId}
    />
  );
}
