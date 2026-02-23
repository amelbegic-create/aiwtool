import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { listHolidays } from "@/app/actions/holidayActions";
import HolidaysClient from "./HolidaysClient";

export default async function AdminHolidaysPage() {
  const access = await tryRequirePermission("holidays:manage");
  if (!access.ok) {
    return <NoPermission moduleName="Feiertage" />;
  }

  const holidays = await listHolidays();
  return <HolidaysClient initialHolidays={holidays} />;
}
