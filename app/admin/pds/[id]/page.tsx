import { notFound } from "next/navigation";
import Link from "next/link";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getPDSTemplateById } from "@/app/actions/pdsActions";
import prisma from "@/lib/prisma";
import PDSForm from "../_components/PDSForm";
import type { PDSGoal, PDSScaleLevel } from "@/app/tools/PDS/types";

export const dynamic = "force-dynamic";

const DEFAULT_SCALE: PDSScaleLevel[] = [
  { label: "Nedovoljan", min: 0, max: 49, colorHex: "#ef4444" },
  { label: "Dovoljan", min: 50, max: 74, colorHex: "#f59e0b" },
  { label: "Dobar", min: 75, max: 89, colorHex: "#22c55e" },
  { label: "Odličan", min: 90, max: 100, colorHex: "#1a3826" },
];

export default async function AdminPDSEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const accessResult = await tryRequirePermission("pds:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="PDS-Vorlagen" />;
  }

  const { id } = await params;
  const template = await getPDSTemplateById(id);
  if (!template) notFound();

  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const initialData = {
    id: template.id,
    title: template.title,
    year: template.year,
    isGlobal: template.isGlobal,
    goals: Array.isArray(template.goals) ? (template.goals as PDSGoal[]) : [],
    scale: Array.isArray(template.scale) ? (template.scale as PDSScaleLevel[]) : DEFAULT_SCALE,
    restaurantIds: template.restaurantIds,
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans text-foreground">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/pds"
            className="text-muted-foreground hover:text-[#1a3826] dark:hover:text-[#FFC72C] font-medium text-sm"
          >
            ← Zurück zur Liste
          </Link>
        </div>
        <h1 className="text-2xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tight">
          PDS-Vorlage bearbeiten
        </h1>
        <PDSForm
          restaurants={restaurants}
          initialData={initialData}
          defaultGoals={initialData.goals.length > 0 ? initialData.goals : []}
          defaultScale={initialData.scale.length > 0 ? initialData.scale : DEFAULT_SCALE}
        />
      </div>
    </div>
  );
}
