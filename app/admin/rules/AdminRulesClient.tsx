"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  BarChart3,
  BookOpen,
  Eye,
  EyeOff,
} from "lucide-react";
import { deleteRule, toggleRuleStatus, getRuleStatsSummary } from "@/app/actions/ruleActions";
import RuleStatsModal from "@/app/tools/rules/_components/RuleStatsModal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type RuleRow = {
  id: string;
  title: string;
  categoryId: string;
  category?: { name: string } | null;
  priority: string;
  isActive: boolean;
  imageUrl?: string | null;
  images?: Array<{ url: string }>;
  createdAt: string;
};

interface AdminRulesClientProps {
  initialRules: RuleRow[];
  categories: Array<{ id: string; name: string }>;
}

function getCoverUrl(rule: RuleRow): string | null {
  if (rule.imageUrl) return rule.imageUrl;
  const first = rule.images?.[0];
  return first?.url ?? null;
}

export default function AdminRulesClient({
  initialRules,
  categories,
}: AdminRulesClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("SVE");
  const [statsRule, setStatsRule] = useState<{ id: string; title: string } | null>(null);
  const [statsSummary, setStatsSummary] = useState<Record<string, { readCount: number; totalCount: number }>>({});

  const filteredRules = initialRules.filter((r) => {
    const matchCat = filterCategory === "SVE" || r.categoryId === filterCategory;
    const matchSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      initialRules.map(async (r) => {
        const summary = await getRuleStatsSummary(r.id);
        return { id: r.id, ...summary };
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, { readCount: number; totalCount: number }> = {};
      results.forEach(({ id, readCount, totalCount }) => {
        map[id] = { readCount, totalCount };
      });
      setStatsSummary(map);
    });
    return () => {
      cancelled = true;
    };
  }, [initialRules]);

  const handleDelete = async (id: string) => {
    if (!confirm("Sigurno obrisati pravilo?")) return;
    await deleteRule(id);
    toast.success("Pravilo obrisano.");
    router.refresh();
  };

  const handleToggleStatus = async (id: string, current: boolean) => {
    await toggleRuleStatus(id, current);
    toast.success(current ? "Pravilo arhivirano." : "Pravilo aktivirano.");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-10 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter mb-2">
              Upravljanje <span className="text-[#FFC72C]">Pravilima</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Tabela pravila, statistika čitanja, uređivanje i brisanje
            </p>
          </div>
          <Link
            href="/admin/rules/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a3826] text-white rounded-xl text-sm font-black hover:bg-[#142e1e] transition-colors"
          >
            <Plus size={18} /> Novo pravilo
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search size={18} className="text-slate-400" />
              <input
                type="text"
                placeholder="Pretraži pravila..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm font-medium text-slate-700"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none"
            >
              <option value="SVE">Sve kategorije</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-black uppercase tracking-wider text-slate-600">
                  <th className="p-4 w-24">Slika</th>
                  <th className="p-4">Naslov</th>
                  <th className="p-4">Kategorija</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Statistika čitanja</th>
                  <th className="p-4 text-right">Akcije</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500 font-medium">
                      Nema pravila za prikaz.
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => {
                    const cover = getCoverUrl(rule);
                    const summary = statsSummary[rule.id];
                    return (
                      <tr
                        key={rule.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="p-4">
                          <div className="w-20 h-12 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                            {cover ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={cover}
                                alt={rule.title ? `Naslovnica: ${rule.title}` : "Naslovnica pravila"}
                                className="object-cover w-full h-full min-w-full min-h-full"
                              />
                            ) : (
                              <BookOpen size={20} className="text-slate-400" />
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-slate-900">{rule.title}</span>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                            {rule.category?.name ?? "—"}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={
                              rule.isActive
                                ? "text-green-700 font-bold"
                                : "text-amber-700 font-bold"
                            }
                          >
                            {rule.isActive ? "Aktivan" : "Draft"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(rule.id, rule.isActive)}
                            className="ml-2 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                            title={rule.isActive ? "Sakrij" : "Aktiviraj"}
                          >
                            {rule.isActive ? (
                              <EyeOff size={14} />
                            ) : (
                              <Eye size={14} />
                            )}
                          </button>
                        </td>
                        <td className="p-4">
                          {summary ? (
                            <span className="text-sm font-medium text-slate-700">
                              {summary.readCount}/{summary.totalCount} pročitalo
                            </span>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setStatsRule({ id: rule.id, title: rule.title })}
                            className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1a3826]/10 text-[#1a3826] text-xs font-bold hover:bg-[#1a3826]/20"
                          >
                            <BarChart3 size={14} /> Statistika
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/rules/${rule.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                            >
                              <Edit2 size={14} /> Uredi
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(rule.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold"
                            >
                              <Trash2 size={14} /> Obriši
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {statsRule && (
        <RuleStatsModal
          ruleId={statsRule.id}
          ruleTitle={statsRule.title}
          open={true}
          onClose={() => setStatsRule(null)}
        />
      )}
    </div>
  );
}
