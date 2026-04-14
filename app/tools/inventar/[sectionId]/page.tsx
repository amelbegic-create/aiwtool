import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getInventarSection } from "@/app/actions/inventarActions";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { STANDARD_SECTIONS } from "@/lib/inventarStandardSections";
import InventarSectionClient from "./InventarSectionClient";

export const dynamic = "force-dynamic";

export default async function InventarSectionPage({
  params,
}: {
  params: { sectionId: string };
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

  const section = await getInventarSection(params.sectionId);
  if (!section) notFound();

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

  // Standard device names for this section (for dropdown)
  const standardSection = STANDARD_SECTIONS.find(
    (s) => s.name.toLowerCase() === section.name.toLowerCase()
  );
  const standardDeviceNames = standardSection?.devices ?? [];

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
      standardDeviceNames={standardDeviceNames}
    />
  );
}
