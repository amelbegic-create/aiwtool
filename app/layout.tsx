import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import TopNavbar from "@/components/TopNavbar"; 
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import AuthProvider from "@/components/AuthProvider";

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
  
  // FIX: Umjesto 'any[]', definiramo točan tip da maknemo crvenu liniju
  let userRestaurants: { id: string; name: string | null; code: string }[] = [];
  let activeRestaurantId: string | undefined = undefined;

  if (session?.user) {
     const cookieStore = await cookies();
     activeRestaurantId = cookieStore.get('activeRestaurantId')?.value;

     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     const userId = (session.user as any).id;
     
     const relations = await prisma.restaurantUser.findMany({
         where: { userId },
         include: { restaurant: true }
     });

     userRestaurants = relations.map(rel => ({
         id: rel.restaurant.id,
         name: rel.restaurant.name,
         code: rel.restaurant.code
     }));

     if (!activeRestaurantId && userRestaurants.length > 0) {
         activeRestaurantId = userRestaurants[0].id;
     }
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
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