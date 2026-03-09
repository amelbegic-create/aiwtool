import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getTemplates } from "@/app/actions/templateActions";
import prisma from "@/lib/prisma";
import VorlagenListClient from "./VorlagenListClient";

export default async function VorlagenCategoryPage({
  params,
}: {
  params: { categoryId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-muted-foreground">
        Bitte melden Sie sich an.
      </div>
    );
  }

  const { categoryId } = params;
  const [category, templates] = await Promise.all([
    prisma.templateCategory.findUnique({ where: { id: categoryId } }),
    getTemplates(categoryId),
  ]);

  if (!category) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-muted-foreground">
        Kategorie nicht gefunden.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <VorlagenListClient category={category} templates={templates} />
    </div>
  );
}
