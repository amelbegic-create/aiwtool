import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getMyTeamData, getTeamTreeData } from "@/app/actions/teamActions";
import TeamPageClient from "./TeamPageClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/login");

  let team: Awaited<ReturnType<typeof getMyTeamData>> = [];
  let treeData: Awaited<ReturnType<typeof getTeamTreeData>> = [];
  try {
    [team, treeData] = await Promise.all([getMyTeamData(), getTeamTreeData()]);
  } catch (err) {
    console.error("Team page data load failed:", err);
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="max-w-[1600px] mx-auto px-4 py-4 sm:py-5 sm:p-6 md:p-10 safe-area-l safe-area-r">
        <h1 className="text-2xl md:text-3xl font-black text-[#1a3826] uppercase tracking-tighter mb-1">
          Mein <span className="text-[#FFC72C]">Team</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium mb-4 md:mb-8">
          Liste der Mitarbeiter, für die Sie direkt verantwortlich sind.
        </p>
        <TeamPageClient
          initialTeam={team}
          treeData={treeData}
          currentUserId={userId}
        />
      </div>
    </div>
  );
}
