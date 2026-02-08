import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getRules, getCategories } from "@/app/actions/ruleActions";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import RulesUserView from "./_components/RulesUserView";

export default async function RulesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">
        Molimo prijavite se.
      </div>
    );
  }

  const accessResult = await tryRequirePermission("rules:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="Pravila i procedure" />;
  }

  const [rules, categories] = await Promise.all([
    getRules(),
    getCategories(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <RulesUserView initialRules={rules} categories={categories} />
    </div>
  );
}
