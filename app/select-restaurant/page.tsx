import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import SelectRestaurantClient from "./SelectRestaurantClient";

export default async function SelectRestaurantPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user?.email as string },
    include: {
      restaurants: {
        include: { restaurant: true }
      }
    }
  });

  if (!user) redirect("/login");

  // --- FIX ZA TYPE ERROR ---
  // Mapiramo podatke tako da zamijenimo 'null' sa praznim stringom ili fallbackom
  const formattedRestaurants = user.restaurants.map((ur) => ({
    id: ur.restaurant.id,
    code: ur.restaurant.code,
    name: ur.restaurant.name || "Nepoznat restoran", // Fallback za null
    city: ur.restaurant.city || "",
    address: ur.restaurant.address || ""
  }));

  return (
    <SelectRestaurantClient 
      restaurants={formattedRestaurants} 
      userName={user.name || "Kolega"} 
    />
  );
}