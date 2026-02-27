import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getRules, getCategories } from "@/app/actions/ruleActions";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import RulesUserView from "./_components/RulesUserView";
import prisma from "@/lib/prisma";

const EDIT_ROLES = ["SYSTEM_ARCHITECT", "SUPER_ADMIN", "ADMIN", "MANAGER"];

export default async function RulesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">
        Bitte melden Sie sich an.
      </div>
    );
  }

  const accessResult = await tryRequirePermission("rules:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="Bedienungsanleitungen" />;
  }

  const [rules, categories, dbUser] = await Promise.all([
    getRules(),
    getCategories(),
    prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    }),
  ]);

  const canEdit =
    !!dbUser && EDIT_ROLES.includes(dbUser.role as string);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">
        {/* HEADER – unificirani layout */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
              BEDIENUNGS<span className="text-[#FFC72C]">ANLEITUNGEN</span>
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Wichtige Richtlinien und Anleitungen für Mitarbeiter.
            </p>
          </div>
        </div>

        <div className="mt-6 sm:mt-8">
          <RulesUserView initialRules={rules} categories={categories} canEdit={canEdit} />
        </div>
      </div>
    </div>
  );
}
