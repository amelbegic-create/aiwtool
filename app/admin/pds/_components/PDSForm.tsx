"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPDSTemplate, updatePDSTemplate } from "@/app/actions/pdsActions";
import { toast } from "sonner";
import type { PDSGoal, PDSScaleLevel, PDSScoringRule } from "@/app/tools/PDS/types";
import { Target, BarChart4, ChevronRight, Hash, ToggleLeft, Trash2, Save } from "lucide-react";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Bitte Titel der PDS-Vorlage eingeben.");
      return;
    }
    if (!isGlobal && selectedRestaurantIds.length === 0) {
      alert("Bitte mindestens ein Restaurant auswählen oder „An alle Restaurants“ aktivieren.");
      return;
    }
    if (goals.length === 0) {
      alert("Dodajte barem jedan cilj (pitanje).");
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
        alert("Niste prijavljeni.");
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
          toast.success("PDS-Vorlage aktualisiert.");
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
          toast.success("PDS obrazac kreiran.");
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
        title: "Neues Kriterium",
        type: "NUMERIC",
        scoringRules: [],
        result: "",
        points: 0,
      },
    ]);
    setSelectedGoalIndex(goals.length);
  };

  const addRule = (goalIndex: number) => {
    const newGoals = [...goals];
    if (!newGoals[goalIndex].scoringRules) newGoals[goalIndex].scoringRules = [];
    newGoals[goalIndex].scoringRules!.push({ from: 0, to: 0, pts: 0 });
    setGoals(newGoals);
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
    setScale([...scale, { label: "Nova razina", min: 0, max: 0, colorHex: "#6b7280" }]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-black text-[#1a3826] uppercase tracking-wider">
          Grunddaten
        </h2>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Titel der PDS-Vorlage
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. PDS 2025"
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826]"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Godina
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
          <div>
            <p className="text-xs text-slate-500 mb-3">Restaurants für diese PDS-Vorlage auswählen:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {restaurants.map((r) => (
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
                    {r.name || r.code}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
        <h2 className="text-sm font-black text-[#1a3826] uppercase tracking-wider">
          Pitanja (ciljevi i skala)
        </h2>
        <div className="flex gap-2 border-b border-border pb-4">
          <button
            type="button"
            onClick={() => setActiveTab("goals")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
              activeTab === "goals" ? "bg-[#1a3826] text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            <Target size={16} /> Ciljevi
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
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500">Ciljevi za bodovanje</span>
              <button type="button" onClick={addGoal} className="text-xs font-bold text-[#1a3826] hover:underline">
                + Dodaj cilj
              </button>
            </div>
            <div className="flex gap-4">
              <div className="w-48 flex-shrink-0 space-y-2">
                {goals.map((g, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedGoalIndex(i)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold border ${
                      selectedGoalIndex === i
                        ? "border-[#1a3826] bg-[#1a3826]/10 text-[#1a3826]"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {g.title || `Kriterium ${i + 1}`}
                    {selectedGoalIndex === i && <ChevronRight size={14} className="inline ml-1" />}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-w-0 space-y-4">
                {goals[selectedGoalIndex] && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Naziv cilja</label>
                      <input
                        value={goals[selectedGoalIndex].title}
                        onChange={(e) => updateGoal(selectedGoalIndex, "title", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2">Tip</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateGoal(selectedGoalIndex, "type", "NUMERIC")}
                          className={`flex-1 py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 ${
                            goals[selectedGoalIndex].type === "NUMERIC"
                              ? "border-[#1a3826] bg-[#1a3826]/10 text-[#1a3826]"
                              : "border-border"
                          }`}
                        >
                          <Hash size={14} /> Raspon
                        </button>
                        <button
                          type="button"
                          onClick={() => updateGoal(selectedGoalIndex, "type", "BOOLEAN")}
                          className={`flex-1 py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 ${
                            goals[selectedGoalIndex].type === "BOOLEAN"
                              ? "border-[#1a3826] bg-[#1a3826]/10 text-[#1a3826]"
                              : "border-border"
                          }`}
                        >
                          <ToggleLeft size={14} /> DA/NE
                        </button>
                      </div>
                    </div>
                    {goals[selectedGoalIndex].type === "NUMERIC" && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500">Pravila (min–max → bodovi)</span>
                          <button
                            type="button"
                            onClick={() => addRule(selectedGoalIndex)}
                            className="text-xs text-[#1a3826] font-bold"
                          >
                            + Pravilo
                          </button>
                        </div>
                        {(goals[selectedGoalIndex].scoringRules || []).map((rule, ri) => (
                          <div key={ri} className="grid grid-cols-12 gap-2 items-center">
                            <input
                              type="number"
                              placeholder="Min"
                              value={rule.from}
                              onChange={(e) =>
                                updateRule(selectedGoalIndex, ri, "from", Number(e.target.value))
                              }
                              className="col-span-3 rounded border px-2 py-1.5 text-sm"
                            />
                            <input
                              type="number"
                              placeholder="Max"
                              value={rule.to}
                              onChange={(e) =>
                                updateRule(selectedGoalIndex, ri, "to", Number(e.target.value))
                              }
                              className="col-span-3 rounded border px-2 py-1.5 text-sm"
                            />
                            <input
                              type="number"
                              placeholder="Bod"
                              value={rule.pts}
                              onChange={(e) =>
                                updateRule(selectedGoalIndex, ri, "pts", Number(e.target.value))
                              }
                              className="col-span-3 rounded border px-2 py-1.5 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeRule(selectedGoalIndex, ri)}
                              className="col-span-1 text-muted-foreground hover:text-red-500"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {goals[selectedGoalIndex].type === "BOOLEAN" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Bodovi DA</label>
                          <input
                            type="number"
                            value={goals[selectedGoalIndex].yesPoints ?? 0}
                            onChange={(e) =>
                              updateGoal(selectedGoalIndex, "yesPoints", Number(e.target.value))
                            }
                            className="w-full rounded border px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Bodovi NE</label>
                          <input
                            type="number"
                            value={goals[selectedGoalIndex].noPoints ?? 0}
                            onChange={(e) =>
                              updateGoal(selectedGoalIndex, "noPoints", Number(e.target.value))
                            }
                            className="w-full rounded border px-3 py-2"
                          />
                        </div>
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
                className="flex items-center gap-4 p-3 rounded-xl border border-border bg-muted/50"
              >
                <input
                  value={s.label}
                  onChange={(e) => {
                    const n = [...scale];
                    n[i] = { ...n[i], label: e.target.value };
                    setScale(n);
                  }}
                  className="flex-1 min-w-0 px-3 py-2 rounded border border-border text-sm font-medium"
                  placeholder="Naziv"
                />
                <input
                  type="number"
                  value={s.min}
                  onChange={(e) => {
                    const n = [...scale];
                    n[i] = { ...n[i], min: Number(e.target.value) };
                    setScale(n);
                  }}
                  className="w-20 px-2 py-2 rounded border border-border text-sm text-center"
                />
                <input
                  type="number"
                  value={s.max}
                  onChange={(e) => {
                    const n = [...scale];
                    n[i] = { ...n[i], max: Number(e.target.value) };
                    setScale(n);
                  }}
                  className="w-20 px-2 py-2 rounded border border-border text-sm text-center"
                />
                <input
                  type="color"
                  value={s.colorHex}
                  onChange={(e) => {
                    const n = [...scale];
                    n[i] = { ...n[i], colorHex: e.target.value };
                    setScale(n);
                  }}
                  className="h-9 w-9 rounded border border-border cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = scale.filter((_, idx) => idx !== i);
                    setScale(n);
                  }}
                  className="text-muted-foreground hover:text-red-500 p-1"
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
              + Dodaj rang
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Link
          href="/admin/pds"
          className="px-6 py-3 rounded-xl font-bold text-muted-foreground hover:bg-accent transition-colors"
        >
          Odustani
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
