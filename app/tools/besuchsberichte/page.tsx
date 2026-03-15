import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { resolveRestaurantIdForUser, getCategories } from "@/app/actions/visitReportActions";
import BesuchsberichteCategoriesClient from "./BesuchsberichteCategoriesClient";

export default async function BesuchsberichtePage() {
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

  const restaurantId = await resolveRestaurantIdForUser(userId);
  const categories = restaurantId ? await getCategories(restaurantId) : [];

  return (
    <div className="min-h-screen bg-background">
      <BesuchsberichteCategoriesClient
        categories={categories}
        hasRestaurant={!!restaurantId}
      />
    </div>
  );
}
