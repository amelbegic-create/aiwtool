import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { listHolidays } from "@/app/actions/holidayActions";
import {
  listBlockedDays,
  listRestaurantsForBlockedDays,
} from "@/app/actions/blockedDayActions";
import HolidaysClient from "./HolidaysClient";

export default async function AdminHolidaysPage() {
  const access = await tryRequirePermission("holidays:manage");
  if (!access.ok) {
    return <NoPermission moduleName="Feiertage" />;
  }

  const [holidays, blockedDays, restaurants] = await Promise.all([
    listHolidays(),
    listBlockedDays(),
    listRestaurantsForBlockedDays(),
  ]);

  return (
    <HolidaysClient
      initialHolidays={holidays}
      initialBlockedDays={blockedDays}
      restaurants={restaurants}
    />
  );
}
