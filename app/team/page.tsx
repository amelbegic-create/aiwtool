import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getMyTeamData, getTeamTreeData } from "@/app/actions/teamActions";
import { getDbUserForAccess, hasPermission } from "@/lib/access";
import TeamPageClient from "./TeamPageClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/login");

  const dbUser = await getDbUserForAccess();
  const canLinkToAdminUserEdit = hasPermission(
    String(dbUser.role),
    dbUser.permissions ?? [],
    "users:manage"
  );

  let team: Awaited<ReturnType<typeof getMyTeamData>> = [];
  let treeData: Awaited<ReturnType<typeof getTeamTreeData>> = [];
  try {
    [team, treeData] = await Promise.all([getMyTeamData(), getTeamTreeData()]);
  } catch (err) {
    console.error("Team page data load failed:", err);
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">
        {/* HEADER – unificirani layout */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
              MEIN <span className="text-[#FFC72C]">TEAM</span>
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Liste der Mitarbeiter, für die Sie direkt verantwortlich sind.
            </p>
          </div>
        </div>

        <div className="mt-6 sm:mt-8">
          <TeamPageClient
            initialTeam={team}
            treeData={treeData}
            currentUserId={userId}
            canLinkToAdminUserEdit={canLinkToAdminUserEdit}
          />
        </div>
      </div>
    </div>
  );
}
