import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { resolveRestaurantIdForUser, getCategoryById, getItems } from "@/app/actions/visitReportActions";
import { notFound } from "next/navigation";
import BesuchsberichteListClient from "./BesuchsberichteListClient";

export default async function BesuchsberichteCategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-muted-foreground">
        Bitte melden Sie sich an.
      </div>
    );
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-muted-foreground">
        Sitzung ungültig.
      </div>
    );
  }

  const { categoryId } = await params;

  const restaurantId = await resolveRestaurantIdForUser(userId);
  if (!restaurantId) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-muted-foreground">
        Bitte wählen Sie einen Standort.
      </div>
    );
  }

  const category = await getCategoryById(categoryId, restaurantId);
  if (!category) notFound();

  const items = await getItems(categoryId, restaurantId);

  return (
    <div className="min-h-screen bg-background">
      <BesuchsberichteListClient category={category} initialItems={items} />
    </div>
  );
}
