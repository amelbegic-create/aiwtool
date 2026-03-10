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

/** Vadi kratku, sigurnu poruku iz greške (bez connection stringova). */
function getSafeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const maxLen = 280;
  let out = raw
    .replace(/postgresql:\/\/[^\s]+/gi, "[REDACTED]")
    .replace(/[\s\S]*?@ep-[^\s]+/g, "[REDACTED]")
    .trim();
  if (out.length > maxLen) out = out.slice(0, maxLen) + "…";
  return out || "Nepoznata greška.";
}

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
  let session: Awaited<ReturnType<typeof getServerSession>> = null;
  let userRestaurants: { id: string; name: string | null; code: string }[] = [];
  let activeRestaurantId: string | undefined = undefined;
  let pendingNotifications = 0;
  let topbarNotifications: Awaited<ReturnType<typeof getNotificationsForUser>>["items"] = [];
  let layoutError: string | null = null;

  try {
    session = await getServerSession(authOptions);
  } catch (authErr) {
    console.error("[Layout] getServerSession error:", authErr);
    layoutError = "NEXTAUTH_SECRET ili NEXTAUTH_URL nisu postavljeni na Vercelu.";
  }

  if (!layoutError && session?.user) {
      try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const user = session.user as any;
          const userId = user.id;
          const role = user.role;

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

          userRestaurants.sort((a, b) => {
             const numA = parseInt(a.name || "0");
             const numB = parseInt(b.name || "0");
             if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
             return (a.name || "").localeCompare(b.name || "");
          });
          userRestaurants = userRestaurants.filter((r) => r.id !== "all");

          const allowedIds = userRestaurants.map((r) => r.id);
          if (allowedIds.length > 0) {
              const resolved = await ensureActiveRestaurantId({
                  allowedRestaurantIds: allowedIds,
                  preferredRestaurantId,
              });
              activeRestaurantId = resolved && resolved !== "all" ? resolved : undefined;
          }

          const notifResult = await getNotificationsForUser(userId);
          pendingNotifications = notifResult.count;
          topbarNotifications = notifResult.items;
      } catch (dbErr) {
          console.error("[Layout] DB/notifications error:", dbErr);
          const hasDbUrl = !!process.env.DATABASE_URL;
          const detail = getSafeErrorMessage(dbErr);
          const base = hasDbUrl
            ? "Baza nije dostupna (povezivanje ne uspijeva). Provjerite DATABASE_URL i DIRECT_URL – moraju biti LIVE Neon URL-ovi."
            : "DATABASE_URL nije postavljen na ovom projektu. Dodajte env varijable u projekt koji služi www.aiw.services.";
          layoutError = `${base} Detalj: ${detail}`;
      }
  }

  if (layoutError) {
    return (
      <html lang="de">
        <body className={inter.className} style={{ margin: 0, padding: "2rem", fontFamily: "system-ui", background: "#f5f5f5" }}>
          <div style={{ maxWidth: "520px", margin: "0 auto", background: "#fff", padding: "2rem", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <h1 style={{ color: "#1a3826", marginBottom: "0.5rem" }}>Konfiguracija aplikacije</h1>
            <p style={{ color: "#666", marginBottom: "1rem" }}>{layoutError}</p>
            <p style={{ fontSize: "0.875rem", color: "#888", marginBottom: "0.75rem" }}>
              <strong>Važno:</strong> Ako koristite www.aiw.services, env varijable moraju biti u <strong>onom Vercel projektu na kojem je ta domena</strong> (Settings → Domains). To je često drugi projekt od onoga na koji šaljete iz CLI-ja.
            </p>
            <p style={{ fontSize: "0.875rem", color: "#888" }}>
              Vercel → odaberi <strong>projekt s domenom aiw.services</strong> → Settings → Environment Variables → Production. Dodaj: DATABASE_URL, DIRECT_URL (LIVE Neon), NEXTAUTH_SECRET, NEXTAUTH_URL = https://www.aiw.services, BLOB_READ_WRITE_TOKEN, RESEND_API_KEY. Zatim Redeploy.
            </p>
          </div>
        </body>
      </html>
    );
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