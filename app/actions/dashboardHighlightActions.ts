"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getDbUserForAccess } from "@/lib/access";
import { GOD_MODE_ROLES } from "@/lib/permissions";

const ADMIN_ROLES_FOR_HIGHLIGHTS = new Set<string>(["SYSTEM_ARCHITECT", "SUPER_ADMIN", "ADMIN"]);

export async function getDashboardHighlights(): Promise<
  { id: string; moduleKey: string; moduleLabel: string; addedAt: Date }[]
> {
  try {
    const list = await prisma.dashboardHighlight.findMany({
      orderBy: [{ order: "asc" }, { addedAt: "desc" }],
      select: { id: true, moduleKey: true, moduleLabel: true, addedAt: true },
    });
    return list;
  } catch {
    // Tabela DashboardHighlight možda još ne postoji (nije pokrenut prisma db push)
    return [];
  }
}

export async function addDashboardHighlight(moduleKey: string, moduleLabel: string) {
  const dbUser = await getDbUserForAccess();
  if (!ADMIN_ROLES_FOR_HIGHLIGHTS.has(String(dbUser.role)) && !GOD_MODE_ROLES.has(String(dbUser.role))) {
    return { ok: false, error: "Nemate permisiju." };
  }
  try {
    const max = await prisma.dashboardHighlight.aggregate({ _max: { order: true } });
    await prisma.dashboardHighlight.upsert({
      where: { moduleKey },
      create: { moduleKey, moduleLabel, order: (max._max.order ?? -1) + 1 },
      update: { moduleLabel, addedAt: new Date(), order: (max._max.order ?? -1) + 1 },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Greška." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/admin/dashboard-modules");
  return { ok: true };
}

export async function removeDashboardHighlight(moduleKey: string) {
  const dbUser = await getDbUserForAccess();
  if (!ADMIN_ROLES_FOR_HIGHLIGHTS.has(String(dbUser.role)) && !GOD_MODE_ROLES.has(String(dbUser.role))) {
    return { ok: false, error: "Nemate permisiju." };
  }
  try {
    await prisma.dashboardHighlight.deleteMany({ where: { moduleKey } });
  } catch {
    return { ok: false, error: "Greška pri brisanju." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/admin/dashboard-modules");
  return { ok: true };
}

export async function reorderDashboardHighlights(moduleKeys: string[]) {
  const dbUser = await getDbUserForAccess();
  if (!ADMIN_ROLES_FOR_HIGHLIGHTS.has(String(dbUser.role)) && !GOD_MODE_ROLES.has(String(dbUser.role))) {
    return { ok: false, error: "Nemate permisiju." };
  }
  try {
    await prisma.$transaction(
      moduleKeys.map((key, index) =>
        prisma.dashboardHighlight.updateMany({ where: { moduleKey: key }, data: { order: index } })
      )
    );
  } catch {
    return { ok: false, error: "Greška pri promjeni redoslijeda." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/admin/dashboard-modules");
  return { ok: true };
}
