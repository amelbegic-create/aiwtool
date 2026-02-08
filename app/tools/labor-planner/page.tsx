import { cookies } from "next/headers";
import LaborPlannerClient from "./LaborPlannerClient";

export default async function LaborPlannerPage() {
  const cookieStore = await cookies();
  const defaultRestaurantId = cookieStore.get("activeRestaurantId")?.value ?? null;

  return (
    <LaborPlannerClient defaultRestaurantId={defaultRestaurantId} />
  );
}
