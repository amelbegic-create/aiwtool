import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { resolveActiveRestaurantId } from "@/app/actions/restaurantContext";
import {
  ensureInventarPrefilled,
  getInventarSections,
} from "@/app/actions/inventarActions";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import InventarClient from "./InventarClient";

export const dynamic = "force-dynamic";

export default async function InventarPage() {
  const session = await getServerSession(authOptions);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const access = await tryRequirePermission("inventory:access");
  if (!access.ok) return <NoPermission moduleName="Equipment" />;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session?.user as any)?.role as string;
  const isGlobal = role === "ADMIN" || role === "SYSTEM_ARCHITECT";

  // Determine accessible restaurants
  let accessibleRestaurants: { id: string; code: string; name: string | null }[] = [];
  if (isGlobal) {
    accessibleRestaurants = await prisma.restaurant.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    });
  } else {
    const relations = await prisma.restaurantUser.findMany({
      where: { userId },
      select: { restaurant: { select: { id: true, code: true, name: true } } },
    });
    accessibleRestaurants = relations.map((r) => r.restaurant);
  }

  accessibleRestaurants.sort((a, b) => {
    const nA = parseInt(a.name || "0", 10);
    const nB = parseInt(b.name || "0", 10);
    if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
    return (a.name || "").localeCompare(b.name || "");
  });

  const allowedIds = accessibleRestaurants.map((r) => r.id);
  const primaryRelation = await prisma.restaurantUser.findFirst({
    where: { userId, isPrimary: true },
    select: { restaurantId: true },
  });

  const resolvedActive =
    allowedIds.length > 0
      ? await resolveActiveRestaurantId({
          allowedRestaurantIds: allowedIds,
          preferredRestaurantId: primaryRelation?.restaurantId,
          allowAll: false,
        })
      : null;

  const activeRestaurantId =
    resolvedActive && resolvedActive !== "all"
      ? resolvedActive
      : accessibleRestaurants[0]?.id ?? "";

  if (!activeRestaurantId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground font-semibold">
        Kein Restaurant zugewiesen.
      </div>
    );
  }

  // Pre-fill on first visit
  await ensureInventarPrefilled(activeRestaurantId);

  const sections = await getInventarSections(activeRestaurantId);

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { permissions: true },
  });
  const canEdit =
    isGlobal ||
    (role === "MANAGER" && (dbUser?.permissions ?? []).includes("inventory:edit"));

  const activeRestaurant = accessibleRestaurants.find((r) => r.id === activeRestaurantId);

  return (
    <InventarClient
      sections={sections}
      activeRestaurantId={activeRestaurantId}
      activeRestaurantName={activeRestaurant?.name ?? activeRestaurant?.code ?? ""}
      accessibleRestaurants={accessibleRestaurants}
      canEdit={canEdit}
      userRole={role}
    />
  );
}
