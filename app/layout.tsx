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
import { getNotificationsForUser } from "@/app/actions/notificationActions";
import { ensureActiveRestaurantId } from "@/app/actions/restaurantContext";

const inter = Inter({ subsets: ["latin"] });

// Cache-bust za favicon da live uvijek dobije aktualnu ikonu (logo.png u public/)
const FAVICON_VERSION = "3";
export const metadata: Metadata = {
  title: dict.app_title,
  description: dict.app_description,
  icons: {
    icon: "/logo.png?v=" + FAVICON_VERSION,
    apple: "/logo.png?v=" + FAVICON_VERSION,
  },
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
  let topbarNotifications: Awaited<ReturnType<typeof getNotificationsForUser>>["items"] = [];

  if (session?.user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = session.user as any;
      const userId = user.id;
      const role = user.role;

      // Samo SYSTEM_ARCHITECT, SUPER_ADMIN i ADMIN vide sve restorane. MANAGER i CREW samo svoje.
      const canSeeAllRestaurants = ['SYSTEM_ARCHITECT', 'SUPER_ADMIN', 'ADMIN'].includes(role);

      let preferredRestaurantId: string | undefined;

      if (canSeeAllRestaurants) {
          const allRests = await prisma.restaurant.findMany({
              where: { isActive: true },
              select: { id: true, name: true, code: true }
          });
          userRestaurants = allRests;
      } else {
          const relations = await prisma.restaurantUser.findMany({
              where: { userId },
              select: { restaurantId: true, isPrimary: true, restaurant: { select: { id: true, name: true, code: true } } },
          });
          userRestaurants = relations.map((rel) => ({
              id: rel.restaurant.id,
              name: rel.restaurant.name,
              code: rel.restaurant.code,
          }));
          const primary = relations.find((r) => r.isPrimary);
          preferredRestaurantId = primary?.restaurantId;
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

      // Bez opcije "Alle Restaurants" – nikad ne prikazujemo "all" u switcheru
      userRestaurants = userRestaurants.filter((r) => r.id !== "all");

      // Auto-odabir restorana nakon logina: ako nema cookie ili je nevaljan, postavi prvi/primary
      const allowedIds = userRestaurants.map((r) => r.id);
      if (allowedIds.length > 0) {
          const resolved = await ensureActiveRestaurantId({
              allowedRestaurantIds: allowedIds,
              preferredRestaurantId,
          });
          activeRestaurantId = resolved && resolved !== "all" ? resolved : undefined;
      }

      // --- NOTIFIKACIJE ZA TOPNAV (zahtjevi) ---
      const ADMIN_ROLES = new Set<Role>([
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.SYSTEM_ARCHITECT,
        Role.MANAGER,
      ]);

      const notifResult = await getNotificationsForUser(userId);
      pendingNotifications = notifResult.count;
      topbarNotifications = notifResult.items;
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
                        notifications={topbarNotifications.map((n) => ({
                          id: n.id,
                          kind: n.kind,
                          title: n.title,
                          description: n.description,
                          href: n.href,
                          createdAt: n.createdAt,
                          actorName: n.actorName,
                          actorImage: n.actorImage,
                          actorInitials: n.actorInitials,
                          restaurantName: n.restaurantName,
                          vacationStatus: n.vacationStatus,
                          vacationDates: n.vacationDates,
                        }))}
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