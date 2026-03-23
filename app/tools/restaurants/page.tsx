import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getSitzplanForUser } from "@/app/actions/sitzplanActions";
import RestaurantsHubClient from "./RestaurantsHubClient";

export default async function RestaurantsHubPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const sitzplanData = await getSitzplanForUser();

  return (
    <div className="min-h-screen bg-background">
      <RestaurantsHubClient
        sitzplanPdfs={sitzplanData?.sitzplanPdfs ?? []}
        restaurantName={sitzplanData?.restaurantName ?? "Restaurant"}
      />
    </div>
  );
}
