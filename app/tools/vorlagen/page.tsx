import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getCategories } from "@/app/actions/templateActions";
import VorlagenCategoriesClient from "./VorlagenCategoriesClient";

export default async function VorlagenPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-muted-foreground">
        Bitte melden Sie sich an.
      </div>
    );
  }

  const categories = await getCategories();

  return (
    <div className="min-h-screen bg-background">
      <VorlagenCategoriesClient categories={categories} />
    </div>
  );
}
