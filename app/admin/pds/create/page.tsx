import Link from "next/link";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import prisma from "@/lib/prisma";
import PDSForm from "../_components/PDSForm";
import { PDSGoal, PDSScaleLevel } from "@/app/tools/PDS/types";

export const dynamic = "force-dynamic";

const DEFAULT_GOALS: PDSGoal[] = [
  {
    title: "Novi cilj",
    type: "NUMERIC",
    scoringRules: [],
    result: "",
    points: 0,
  },
];

const DEFAULT_SCALE: PDSScaleLevel[] = [
  { label: "Nedovoljan", min: 0, max: 49, colorHex: "#ef4444" },
  { label: "Dovoljan", min: 50, max: 74, colorHex: "#f59e0b" },
  { label: "Dobar", min: 75, max: 89, colorHex: "#22c55e" },
  { label: "Odličan", min: 90, max: 100, colorHex: "#1a3826" },
];

export default async function AdminPDSCreatePage() {
  const accessResult = await tryRequirePermission("pds:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="PDS obrasci" />;
  }

  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/pds"
            className="text-slate-500 hover:text-[#1a3826] font-medium text-sm"
          >
            ← Povratak na listu
          </Link>
        </div>
        <h1 className="text-2xl font-black text-[#1a3826] uppercase tracking-tight">
          Kreiraj novi PDS obrazac
        </h1>
        <PDSForm
          restaurants={restaurants}
          initialData={null}
          defaultGoals={DEFAULT_GOALS}
          defaultScale={DEFAULT_SCALE}
        />
      </div>
    </div>
  );
}
