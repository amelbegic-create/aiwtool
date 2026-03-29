import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Lightbulb } from "lucide-react";
import { getMyIdeas } from "@/app/actions/ideaActions";
import MeineIdeenClient from "@/components/dashboard/MeineIdeenClient";

export const dynamic = "force-dynamic";

export default async function MeineIdeenPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const ideas = await getMyIdeas();

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="border-b border-border bg-[#1a3826] text-white">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
            aria-label="Zurück zum Dashboard"
          >
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Lightbulb className="text-[#FFC72C] shrink-0" size={22} />
            <div className="min-w-0">
              <h1 className="text-lg font-black tracking-tight truncate">Meine Ideen</h1>
              <p className="text-[11px] text-white/70 font-medium">
                Status und Rückmeldungen zu deinen Einsendungen
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <MeineIdeenClient initialIdeas={ideas} />
      </div>
    </div>
  );
}
