import { tryRequirePermission, hasPermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getCalendarEvents } from "@/app/actions/calendarActions";
import CalendarClient from "./CalendarClient";

export default async function CalendarPage() {
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

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const initialEvents = await getCalendarEvents(userId, year, month);

  return (
    <div className="min-h-screen bg-background">
      <CalendarClient
        userId={userId}
        initialYear={year}
        initialMonth={month}
        initialEvents={initialEvents}
        canWrite={canWrite}
      />
    </div>
  );
}
