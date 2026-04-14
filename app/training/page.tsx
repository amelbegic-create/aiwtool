import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getTrainingScheduleForPublicView } from "@/app/actions/trainingActions";
import TrainingPublicClient from "./TrainingPublicClient";
import prisma from "@/lib/prisma";
import { hasPermission } from "@/lib/access";

export const metadata = {
  title: "Training | AIW Services",
  description: "Schulungstermine und Teilnehmerübersicht",
};

/** Kein statisches Caching – Gast/Login und Inhalte immer aktuell. */
export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const session = await getServerSession(authOptions);
  const initial = await getTrainingScheduleForPublicView();

  let canManageTraining = false;
  if (session?.user?.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true, permissions: true },
    });
    if (dbUser) {
      canManageTraining = hasPermission(
        String(dbUser.role),
        dbUser.permissions ?? [],
        "training:manage"
      );
    }
  }

  return (
    <TrainingPublicClient
      isLoggedIn={Boolean(session?.user?.email)}
      canManageTraining={canManageTraining}
      initialLocked={initial.locked}
      initialPrograms={initial.locked ? [] : initial.programs}
    />
  );
}
