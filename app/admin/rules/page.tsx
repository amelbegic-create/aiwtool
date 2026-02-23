import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getRules, getCategories, type RuleListItem } from "@/app/actions/ruleActions";
import AdminRulesClient from "./AdminRulesClient";

export default async function AdminRulesPage() {
  const access = await tryRequirePermission("rules:access");
  if (!access.ok) {
    return <NoPermission moduleName="Bedienungsanleitungen (Admin)" />;
  }

  const [rules, categories] = await Promise.all([
    getRules(undefined),
    getCategories(),
  ]);

  const initialRules = rules.map((r: RuleListItem) => ({
    id: r.id,
    title: r.title,
    categoryId: r.categoryId,
    category: r.category,
    priority: r.priority,
    isActive: r.isActive,
    imageUrl: r.imageUrl ?? null,
    images: r.images ?? [],
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));

  return (
    <AdminRulesClient
      initialRules={initialRules}
      categories={categories}
    />
  );
}
