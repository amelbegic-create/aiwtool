import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getInformationCategories } from "@/app/actions/informationActions";
import InformationenCategoriesClient from "./InformationenCategoriesClient";

export default async function InformationenPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-muted-foreground">
        Bitte melden Sie sich an.
      </div>
    );
  }

  const categories = await getInformationCategories();

  return (
    <div className="min-h-screen bg-background">
      <InformationenCategoriesClient categories={categories} />
    </div>
  );
}
