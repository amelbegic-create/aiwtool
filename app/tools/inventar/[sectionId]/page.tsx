import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getInventarSection } from "@/app/actions/inventarActions";
import { resolveActiveRestaurantId } from "@/app/actions/restaurantContext";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import InventarSectionClient from "./InventarSectionClient";

export const dynamic = "force-dynamic";

export default async function InventarSectionPage({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}) {
  const session = await getServerSession(authOptions);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const access = await tryRequirePermission("inventory:access");
  if (!access.ok) return <NoPermission moduleName="Inventar" />;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session?.user as any)?.role as string;
  const isGlobal = role === "ADMIN" || role === "SYSTEM_ARCHITECT";

  const { sectionId } = await params;
  const section = await getInventarSection(sectionId);
  if (!section) notFound();

  // If user switched restaurant in topbar while on a section URL (sectionId),
  // redirect to the same section name within the currently active restaurant.
  try {
    // Determine restaurants the user may access
    let allowedRestaurantIds: string[] = [];
    let preferredRestaurantId: string | undefined;
    if (isGlobal) {
      const all = await prisma.restaurant.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      allowedRestaurantIds = all.map((r) => r.id);
    } else {
      const rels = await prisma.restaurantUser.findMany({
        where: { userId },
        select: { restaurantId: true, isPrimary: true },
      });
      allowedRestaurantIds = rels.map((r) => r.restaurantId);
      preferredRestaurantId = rels.find((r) => r.isPrimary)?.restaurantId;
    }
    const activeRestaurantId =
      allowedRestaurantIds.length > 0
        ? await resolveActiveRestaurantId({
            allowedRestaurantIds,
            preferredRestaurantId,
            allowAll: false,
          })
        : null;

    if (activeRestaurantId && activeRestaurantId !== "all" && activeRestaurantId !== section.restaurantId) {
      const sibling = await prisma.inventarSection.findFirst({
        where: { restaurantId: activeRestaurantId, name: section.name },
        select: { id: true },
      });
      if (sibling?.id) {
        redirect(`/tools/inventar/${sibling.id}`);
      }
    }
  } catch {
    // non-fatal; fall back to showing the requested section
  }

  // Verify restaurant access
  if (!isGlobal) {
    const rel = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId, restaurantId: section.restaurantId } },
      select: { id: true },
    });
    if (!rel) notFound();
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { permissions: true },
  });
  const canEdit =
    isGlobal ||
    (role === "MANAGER" && (dbUser?.permissions ?? []).includes("inventory:edit"));

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: section.restaurantId },
    select: { name: true, code: true },
  });

  return (
    <InventarSectionClient
      section={section}
      restaurantName={restaurant?.name ?? restaurant?.code ?? ""}
      restaurantId={section.restaurantId}
      canEdit={canEdit}
    />
  );
}
