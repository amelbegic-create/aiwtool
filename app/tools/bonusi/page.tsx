import BonusiFrame from "./BonusiFrame";
import { requirePermission } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function BonusiPage() {
  // Admin-only (ako ti je drugačiji key, promijeni ga u tvoj)
  await requirePermission("admin:access");

  // UMJESTO direktnog HTML-a, koristi view route koji ubaci CSS override
  return <BonusiFrame src="/tools/bonusi/view" title="Bonusi" headerOffsetPx={80} />;
}
