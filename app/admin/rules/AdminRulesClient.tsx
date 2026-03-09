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
  BookMarked,
  Filter,
  X,
  Pencil,
  Check,
  Folders,
} from "lucide-react";
import {
  deleteRule,
  toggleRuleStatus,
  getRuleStatsSummary,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
} from "@/app/actions/ruleActions";
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
  return rule.images?.[0]?.url ?? null;
}

function priorityBadge(p: string) {
  if (p === "URGENT")
    return { label: "Dringend", cls: "bg-red-100 text-red-700 border-red-200" };
  if (p === "MANDATORY")
    return { label: "Pflicht", cls: "bg-[#FFC72C]/25 text-[#1a3826] border-[#FFC72C]/50" };
  return { label: "Information", cls: "bg-sky-100 text-sky-700 border-sky-200" };
}

export default function AdminRulesClient({
  initialRules,
  categories: initialCategories,
}: AdminRulesClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALLE");
  const [statsRule, setStatsRule] = useState<{ id: string; title: string } | null>(null);
  const [statsSummary, setStatsSummary] = useState<Record<string, { readCount: number; totalCount: number }>>({});

  // Kategorien modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  const [newCatName, setNewCatName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  const refreshCats = async () => {
    const list = await getCategories();
    setCategories(list);
    router.refresh();
  };

  const handleAddCat = async () => {
    const name = newCatName.trim();
    if (!name) return;
    setCatSaving(true);
    try {
      await createCategory(name);
      setNewCatName("");
      await refreshCats();
      toast.success("Kategorie hinzugefügt.");
    } catch (e) { toast.error((e as Error)?.message ?? "Fehler."); }
    finally { setCatSaving(false); }
  };

  const handleDeleteCat = async (id: string) => {
    if (!confirm("Kategorie wirklich löschen? Sie muss leer sein.")) return;
    try {
      await deleteCategory(id);
      await refreshCats();
      toast.success("Kategorie gelöscht.");
    } catch (e) { toast.error((e as Error)?.message ?? "Fehler."); }
  };

  const handleRenameCat = async (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    try {
      await updateCategory(id, name);
      setRenamingId(null);
      await refreshCats();
      toast.success("Kategorie umbenannt.");
    } catch (e) { toast.error((e as Error)?.message ?? "Fehler."); }
  };

  const filteredRules = initialRules.filter((r) => {
    const matchCat = filterCategory === "ALLE" || r.categoryId === filterCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      r.title.toLowerCase().includes(q) ||
      (r.category?.name?.toLowerCase() ?? "").includes(q);
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
    return () => { cancelled = true; };
  }, [initialRules]);

  const handleDelete = async (id: string) => {
    if (!confirm("Dieses Dokument wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) return;
    await deleteRule(id);
    toast.success("Dokument gelöscht.");
    router.refresh();
  };

  const handleToggleStatus = async (id: string, current: boolean) => {
    await toggleRuleStatus(id, current);
    toast.success(current ? "Dokument archiviert." : "Dokument aktiviert.");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10 space-y-6 md:space-y-8">

        {/* ── HEADER ── */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Admin · Bedienungsanleitungen
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase text-[#1a3826]">
              Regeln &amp; <span className="text-[#FFC72C]">Arbeitsanweisungen</span>
            </h1>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              Übersicht aller Dokumente mit Lesestatus, Bearbeitung und Kategorieverwaltung.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCatModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-bold text-foreground hover:bg-muted transition shadow-sm"
            >
              <Folders size={16} className="text-[#1a3826]" /> Kategorien
            </button>
            <Link
              href="/admin/rules/create"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a3826] text-white text-sm font-black shadow-lg hover:opacity-90 transition"
            >
              <Plus size={18} /> Neue Regel anlegen
            </Link>
          </div>
        </header>

        {/* ── STATS STRIP ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Gesamt", value: initialRules.length, sub: "Dokumente", icon: BookMarked, color: "text-[#1a3826]", bg: "bg-[#1a3826]/10" },
            { label: "Aktiv", value: initialRules.filter((r) => r.isActive).length, sub: "sichtbar", icon: Eye, color: "text-emerald-700", bg: "bg-emerald-100" },
            { label: "Archiviert", value: initialRules.filter((r) => !r.isActive).length, sub: "ausgeblendet", icon: EyeOff, color: "text-amber-700", bg: "bg-amber-100" },
            { label: "Kategorien", value: categories.length, sub: "aktive", icon: Filter, color: "text-sky-700", bg: "bg-sky-100" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon size={20} className={s.color} />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground leading-none">{s.value}</p>
                <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">{s.label} · {s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── SEARCH + FILTER + TABLE ── */}
        <section className="rounded-2xl md:rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Filter bar */}
          <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border bg-muted/40 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] rounded-xl bg-background border border-border px-3.5 py-2.5">
              <Search size={18} className="text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Titel oder Kategorie suchen…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm font-medium text-foreground"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-semibold text-foreground min-w-[190px] outline-none"
            >
              <option value="ALLE">Alle Kategorien</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground font-medium md:ml-auto shrink-0">
              {filteredRules.length} {filteredRules.length === 1 ? "Dokument" : "Dokumente"}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="px-4 py-3 w-24">Cover</th>
                  <th className="px-4 py-3">Titel</th>
                  <th className="px-4 py-3">Kategorie</th>
                  <th className="px-4 py-3">Priorität</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Lesestatus</th>
                  <th className="px-4 py-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                          <BookOpen size={24} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-muted-foreground">Keine Dokumente gefunden.</p>
                        <p className="text-xs text-muted-foreground">Filter oder Suchbegriff anpassen.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => {
                    const cover = getCoverUrl(rule);
                    const summary = statsSummary[rule.id];
                    const pr = priorityBadge(rule.priority);
                    const readPct = summary && summary.totalCount > 0
                      ? Math.round((summary.readCount / summary.totalCount) * 100)
                      : null;

                    return (
                      <tr key={rule.id} className="border-b border-border/70 hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="w-20 h-12 rounded-lg bg-muted overflow-hidden flex items-center justify-center border border-border/60">
                            {cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={cover} alt={rule.title || "Dokument"} className="object-cover w-full h-full" />
                            ) : (
                              <BookOpen size={18} className="text-muted-foreground" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-foreground">{rule.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(rule.createdAt).toLocaleDateString("de-AT", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2.5 py-1 rounded-full bg-muted text-[11px] font-semibold text-foreground">
                            {rule.category?.name ?? "–"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${pr.cls}`}>
                            {pr.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border w-fit ${rule.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${rule.isActive ? "bg-emerald-500" : "bg-amber-400"}`} />
                              {rule.isActive ? "Aktiv" : "Archiviert"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(rule.id, rule.isActive)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted/60 transition w-fit"
                            >
                              {rule.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                              {rule.isActive ? "Ausblenden" : "Aktivieren"}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {summary ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-foreground">
                                  {summary.readCount}/{summary.totalCount}
                                </span>
                                {readPct !== null && (
                                  <span className={`text-[11px] font-bold ${readPct >= 80 ? "text-emerald-600" : readPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                    {readPct}%
                                  </span>
                                )}
                              </div>
                              {summary.totalCount > 0 && (
                                <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full bg-[#1a3826] transition-all" style={{ width: `${readPct ?? 0}%` }} />
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => setStatsRule({ id: rule.id, title: rule.title })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1a3826]/10 text-[#1a3826] text-[11px] font-bold hover:bg-[#1a3826]/20 transition"
                              >
                                <BarChart3 size={13} /> Details
                              </button>
                            </div>
                          ) : (
                            <span className="text-[12px] text-muted-foreground">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/rules/${rule.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-accent text-xs font-bold text-foreground transition"
                            >
                              <Edit2 size={13} /> Bearbeiten
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(rule.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-xs font-bold text-red-600 transition"
                            >
                              <Trash2 size={13} /> Löschen
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
        </section>
      </div>

      {/* ── STATS MODAL ── */}
      {statsRule && (
        <RuleStatsModal
          ruleId={statsRule.id}
          ruleTitle={statsRule.title}
          open={true}
          onClose={() => setStatsRule(null)}
        />
      )}

      {/* ── KATEGORIEN MODAL ── */}
      {catModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setCatModalOpen(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border overflow-hidden">
            {/* Modal header */}
            <div className="bg-[#1a3826] px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">Kategorien verwalten</h3>
                <p className="text-xs text-white/70 mt-0.5">Kategorien hinzufügen, umbenennen oder löschen.</p>
              </div>
              <button type="button" onClick={() => setCatModalOpen(false)}
                className="p-2 rounded-lg text-white/70 hover:bg-white/15 transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Add new */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCat()}
                  placeholder="Neue Kategorie eingeben…"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-[#1a3826]/30 focus:border-[#1a3826]/60 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCat}
                  disabled={catSaving || !newCatName.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#1a3826] text-white font-black hover:opacity-90 disabled:opacity-50 transition"
                >
                  <Plus size={18} />
                </button>
              </div>

              {/* List */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Noch keine Kategorien.</p>
                ) : (
                  categories.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border hover:bg-muted/40 transition group">
                      {renamingId === c.id ? (
                        <>
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameCat(c.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            autoFocus
                            className="flex-1 text-sm font-medium bg-background border border-[#1a3826]/40 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#1a3826]/30"
                          />
                          <button type="button" onClick={() => handleRenameCat(c.id)}
                            className="p-1.5 rounded-lg bg-[#1a3826] text-white hover:opacity-90 transition">
                            <Check size={14} />
                          </button>
                          <button type="button" onClick={() => setRenamingId(null)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-semibold text-foreground">{c.name}</span>
                          <button type="button" onClick={() => { setRenamingId(c.id); setRenameValue(c.name); }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-[#1a3826]/10 hover:text-[#1a3826] transition opacity-0 group-hover:opacity-100">
                            <Pencil size={14} />
                          </button>
                          <button type="button" onClick={() => handleDeleteCat(c.id)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              <button type="button" onClick={() => setCatModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition">
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
