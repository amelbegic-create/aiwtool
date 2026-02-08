import { cookies } from "next/headers";
import ProductivityClient from "./ProductivityClient";

export default async function ProductivityPage() {
  const cookieStore = await cookies();
  const defaultRestaurantId = cookieStore.get("activeRestaurantId")?.value ?? null;

  return (
    <ProductivityClient defaultRestaurantId={defaultRestaurantId} />
  );
}
