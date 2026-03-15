import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { resolveRestaurantIdForUser, getCategoryById, getItems } from "@/app/actions/visitReportActions";
import { notFound } from "next/navigation";
import BesuchsberichteListClient from "./BesuchsberichteListClient";

export default async function BesuchsberichteCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
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
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = yearParam ? parseInt(yearParam, 10) : currentYear;
  const clampedYear = Number.isFinite(year) ? Math.min(2030, Math.max(2026, year)) : currentYear;
  const safeYear = clampedYear >= 2026 && clampedYear <= 2030 ? clampedYear : (currentYear >= 2026 && currentYear <= 2030 ? currentYear : 2026);

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

  const items = await getItems(categoryId, safeYear, restaurantId);

  return (
    <div className="min-h-screen bg-background">
      <BesuchsberichteListClient
        category={category}
        initialItems={items}
        initialYear={safeYear}
        restaurantId={restaurantId}
      />
    </div>
  );
}
