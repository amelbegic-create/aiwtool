"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPDSTemplate, updatePDSTemplate } from "@/app/actions/pdsActions";
import { toast } from "sonner";
import type { PDSGoal, PDSScaleLevel, PDSScoringRule } from "@/app/tools/PDS/types";
import { Target, BarChart4, ChevronRight, Hash, ToggleLeft, Trash2, Save, Plus } from "lucide-react";

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

type RestaurantOption = { id: string; name: string | null; code: string };

type InitialData = {
  id: string;
  title: string;
  year: number;
  isGlobal: boolean;
  goals: PDSGoal[];
  scale: PDSScaleLevel[];
  restaurantIds: string[];
};

type Props = {
  restaurants: RestaurantOption[];
  initialData: InitialData | null;
  defaultGoals: PDSGoal[];
  defaultScale: PDSScaleLevel[];
};

export default function PDSForm({
  restaurants,
  initialData,
  defaultGoals,
  defaultScale,
}: Props) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [year, setYear] = useState(initialData?.year ?? new Date().getFullYear());
  const [isGlobal, setIsGlobal] = useState(initialData?.isGlobal ?? false);
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>(
    initialData?.restaurantIds ?? []
  );
  const [goals, setGoals] = useState<PDSGoal[]>(initialData?.goals ?? defaultGoals);
  const [scale, setScale] = useState<PDSScaleLevel[]>(initialData?.scale ?? defaultScale);
  const [activeTab, setActiveTab] = useState<"restaurants" | "goals" | "scale">("restaurants");
  const [selectedGoalIndex, setSelectedGoalIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editingNumeric, setEditingNumeric] = useState<Record<string, string>>({});

  useEffect(() => {
    setEditingNumeric((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.startsWith("goal-") || k.startsWith("rule-") || k.startsWith("scale-")) delete next[k];
      });
      return next;
    });
  }, [selectedGoalIndex, activeTab]);

  const sortedRestaurants = useMemo(
    () => [...restaurants].sort((a, b) => (Number(a.code) || 0) - (Number(b.code) || 0)),
    [restaurants]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Bitte Bezeichnung der PDS-Vorlage eingeben.");
      return;
    }
    if (!isGlobal && selectedRestaurantIds.length === 0) {
      alert("Bitte mindestens ein Restaurant auswählen oder „An alle Restaurants senden“ aktivieren.");
      return;
    }
    if (goals.length === 0) {
      alert("Bitte mindestens ein Ziel (Frage) hinzufügen.");
      return;
    }
    if (scale.length === 0) {
      alert("Bitte mindestens eine Skalenstufe hinzufügen.");
      return;
    }

    setSaving(true);
    try {
      const session = await fetch("/api/auth/session").then((r) => r.json());
      const managerId = (session?.user as { id?: string })?.id;
      if (!managerId) {
        alert("Sie sind nicht angemeldet.");
        setSaving(false);
        return;
      }

      if (isEdit && initialData) {
        const res = await updatePDSTemplate(initialData.id, {
          title: title.trim(),
          year,
          isGlobal,
          restaurantIds: isGlobal ? [] : selectedRestaurantIds,
          goals,
          scale,
        });
        if (res.success) {
          toast.success("Gespeichert.");
          router.push("/admin/pds");
          router.refresh();
        } else {
          alert(res.error);
        }
      } else {
        const res = await createPDSTemplate({
          title: title.trim(),
          year,
          isGlobal,
          restaurantIds: isGlobal ? [] : selectedRestaurantIds,
          goals,
          scale,
          managerId,
        });
        if (res.success) {
          toast.success("Gespeichert.");
          router.push("/admin/pds");
          router.refresh();
        } else {
          alert(res.error);
        }
      }
    } catch {
      alert("Serverfehler.");
    }
    setSaving(false);
  };

  const updateGoal = (index: number, field: keyof PDSGoal, value: any) => {
    const newGoals = [...goals];
    (newGoals[index] as any)[field] = value;
    if (field === "type") {
      if (value === "BOOLEAN") newGoals[index].scoringRules = [];
      if (value === "NUMERIC") {
        newGoals[index].yesPoints = 0;
        newGoals[index].noPoints = 0;
      }
    }
    setGoals(newGoals);
  };

  const addGoal = () => {
    setGoals([
      ...goals,
      {
        title: "Novi cilj",
        type: "NUMERIC",
        scoringRules: [],
        result: "",
        points: 0,
      },
    ]);
    setSelectedGoalIndex(goals.length);
  };

  const removeGoal = (index: number) => {
    if (goals.length <= 1) return;
    const newGoals = goals.filter((_, i) => i !== index);
    setGoals(newGoals);
    const newSelected =
      index < selectedGoalIndex
        ? selectedGoalIndex - 1
        : index === selectedGoalIndex
          ? Math.min(selectedGoalIndex, newGoals.length - 1)
          : selectedGoalIndex;
    setSelectedGoalIndex(Math.max(0, newSelected));
  };

  const addRule = (goalIndex: number) => {
    const newGoals = [...goals];
    if (!newGoals[goalIndex].scoringRules) newGoals[goalIndex].scoringRules = [];
    newGoals[goalIndex].scoringRules!.push({ from: 0, to: 0, pts: 0 });
    setGoals(newGoals);
  };

  const numInputValue = (n: number) => (n === 0 ? "" : String(n));
  const parseNumInput = (s: string) => {
    if (s === "") return 0;
    const n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
  };
  const allowOnlyDigits = (v: string) => v.replace(/[^\d]/g, "");
  const getNumDisplay = (key: string, numVal: number) =>
    editingNumeric[key] !== undefined ? editingNumeric[key] : numInputValue(numVal);
  const setNumEdit = (key: string, raw: string, commit: (n: number) => void) => {
    const filtered = allowOnlyDigits(raw);
    setEditingNumeric((p) => ({ ...p, [key]: filtered }));
    commit(parseNumInput(filtered));
  };
  const blurNumEdit = (key: string, currentNum: number, commit: (n: number) => void) => {
    const s = editingNumeric[key];
    const n = s !== undefined ? parseNumInput(s) : currentNum;
    commit(n);
    setEditingNumeric((p) => {
      const next = { ...p };
      delete next[key];
      return next;
    });
  };

  const updateRule = (
    goalIndex: number,
    ruleIndex: number,
    field: keyof PDSScoringRule,
    value: number
  ) => {
    const newGoals = [...goals];
    const rules = newGoals[goalIndex].scoringRules || [];
    rules[ruleIndex] = { ...rules[ruleIndex], [field]: value };
    newGoals[goalIndex].scoringRules = rules;
    setGoals(newGoals);
  };

  const removeRule = (goalIndex: number, ruleIndex: number) => {
    const newGoals = [...goals];
    newGoals[goalIndex].scoringRules = (newGoals[goalIndex].scoringRules || []).filter(
      (_, i) => i !== ruleIndex
    );
    setGoals(newGoals);
  };

  const addScaleLevel = () => {
    setScale([...scale, { label: "Neue Stufe", min: 0, max: 0, colorHex: "#6b7280" }]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-black text-[#1a3826] uppercase tracking-wider">
          Osnovni podaci
        </h2>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Naziv PDS predloška
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="npr. PDS 2025"
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Jahr
          </label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-black text-[#1a3826] uppercase tracking-wider">
          Ziel-Restaurants
        </h2>
        <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-[#1a3826]/30 cursor-pointer transition-colors">
          <input
            type="checkbox"
            checked={isGlobal}
            onChange={(e) => {
              setIsGlobal(e.target.checked);
              if (e.target.checked) setSelectedRestaurantIds([]);
            }}
            className="rounded border-slate-300 text-[#1a3826] focus:ring-[#1a3826] h-4 w-4"
          />
          <span className="font-bold text-slate-800">An alle Restaurants senden</span>
        </label>
        {!isGlobal && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Restaurants für diese PDS-Vorlage auswählen:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {sortedRestaurants.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-accent cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedRestaurantIds.includes(r.id)}
                    onChange={(e) => {
                      if (e.target.checked)
                        setSelectedRestaurantIds((prev) => [...prev, r.id]);
                      else
                        setSelectedRestaurantIds((prev) => prev.filter((id) => id !== r.id));
                    }}
                    className="rounded border-slate-300 text-[#1a3826] focus:ring-[#1a3826] h-4 w-4"
                  />
                  <span className="text-sm font-medium text-foreground truncate">
                    {r.name && String(r.name).trim() !== r.code ? `${r.code} – ${r.name}` : r.code}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-black text-[#1a3826] uppercase tracking-wider">
          Fragen (Ziele und Skala)
        </h2>
        <div className="flex gap-2 border-b border-border pb-4 mb-2">
          <button
            type="button"
            onClick={() => setActiveTab("goals")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
              activeTab === "goals" ? "bg-[#1a3826] text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            <Target size={16} /> Ziele
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scale")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
              activeTab === "scale" ? "bg-[#1a3826] text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            <BarChart4 size={16} /> Skala
          </button>
        </div>

        {activeTab === "goals" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ziele für die Bewertung</span>
              <button type="button" onClick={addGoal} className="text-xs font-bold text-[#1a3826] hover:underline flex items-center gap-1">
                <Plus size={12} /> Ziel hinzufügen
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="sm:w-52 flex-shrink-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Zieleliste</p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {goals.map((g, i) => (
                    <div key={i} className="flex items-center gap-1 group">
                      <button
                        type="button"
                        onClick={() => setSelectedGoalIndex(i)}
                        className={`flex-1 min-w-0 text-left px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                          selectedGoalIndex === i
                            ? "border-[#1a3826] bg-[#1a3826]/10 text-[#1a3826]"
                            : "border-border text-muted-foreground hover:border-slate-300"
                        }`}
                      >
                        {g.title || `Ziel ${i + 1}`}
                        {selectedGoalIndex === i && <ChevronRight size={14} className="inline ml-1" />}
                      </button>
                      {goals.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeGoal(i); }}
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 shrink-0"
                          title="Ziel löschen"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-0 border-l-0 sm:border-l sm:border-border sm:pl-6 space-y-5">
                {goals[selectedGoalIndex] && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bezeichnung des Ziels</label>
                      <input
                        value={goals[selectedGoalIndex].title}
                        onChange={(e) => updateGoal(selectedGoalIndex, "title", e.target.value)}
                        placeholder="Neues Ziel"
                        className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Typ</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateGoal(selectedGoalIndex, "type", "NUMERIC")}
                          className={`flex-1 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                            goals[selectedGoalIndex].type === "NUMERIC"
                              ? "border-[#1a3826] bg-[#1a3826]/10 text-[#1a3826]"
                              : "border-border bg-muted/30"
                          }`}
                        >
                          <Hash size={14} /> Bereich
                        </button>
                        <button
                          type="button"
                          onClick={() => updateGoal(selectedGoalIndex, "type", "BOOLEAN")}
                          className={`flex-1 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                            goals[selectedGoalIndex].type === "BOOLEAN"
                              ? "border-[#1a3826] bg-[#1a3826]/10 text-[#1a3826]"
                              : "border-border bg-muted/30"
                          }`}
                        >
                          <ToggleLeft size={14} /> Ja/Nein
                        </button>
                      </div>
                    </div>
                    {goals[selectedGoalIndex].type === "NUMERIC" && (
                      <div className="rounded-xl border border-border bg-slate-50/50 p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Regeln (Min – Max → Punkte)</span>
                          <button
                            type="button"
                            onClick={() => addRule(selectedGoalIndex)}
                            className="text-xs text-[#1a3826] font-bold hover:underline"
                          >
                            + Regeln
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(goals[selectedGoalIndex].scoringRules || []).map((rule, ri) => (
                            <div key={ri} className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Min"
                                value={getNumDisplay(`rule-${selectedGoalIndex}-${ri}-from`, rule.from)}
                                onChange={(e) =>
                                  setNumEdit(`rule-${selectedGoalIndex}-${ri}-from`, e.target.value, (n) =>
                                    updateRule(selectedGoalIndex, ri, "from", n)
                                  )
                                }
                                onBlur={() =>
                                  blurNumEdit(`rule-${selectedGoalIndex}-${ri}-from`, rule.from, (n) =>
                                    updateRule(selectedGoalIndex, ri, "from", n)
                                  )
                                }
                                className="w-20 rounded-lg border border-border px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                              />
                              <span className="text-slate-400 text-sm">–</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Max"
                                value={getNumDisplay(`rule-${selectedGoalIndex}-${ri}-to`, rule.to)}
                                onChange={(e) =>
                                  setNumEdit(`rule-${selectedGoalIndex}-${ri}-to`, e.target.value, (n) =>
                                    updateRule(selectedGoalIndex, ri, "to", n)
                                  )
                                }
                                onBlur={() =>
                                  blurNumEdit(`rule-${selectedGoalIndex}-${ri}-to`, rule.to, (n) =>
                                    updateRule(selectedGoalIndex, ri, "to", n)
                                  )
                                }
                                className="w-20 rounded-lg border border-border px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                              />
                              <span className="text-slate-400 text-sm">→</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Pkt"
                                value={getNumDisplay(`rule-${selectedGoalIndex}-${ri}-pts`, rule.pts)}
                                onChange={(e) =>
                                  setNumEdit(`rule-${selectedGoalIndex}-${ri}-pts`, e.target.value, (n) =>
                                    updateRule(selectedGoalIndex, ri, "pts", n)
                                  )
                                }
                                onBlur={() =>
                                  blurNumEdit(`rule-${selectedGoalIndex}-${ri}-pts`, rule.pts, (n) =>
                                    updateRule(selectedGoalIndex, ri, "pts", n)
                                  )
                                }
                                className="w-16 rounded-lg border border-border px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                              />
                              <button
                                type="button"
                                onClick={() => removeRule(selectedGoalIndex, ri)}
                                className="p-2 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-50"
                                title="Regel entfernen"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {goals[selectedGoalIndex].type === "BOOLEAN" && (
                      <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-slate-50/50 p-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Punkte Ja (auch negativ)</label>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex rounded-lg border border-border overflow-hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  const v = goals[selectedGoalIndex].yesPoints ?? 0;
                                  updateGoal(selectedGoalIndex, "yesPoints", Math.abs(v));
                                }}
                                className={`px-3 py-2 text-sm font-medium ${(goals[selectedGoalIndex].yesPoints ?? 0) >= 0 ? "bg-[#1a3826] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                              >
                                Positiv
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const v = goals[selectedGoalIndex].yesPoints ?? 0;
                                  updateGoal(selectedGoalIndex, "yesPoints", -Math.abs(v));
                                }}
                                className={`px-3 py-2 text-sm font-medium ${(goals[selectedGoalIndex].yesPoints ?? 0) < 0 ? "bg-[#1a3826] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                              >
                                Negativ
                              </button>
                            </div>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={getNumDisplay(`goal-yes-${selectedGoalIndex}`, Math.abs(goals[selectedGoalIndex].yesPoints ?? 0))}
                              onChange={(e) => {
                                const sign = (goals[selectedGoalIndex].yesPoints ?? 0) < 0 ? -1 : 1;
                                setNumEdit(`goal-yes-${selectedGoalIndex}`, e.target.value, (n) =>
                                  updateGoal(selectedGoalIndex, "yesPoints", n * sign)
                                );
                              }}
                              onBlur={() =>
                                blurNumEdit(
                                  `goal-yes-${selectedGoalIndex}`,
                                  Math.abs(goals[selectedGoalIndex].yesPoints ?? 0),
                                  (n) => {
                                    const sign = (goals[selectedGoalIndex].yesPoints ?? 0) < 0 ? -1 : 1;
                                    updateGoal(selectedGoalIndex, "yesPoints", n * sign);
                                  }
                                )
                              }
                              className="w-20 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Punkte Nein (auch negativ)</label>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex rounded-lg border border-border overflow-hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  const v = goals[selectedGoalIndex].noPoints ?? 0;
                                  updateGoal(selectedGoalIndex, "noPoints", Math.abs(v));
                                }}
                                className={`px-3 py-2 text-sm font-medium ${(goals[selectedGoalIndex].noPoints ?? 0) >= 0 ? "bg-[#1a3826] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                              >
                                Positiv
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const v = goals[selectedGoalIndex].noPoints ?? 0;
                                  updateGoal(selectedGoalIndex, "noPoints", -Math.abs(v));
                                }}
                                className={`px-3 py-2 text-sm font-medium ${(goals[selectedGoalIndex].noPoints ?? 0) < 0 ? "bg-[#1a3826] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                              >
                                Negativ
                              </button>
                            </div>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={getNumDisplay(`goal-no-${selectedGoalIndex}`, Math.abs(goals[selectedGoalIndex].noPoints ?? 0))}
                              onChange={(e) => {
                                const sign = (goals[selectedGoalIndex].noPoints ?? 0) < 0 ? -1 : 1;
                                setNumEdit(`goal-no-${selectedGoalIndex}`, e.target.value, (n) =>
                                  updateGoal(selectedGoalIndex, "noPoints", n * sign)
                                );
                              }}
                              onBlur={() =>
                                blurNumEdit(
                                  `goal-no-${selectedGoalIndex}`,
                                  Math.abs(goals[selectedGoalIndex].noPoints ?? 0),
                                  (n) => {
                                    const sign = (goals[selectedGoalIndex].noPoints ?? 0) < 0 ? -1 : 1;
                                    updateGoal(selectedGoalIndex, "noPoints", n * sign);
                                  }
                                )
                              }
                              className="w-20 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {goals.length > 1 && (
                      <div className="pt-4 border-t border-border">
                        <button
                          type="button"
                          onClick={() => removeGoal(selectedGoalIndex)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200"
                        >
                          <Trash2 size={14} /> Ziel löschen
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "scale" && (
          <div className="space-y-3">
            {scale.map((s, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_72px_72px_48px_40px] items-center gap-3 p-3 rounded-xl border border-border bg-muted/50"
              >
                <input
                  value={s.label}
                  onChange={(e) => {
                    const n = [...scale];
                    n[i] = { ...n[i], label: e.target.value };
                    setScale(n);
                  }}
                  className="min-w-0 px-3 py-2 rounded-lg border border-border text-sm font-medium text-center focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                  placeholder="Bezeichnung"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={getNumDisplay(`scale-${i}-min`, s.min)}
                  onChange={(e) =>
                    setNumEdit(`scale-${i}-min`, e.target.value, (num) => {
                      const n = [...scale];
                      n[i] = { ...n[i], min: num };
                      setScale(n);
                    })
                  }
                  onBlur={() =>
                    blurNumEdit(`scale-${i}-min`, s.min, (num) => {
                      const n = [...scale];
                      n[i] = { ...n[i], min: num };
                      setScale(n);
                    })
                  }
                  className="w-full px-2 py-2 rounded-lg border border-border text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                  placeholder="Min"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={getNumDisplay(`scale-${i}-max`, s.max)}
                  onChange={(e) =>
                    setNumEdit(`scale-${i}-max`, e.target.value, (num) => {
                      const n = [...scale];
                      n[i] = { ...n[i], max: num };
                      setScale(n);
                    })
                  }
                  onBlur={() =>
                    blurNumEdit(`scale-${i}-max`, s.max, (num) => {
                      const n = [...scale];
                      n[i] = { ...n[i], max: num };
                      setScale(n);
                    })
                  }
                  className="w-full px-2 py-2 rounded-lg border border-border text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                  placeholder="Max"
                />
                <input
                  type="color"
                  value={s.colorHex}
                  onChange={(e) => {
                    const n = [...scale];
                    n[i] = { ...n[i], colorHex: e.target.value };
                    setScale(n);
                  }}
                  className="h-9 w-9 rounded border border-border cursor-pointer justify-self-center"
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = scale.filter((_, idx) => idx !== i);
                    setScale(n);
                  }}
                  className="text-muted-foreground hover:text-red-500 p-1 justify-self-center"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addScaleLevel}
              className="w-full py-3 border border-dashed border-slate-300 rounded-xl text-sm font-bold text-slate-500 hover:bg-accent"
            >
              + Stufe hinzufügen
            </button>
          </div>
        )}

      </div>

      <div className="flex gap-3">
        <Link
          href="/admin/pds"
          className="px-6 py-3 rounded-xl font-bold text-muted-foreground hover:bg-accent transition-colors"
        >
          Abbrechen
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1a3826] text-white font-bold hover:bg-[#142d1f] disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? "Speichern…" : isEdit ? "Änderungen speichern" : "PDS anlegen"}
        </button>
      </div>
    </form>
  );
}
