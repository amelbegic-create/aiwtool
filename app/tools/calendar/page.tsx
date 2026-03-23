import { tryRequirePermission, hasPermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getCalendarEventsForDateRange } from "@/app/actions/calendarActions";
import CalendarClient from "./CalendarClient";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const accessResult = await tryRequirePermission("vacation:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="Mein Kalender" />;
  }

  const userId = accessResult.user.id;
  const canWrite = hasPermission(
    accessResult.user.role,
    accessResult.user.permissions ?? [],
    "calendar:write"
  );

  const sp = await searchParams;
  const now = new Date();
  const currentY = now.getFullYear();
  const rawY = sp.year != null && sp.year !== "" ? parseInt(sp.year, 10) : NaN;
  const rawM = sp.month != null && sp.month !== "" ? parseInt(sp.month, 10) : NaN;
  const year = Number.isFinite(rawY)
    ? Math.min(Math.max(rawY, currentY - 1), currentY + 1)
    : currentY;
  const month = Number.isFinite(rawM) ? Math.min(Math.max(rawM, 1), 12) : now.getMonth() + 1;

  const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const initialYearEvents = await getCalendarEventsForDateRange(userId, yearStart, yearEnd);

  return (
    <div className="min-h-screen bg-background">
      <CalendarClient
        userId={userId}
        initialYear={year}
        initialMonth={month}
        initialYearEvents={initialYearEvents}
        canWrite={canWrite}
      />
    </div>
  );
}
