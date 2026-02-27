import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import TopNavbar from "@/components/TopNavbar";
import BottomNav from "@/components/BottomNav";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import AuthProvider from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";
import { Role } from "@prisma/client";
import { dict } from "@/translations";
// UKLONIO SAM IMPORT switchRestaurant JER GA NE SMIJEMO KORISTITI OVDJE

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: dict.app_title,
  description: dict.app_description,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  
  let userRestaurants: { id: string; name: string | null; code: string }[] = [];
  let activeRestaurantId: string | undefined = undefined;
  let pendingNotifications = 0;

  if (session?.user) {
      const cookieStore = await cookies();
      activeRestaurantId = cookieStore.get('activeRestaurantId')?.value;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = session.user as any;
      const userId = user.id;
      const role = user.role;

      // Samo SYSTEM_ARCHITECT, SUPER_ADMIN i ADMIN vide sve restorane. MANAGER i CREW samo svoje.
      const canSeeAllRestaurants = ['SYSTEM_ARCHITECT', 'SUPER_ADMIN', 'ADMIN'].includes(role);

      if (canSeeAllRestaurants) {
          const allRests = await prisma.restaurant.findMany({
              where: { isActive: true },
              select: { id: true, name: true, code: true }
          });
          userRestaurants = allRests;
      } else {
          const relations = await prisma.restaurantUser.findMany({
              where: { userId },
              select: { restaurant: { select: { id: true, name: true, code: true } } },
          });
          userRestaurants = relations.map((rel) => ({
              id: rel.restaurant.id,
              name: rel.restaurant.name,
              code: rel.restaurant.code,
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

      // --- NOTIFIKACIJE ZA TOPNAV (zahtjevi) ---
      const ADMIN_ROLES = new Set<Role>([
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.SYSTEM_ARCHITECT,
        Role.MANAGER,
      ]);

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          vacations: { where: { status: "PENDING" } },
          pdsList: {
            where: {
              year: new Date().getFullYear(),
              status: { in: ["OPEN", "SUBMITTED", "RETURNED"] },
            },
          },
        },
      });

      if (dbUser) {
        const isAdmin = ADMIN_ROLES.has(dbUser.role as Role);
        const pdsPending = dbUser.pdsList?.length ?? 0;

        if (isAdmin) {
          const totalPendingAdmin = await prisma.vacationRequest.count({
            where: { status: "PENDING" },
          });
          pendingNotifications = totalPendingAdmin + pdsPending;
        } else {
          pendingNotifications = 0;
        }
      }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
        {/* Inactivity watchdog (10 min) + session: AutoLogoutProvider unutar AuthProvider */}
        <AuthProvider>
            {session?.user && (
                <>
                    <TopNavbar 
                        restaurants={userRestaurants} 
                        activeRestaurantId={activeRestaurantId}
                        notificationCount={pendingNotifications}
                    />
                    <main className="pt-14 md:pt-16 md:min-h-0 pb-20 md:pb-0 safe-area-b-mobile min-h-screen">
                        {children}
                    </main>
                    <BottomNav />
                </>
            )}
            {!session?.user && children}
            <Toaster
              position="bottom-right"
              closeButton
              duration={4000}
              toastOptions={{
                style: { background: "#FFBC0D", color: "#000", fontWeight: 700, borderRadius: "12px", border: "none" },
                className: "toast-mcd",
              }}
            />
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}