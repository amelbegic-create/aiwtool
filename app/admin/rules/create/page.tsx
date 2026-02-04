import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import prisma from "@/lib/prisma";
import { getCategories } from "@/app/actions/ruleActions";
import RuleEditor from "@/app/admin/rules/_components/RuleEditor";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AdminRulesCreatePage() {
  const access = await tryRequirePermission("rules:access");
  if (!access.ok) {
    return <NoPermission moduleName="Pravila (admin)" />;
  }

  const [categories, restaurants] = await Promise.all([
    getCategories(),
    prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <Link
          href="/admin/rules"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#1a3826] hover:text-[#142e1e] mb-6"
        >
          <ArrowLeft size={18} /> Natrag na listu pravila
        </Link>
        <RuleEditor
          initialRule={null}
          categories={categories}
          restaurants={restaurants}
          redirectTo="/admin/rules"
        />
      </div>
    </div>
  );
}
