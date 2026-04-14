import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import prisma from "@/lib/prisma";
import { getUserVacationYearSnapshot } from "@/app/actions/vacationActions";
import { getCertificatesForUser } from "@/app/actions/certificateActions";
import { getCalendarEvents } from "@/app/actions/calendarActions";
import { getMyIdeas } from "@/app/actions/ideaActions";
import { getMyOneOnOneOpenCount, getSupervisorInboxCount } from "@/app/actions/oneOnOneActions";
import ProfileHubClient from "./ProfileHubClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mein Hub | AIW Services",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const sp = await searchParams;
  const initialTab = sp?.tab ?? "personal";

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      supervisorId: true,
      supervisor: { select: { id: true, name: true, email: true, image: true } },
      department: { select: { id: true, name: true, color: true } },
      restaurants: {
        where: { restaurant: { isActive: true } },
        include: { restaurant: { select: { id: true, code: true, name: true } } },
        orderBy: { isPrimary: "desc" },
      },
      vacationEntitlement: true,
    },
  });

  if (!dbUser) redirect("/login");

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [vacationSnapshot, certResult, myIdeas, calendarEvents, openTopicsCount, supervisorInboxCount, subCount] =
    await Promise.allSettled([
      getUserVacationYearSnapshot(userId, currentYear),
      getCertificatesForUser(userId),
      getMyIdeas(),
      getCalendarEvents(userId, currentYear, currentMonth),
      getMyOneOnOneOpenCount(),
      getSupervisorInboxCount(),
      prisma.user.count({ where: { supervisorId: userId } }),
    ]);

  const vacation = vacationSnapshot.status === "fulfilled" ? vacationSnapshot.value : null;
  const certificates = certResult.status === "fulfilled" && certResult.value.ok ? certResult.value.data : [];
  const ideas = myIdeas.status === "fulfilled" ? myIdeas.value : [];
  const calEvents = calendarEvents.status === "fulfilled" ? calendarEvents.value : [];
  const openTopics = openTopicsCount.status === "fulfilled" ? openTopicsCount.value : 0;
  const inboxTopics = supervisorInboxCount.status === "fulfilled" ? supervisorInboxCount.value : 0;
  const hasSubordinates = subCount.status === "fulfilled" ? subCount.value > 0 : false;

  return (
    <Suspense>
      <ProfileHubClient
        initialTab={initialTab}
        user={{
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          image: dbUser.image,
          role: String(dbUser.role),
          supervisorId: dbUser.supervisorId,
          supervisorName: dbUser.supervisor?.name ?? null,
          supervisorImage: dbUser.supervisor?.image ?? null,
          department: dbUser.department,
          restaurants: dbUser.restaurants.map((r) => ({
            id: r.restaurant.id,
            code: r.restaurant.code,
            name: r.restaurant.name,
            isPrimary: r.isPrimary,
          })),
          vacationEntitlement: dbUser.vacationEntitlement,
        }}
        vacation={vacation}
        currentYear={currentYear}
        certificates={certificates.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          imageUrl: c.imageUrl,
          pdfUrl: c.pdfUrl,
          pdfName: c.pdfName,
          createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
        }))}
        ideas={ideas}
        calendarEvents={calEvents}
        openTopicsCount={openTopics}
        supervisorInboxCount={inboxTopics}
        hasSubordinates={hasSubordinates}
      />
    </Suspense>
  );
}
