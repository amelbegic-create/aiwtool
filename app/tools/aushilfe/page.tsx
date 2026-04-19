import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getHelpRequests } from "@/app/actions/aushilfeActions";
import { resolveActiveRestaurantId } from "@/app/actions/restaurantContext";
import AushilfeClient from "./AushilfeClient";

export const dynamic = "force-dynamic";

const AUSHILFE_DEFAULT_ROLES = new Set(["SYSTEM_ARCHITECT", "ADMIN", "MANAGER"]);

export default async function AushilfePage() {
  const session = await getServerSession(authOptions);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session?.user as any)?.role as string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permissions = ((session?.user as any)?.permissions ?? []) as string[];

  const hasAccess =
    AUSHILFE_DEFAULT_ROLES.has(role ?? "") ||
    permissions.includes("aushilfe:access");

  if (!hasAccess) redirect("/dashboard");

  const activeRequests = await getHelpRequests(false);

  const canSeeAllRestaurants = role === "ADMIN" || role === "SYSTEM_ARCHITECT";

  let accessibleRestaurants: { id: string; code: string; name: string | null }[] = [];

  if (canSeeAllRestaurants) {
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
    const numA = parseInt(a.name || "0", 10);
    const numB = parseInt(b.name || "0", 10);
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
    return (a.name || "").localeCompare(b.name || "");
  });

  const primaryRelation = await prisma.restaurantUser.findFirst({
    where: { userId, isPrimary: true },
    select: { restaurantId: true },
  });

  const allowedIds = accessibleRestaurants.map((r) => r.id);
  const resolvedActive =
    allowedIds.length > 0
      ? await resolveActiveRestaurantId({
          allowedRestaurantIds: allowedIds,
          preferredRestaurantId: primaryRelation?.restaurantId,
          allowAll: false,
        })
      : null;

  const defaultActiveRestaurantId =
    resolvedActive && resolvedActive !== "all" ? resolvedActive : accessibleRestaurants[0]?.id ?? "";

  // providingRestaurants = isti kao accessibleRestaurants (samo korisnikovi restorani)
  const providingRestaurants = accessibleRestaurants;

  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const requesterName =
    profile?.name?.trim() || profile?.email?.trim() || "Benutzer";

  return (
    <AushilfeClient
      initialActiveRequests={activeRequests}
      accessibleRestaurants={accessibleRestaurants}
      providingRestaurants={providingRestaurants}
      defaultActiveRestaurantId={defaultActiveRestaurantId}
      requesterName={requesterName}
      userRole={role ?? ""}
      userId={userId ?? ""}
    />
  );
}
