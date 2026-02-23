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
    <div className="min-h-screen bg-background">
      <RulesUserView
        initialRules={rules}
        categories={categories}
        canEdit={canEdit}
      />
    </div>
  );
}
