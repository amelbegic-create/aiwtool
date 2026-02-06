import { loadLatestBonusSheet, syncEmployeesWithUsers } from "@/app/actions/bonusActions";
import BonusToolClient from "./BonusToolClient";

export const dynamic = "force-dynamic";

export default async function BonusiPage() {
  const baseState = await loadLatestBonusSheet();
  const initialState = await syncEmployeesWithUsers(baseState);

  return (
    <BonusToolClient initialState={initialState} />
  );
}