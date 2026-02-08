import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getMyTeamData } from "@/app/actions/teamActions";
import TeamPageClient from "./TeamPageClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/login");

  const team = await getMyTeamData();

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="max-w-[1600px] mx-auto p-6 md:p-10">
        <h1 className="text-3xl font-black text-[#1a3826] uppercase tracking-tighter mb-1">
          Moj <span className="text-[#FFC72C]">Tim</span>
        </h1>
        <p className="text-slate-500 text-sm font-medium mb-8">
          Lista zaposlenika kojima ste direktni nadređeni
        </p>
        <TeamPageClient initialTeam={team} />
      </div>
    </div>
  );
}
