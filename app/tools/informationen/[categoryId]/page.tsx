import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getInformationItems } from "@/app/actions/informationActions";
import prisma from "@/lib/prisma";
import InformationenListClient from "./InformationenListClient";

export default async function InformationenCategoryPage({
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
  const [category, items] = await Promise.all([
    prisma.informationCategory.findUnique({ where: { id: categoryId } }),
    getInformationItems(categoryId),
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
      <InformationenListClient category={category} items={items} />
    </div>
  );
}
