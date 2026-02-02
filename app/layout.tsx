import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import TopNavbar from "@/components/TopNavbar";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import AuthProvider from "@/components/AuthProvider";
// UKLONIO SAM IMPORT switchRestaurant JER GA NE SMIJEMO KORISTITI OVDJE

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AIW Services",
  description: "Enterprise Management System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  
  let userRestaurants: { id: string; name: string | null; code: string }[] = [];
  let activeRestaurantId: string | undefined = undefined;

  if (session?.user) {
      const cookieStore = await cookies();
      activeRestaurantId = cookieStore.get('activeRestaurantId')?.value;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = session.user as any;
      const userId = user.id;
      const role = user.role;

      const isBoss = ['SYSTEM_ARCHITECT', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role);

      if (isBoss) {
          // Boss vidi sve
          const allRests = await prisma.restaurant.findMany({
              where: { isActive: true },
              select: { id: true, name: true, code: true }
          });
          userRestaurants = allRests;
      } else {
          // Radnik vidi samo svoje
          const relations = await prisma.restaurantUser.findMany({
              where: { userId },
              include: { restaurant: true }
          });
          userRestaurants = relations.map(rel => ({
              id: rel.restaurant.id,
              name: rel.restaurant.name,
              code: rel.restaurant.code
          }));
      }

      // --- NUMERIČKO SORTIRANJE ---
      userRestaurants.sort((a, b) => {
         const numA = parseInt(a.name || "0");
         const numB = parseInt(b.name || "0");
         
         if (!isNaN(numA) && !isNaN(numB)) {
             return numA - numB;
         }
         return (a.name || "").localeCompare(b.name || "");
      });

      // --- FIX: OBRISANO AUTOMATSKO SPAŠAVANJE KOLAČIĆA ---
      // Ako nema odabranog restorana, samo vizuelno uzmi prvi,
      // ali NE SMIJEMO zvati 'await switchRestaurant' ovdje jer to ruši build.
      if (!activeRestaurantId && userRestaurants.length > 0) {
          activeRestaurantId = userRestaurants[0].id;
      }
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider hasSession={!!session?.user}>
            {session?.user && (
                <TopNavbar 
                    restaurants={userRestaurants} 
                    activeRestaurantId={activeRestaurantId} 
                />
            )}
            {children}
        </AuthProvider>
      </body>
    </html>
  );
}