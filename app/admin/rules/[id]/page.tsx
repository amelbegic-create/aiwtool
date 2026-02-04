import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import prisma from "@/lib/prisma";
import { getCategories } from "@/app/actions/ruleActions";
import RuleEditor from "@/app/admin/rules/_components/RuleEditor";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export default async function AdminRulesEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await tryRequirePermission("rules:access");
  if (!access.ok) {
    return <NoPermission moduleName="Pravila (admin)" />;
  }

  const { id } = await params;

  const [rule, categories, restaurants] = await Promise.all([
    prisma.rule.findUnique({
      where: { id },
      include: {
        category: true,
        restaurants: true,
        images: true,
      },
    }),
    getCategories(),
    prisma.restaurant.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  if (!rule) notFound();

  const initialRule = {
    id: rule.id,
    title: rule.title,
    categoryId: rule.categoryId,
    priority: rule.priority,
    content: rule.content ?? "",
    videoUrl: rule.videoUrl ?? "",
    pdfUrls: rule.pdfUrls ?? [],
    imageUrl: rule.imageUrl ?? null,
    isGlobal: rule.isGlobal,
    restaurants: rule.restaurants.map((r) => ({ restaurantId: r.restaurantId })),
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-10">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/admin/rules"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#1a3826] hover:underline mb-6"
        >
          <ArrowLeft size={18} /> Natrag na listu pravila
        </Link>
        <h1 className="text-2xl font-black text-[#1a3826] mb-6">Uredi pravilo</h1>
        <RuleEditor
          initialRule={initialRule}
          categories={categories}
          restaurants={restaurants}
          redirectTo="/admin/rules"
        />
      </div>
    </div>
  );
}
