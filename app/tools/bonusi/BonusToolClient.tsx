"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import type { BonusState, BonusEmployee } from "@/lib/bonusLogic";
import {
  sanitize,
  payout as calcPayout,
  totalScore as calcTotalScore,
  displayName,
  effectiveWeightsForPillars,
  weightSum,
  getPillarsForEmp,
  hasEmpOverride,
  clearEmpOverride,
  setEmpOverride,
  deepClone,
  deptKey,
  BONUS_YEARS,
} from "@/lib/bonusLogic";
import { saveBonusSheet, syncEmployeesWithUsers } from "@/app/actions/bonusActions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Props = {
  initialState: BonusState;
};

export default function BonusToolClient({ initialState }: Props) {
  const [state, setState] = useState<BonusState>(() => sanitize(initialState));
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const selectedEmp: BonusEmployee | undefined =
    state.employees.find((e) => e.id === state.ui.selectedEmpId) || state.employees[0];

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveBonusSheet(state);
      toast.success("Gespeichert.");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncEmployees = async () => {
    setSyncing(true);
    try {
      const next = await syncEmployeesWithUsers(state);
      setState(next);
    } finally {
      setSyncing(false);
    }
  };

  const tabs: Array<{ id: BonusState["ui"]["tab"]; label: string }> = [
    { id: "employee", label: "Zaposlenici" },
    { id: "goals", label: "Ciljevi" },
    { id: "overview", label: "Pregled zaposlenika" },
    { id: "results", label: "Rezultati & export" },
  ];

  return (
    <div className="space-y-8">
      <section className="bg-[#1a3826] text-white rounded-3xl px-5 py-4 md:px-7 md:py-5 shadow-sm border border-black/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
              BONUS ALAT{" "}
              <span className="text-[#FFC72C]">
                – {state.settings.baseMonths} mjeseca · plafon {state.settings.capPct}%
              </span>
            </h2>
            <p className="text-xs md:text-sm font-semibold text-white/80 mt-1">
              Alat za obračun godišnjih bonusa po zaposleniku.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSyncEmployees}
              disabled={syncing}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide border border-white/20 bg-card/5 hover:bg-card/10 transition-colors",
                syncing && "opacity-60 cursor-wait",
              )}
            >
              {syncing ? "Sinhronizacija..." : "Sync zaposlenika"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wide bg-[#FFBC0D] text-black hover:bg-[#e6b225] shadow-sm transition-colors",
                saving && "opacity-60 cursor-wait",
              )}
            >
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setState((s) => ({ ...s, ui: { ...s.ui, tab: t.id } }))}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-black tracking-wide border border-white/30",
                state.ui.tab === t.id ? "bg-[#FFC72C] text-[#1a3826] border-[#FFC72C]" : "bg-card/5 text-white/85",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {state.ui.tab === "employee" && selectedEmp && (
        <EmployeeView state={state} setState={setState} emp={selectedEmp} />
      )}

      {state.ui.tab === "goals" && (
        <GoalsView state={state} setState={setState} />
      )}

      {state.ui.tab === "overview" && (
        <OverviewView state={state} setState={setState} />
      )}

      {state.ui.tab === "results" && (
        <ResultsView state={state} />
      )}
    </div>
  );
}

function EmployeeView({
  state,
  setState,
  emp,
}: {
  state: BonusState;
  setState: (fn: (s: BonusState) => BonusState) => void;
  emp: BonusEmployee;
}) {
  const p = calcPayout(emp, state);
  const t = calcTotalScore(emp, state);

  const updateEmp = (patch: Partial<BonusEmployee>) => {
    setState((s) => ({
      ...s,
      employees: s.employees.map((e) => (e.id === emp.id ? { ...e, ...patch } : e)),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="min-w-[260px] rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card"
            value={emp.id}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                ui: { ...s.ui, selectedEmpId: e.target.value },
              }))
            }
          >
            {state.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {displayName(e)} ({e.dept})
              </option>
            ))}
          </select>

          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-slate-200 text-[11px] font-black uppercase tracking-wide text-slate-500">
            Basis: {p.base.toLocaleString("de-AT", { style: "currency", currency: "EUR" })}
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-slate-200 text-[11px] font-black uppercase tracking-wide text-slate-500">
            Gesamt: {Math.round(p.total * 100)}%
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-slate-200 text-[11px] font-black uppercase tracking-wide text-slate-500">
            Deckel: {p.cap.toLocaleString("de-AT", { style: "currency", currency: "EUR" })}
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFF7CC] border border-[#F2C94C] text-[11px] font-black uppercase tracking-wide text-[#1a3826]">
            Auszahlung: {p.payout.toLocaleString("de-AT", { style: "currency", currency: "EUR" })}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Finanz" weightPct={Math.round(t.eff.fin * 100)} valuePct={t.fin * 100} />
        <KpiCard label="Operation" weightPct={Math.round(t.eff.ops * 100)} valuePct={t.ops * 100} />
        <KpiCard label="Individuell" weightPct={Math.round(t.eff.ind * 100)} valuePct={t.ind * 100} />
        <KpiCard label="Gesamt" weightPct={100} valuePct={t.total * 100} highlight />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-black text-[#1a3826] tracking-tight uppercase">Stammdaten</h2>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">Name</label>
              <input
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card"
                value={emp.name}
                onChange={(e) => updateEmp({ name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">Abteilung</label>
              <select
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card"
                value={emp.dept}
                onChange={(e) => updateEmp({ dept: e.target.value })}
              >
                <option value="RL">RL</option>
                <option value="Office">Office</option>
                <option value="Finanz/Lohnbuchhaltung">Finanz/Lohnbuchhaltung</option>
                <option value="AL">AL</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-black text-[#1a3826] tracking-tight uppercase">Einstellungen</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">Monatsgehalt (€)</label>
              <input
                type="number"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card"
                value={emp.salary}
                onChange={(e) => updateEmp({ salary: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">Bonusbasis (Monate)</label>
              <input
                type="number"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card"
                value={emp.baseMonths ?? state.settings.baseMonths}
                onChange={(e) =>
                  updateEmp({
                    baseMonths: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">Faktor Zugehörigkeit (RL/AL)</label>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card"
                value={emp.factors.tenure}
                onChange={(e) =>
                  updateEmp({
                    factors: { ...emp.factors, tenure: Number(e.target.value) || 1 },
                  })
                }
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">Faktor Restaurantgröße (RL/AL)</label>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card"
                value={emp.factors.size}
                onChange={(e) =>
                  updateEmp({
                    factors: { ...emp.factors, size: Number(e.target.value) || 1 },
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------ GOALS VIEW ------------------

function GoalsView({ state, setState }: { state: BonusState; setState: (fn: (s: BonusState) => BonusState) => void }) {
  const mode = state.ui.goalsMode || "dept"; // "dept" ili "emp"
  const dept = state.ui.goalsDept || "RL";
  const currentEmp = state.employees.find((e) => e.id === state.ui.goalsEmpId) || state.employees[0] || null;

  const scopeLabel = mode === "emp" && currentEmp ? `${displayName(currentEmp)} (${currentEmp.dept})` : dept;

  const scopeKey = mode === "emp" && currentEmp ? `emp:${currentEmp.id}` : `dept:${dept}`;

  const pillars = useMemo(() => {
    if (mode === "emp" && currentEmp) {
      return getPillarsForEmp(currentEmp, state);
    }
    const d = deptKey(dept);
    return state.pillarsByDept[d];
  }, [mode, currentEmp, state, dept]);

  const effWeights = effectiveWeightsForPillars(pillars);
  const hasIndividual = mode === "emp" && currentEmp ? hasEmpOverride(currentEmp.id, state) : false;

  const updatePillars = (updater: (pb: any) => void) => {
    setState((s) => {
      const next = { ...s };
      if (mode === "emp" && currentEmp) {
        // osiguraj override za zaposlenika
        if (!hasEmpOverride(currentEmp.id, next)) {
          const base = next.pillarsByDept[deptKey(currentEmp.dept)];
          setEmpOverride(currentEmp.id, deepClone(base), next);
        }
        const ov = next.empGoalOverrides[currentEmp.id];
        updater(ov);
      } else {
        const d = deptKey(dept);
        const pb = next.pillarsByDept[d];
        updater(pb);
      }
      return sanitize(next);
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase">Način uređivanja</label>
            <select
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card"
              value={mode}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  ui: { ...s.ui, goalsMode: e.target.value === "emp" ? "emp" : "dept" },
                }))
              }
            >
              <option value="dept">Po odjelu (vrijedi za sve)</option>
              <option value="emp">Pojedinačno po zaposleniku</option>
            </select>
          </div>

          {mode === "dept" && (
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">Odjel</label>
              <select
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card"
                value={dept}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    ui: { ...s.ui, goalsDept: e.target.value },
                  }))
                }
              >
                <option value="RL">RL</option>
                <option value="Office">Office</option>
                <option value="Finanz/Lohnbuchhaltung">Finanz/Lohnbuchhaltung</option>
                <option value="AL">AL</option>
              </select>
            </div>
          )}

          {mode === "emp" && (
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">Zaposlenik</label>
              <select
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card"
                value={currentEmp?.id || ""}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    ui: { ...s.ui, goalsEmpId: e.target.value },
                  }))
                }
              >
                {state.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {displayName(e)} ({e.dept})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Scope</label>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-muted border border-slate-200 text-xs font-semibold text-muted-foreground">
              Uređuješ ciljeve za: <span className="font-black text-[#1a3826]">{scopeLabel}</span>
            </div>
            {mode === "emp" && currentEmp && (
              <div className="flex gap-2">
                <button
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[11px] font-black uppercase border",
                    hasIndividual
                      ? "bg-[#1a3826] text-white border-[#1a3826]"
                      : "bg-card text-muted-foreground border-slate-200",
                  )}
                  onClick={() =>
                    setState((s) => {
                      const next = { ...s };
                      if (hasEmpOverride(currentEmp.id, next)) {
                        clearEmpOverride(currentEmp.id, next);
                      } else {
                        const base = next.pillarsByDept[deptKey(currentEmp.dept)];
                        setEmpOverride(currentEmp.id, deepClone(base), next);
                      }
                      return sanitize(next);
                    })
                  }
                >
                  {hasIndividual ? "Individ. uključeno" : "Koristi ciljeve odjela"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <GoalsPillarEditor
        scope={scopeKey}
        keyName="fin"
        label="Finansije"
        pillar={pillars.fin}
        effWeight={effWeights.fin}
        updatePillars={updatePillars}
      />
      <GoalsPillarEditor
        scope={scopeKey}
        keyName="ops"
        label="Operacije"
        pillar={pillars.ops}
        effWeight={effWeights.ops}
        updatePillars={updatePillars}
      />
      <GoalsPillarEditor
        scope={scopeKey}
        keyName="ind"
        label="Individualno"
        pillar={pillars.ind}
        effWeight={effWeights.ind}
        updatePillars={updatePillars}
      />
    </div>
  );
}

type GoalsPillarProps = {
  scope: string;
  keyName: "fin" | "ops" | "ind";
  label: string;
  pillar: any;
  effWeight: number;
  updatePillars: (fn: (pb: any) => void) => void;
};

function GoalsPillarEditor({ pillar, keyName, label, effWeight, updatePillars }: GoalsPillarProps) {
  const sumW = weightSum(pillar);
  const basePct = Math.round((pillar.weight || 0) * 100 * 10) / 10;
  const effPct = Math.round((effWeight || 0) * 100 * 10) / 10;
  const enabled = pillar.enabled !== false;

  return (
    <div className="bg-card rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-black text-[#1a3826] tracking-tight uppercase">{label}</h2>
            <span className="px-2 py-0.5 rounded-full bg-muted border border-slate-200 text-[10px] font-black text-slate-500">
              Osnovna težina: {basePct}% · Efektivna: {enabled ? effPct : 0}%
            </span>
            <span className="px-2 py-0.5 rounded-full bg-muted border border-slate-200 text-[10px] font-black text-slate-500">
              Zbir ciljeva: {Math.round(sumW * 100) / 100}%
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) =>
                updatePillars((pb) => {
                  pb[keyName].enabled = e.target.checked;
                })
              }
            />
            Aktivno
          </label>
          <button
            className="px-3 py-1.5 rounded-xl text-[11px] font-black uppercase border border-slate-200 bg-card hover:bg-muted"
            onClick={() =>
              updatePillars((pb) => {
                pb[keyName].goals.push({ name: "Novi cilj", w: 0 });
              })
            }
          >
            + Dodaj cilj
          </button>
        </div>
      </div>

      {enabled ? (
        <div className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">Naziv stuba</label>
              <input
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card"
                value={pillar.name}
                onChange={(e) =>
                  updatePillars((pb) => {
                    pb[keyName].name = e.target.value;
                  })
                }
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase">Težina stuba (%)</label>
              <input
                type="number"
                step="0.1"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card"
                value={basePct}
                onChange={(e) => {
                  const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                  updatePillars((pb) => {
                    pb[keyName].weight = pct / 100;
                  });
                }}
              />
            </div>
          </div>

          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-[11px] font-black uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Cilj</th>
                  <th className="px-4 py-2 text-right">Težina %</th>
                  <th className="px-4 py-2 text-right w-16"></th>
                </tr>
              </thead>
              <tbody>
                {pillar.goals.map((g: any, i: number) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2">
                      <input
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card"
                        value={g.name}
                        onChange={(e) =>
                          updatePillars((pb) => {
                            pb[keyName].goals[i].name = e.target.value;
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        step="0.1"
                        className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card text-right"
                        value={g.w}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          updatePillars((pb) => {
                            pb[keyName].goals[i].w = v;
                          });
                        }}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                        onClick={() =>
                          updatePillars((pb) => {
                            pb[keyName].goals.splice(i, 1);
                          })
                        }
                      >
                        Ukloni
                      </button>
                    </td>
                  </tr>
                ))}
                {pillar.goals.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-xs text-muted-foreground">
                      Nema definisanih ciljeva za ovaj stub.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Ovaj stub je deaktiviran i ne ulazi u obračun bonusa.
        </p>
      )}
    </div>
  );
}

// ------------------ OVERVIEW VIEW ------------------

function OverviewView({
  state,
  setState,
}: {
  state: BonusState;
  setState: (fn: (s: BonusState) => BonusState) => void;
}) {
  const query = (state.ui.ovQuery || "").trim().toLowerCase();

  const filtered = state.employees.filter((e) => {
    if (!query) return true;
    const t = (e.name + " " + e.dept).toLowerCase();
    return t.includes(query);
  });

  const updateFromInput = (id: string, field: string, value: string) => {
    setState((s) => {
      const next = { ...s, employees: s.employees.map((e) => ({ ...e })) };
      const emp = next.employees.find((e) => e.id === id);
      if (!emp) return s;
      if (field === "name") emp.name = value;
      else if (field === "dept") emp.dept = value;
      else if (field === "salary") emp.salary = Math.max(0, Number(value) || 0);
      else if (field === "baseMonths") emp.baseMonths = Math.max(0, Number(value) || 0);
      else if (field === "tenure") emp.factors.tenure = Number(value) || 1;
      else if (field === "size") emp.factors.size = Number(value) || 1;
      else if (field === "office") emp.factors.office = Number(value) || 1;
      return sanitize(next);
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-black text-[#1a3826] tracking-tight uppercase">Pregled zaposlenika</h2>
            <p className="text-xs text-slate-500 mt-1">
              Brza izmjena osnovnih parametara (plata, baza, faktori) za sve korisnike.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold bg-card min-w-[220px]"
              placeholder="Pretraga po imenu ili odjelu..."
              value={state.ui.ovQuery || ""}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  ui: { ...s.ui, ovQuery: e.target.value },
                }))
              }
            />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-3xl border border-slate-200 p-0 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-[11px] font-black uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Ime i prezime</th>
              <th className="px-4 py-2 text-left">Odjel</th>
              <th className="px-4 py-2 text-right">Plata</th>
              <th className="px-4 py-2 text-right">Baza (mjeseci)</th>
              <th className="px-4 py-2 text-right">F. staž</th>
              <th className="px-4 py-2 text-right">F. veličina</th>
              <th className="px-4 py-2 text-right">F. office</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-4 py-2">
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold bg-card"
                    value={e.name}
                    onChange={(ev) => updateFromInput(e.id, "name", ev.target.value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold bg-card"
                    value={e.dept}
                    onChange={(ev) => updateFromInput(e.id, "dept", ev.target.value)}
                  >
                    <option value="RL">RL</option>
                    <option value="Office">Office</option>
                    <option value="Finanz/Lohnbuchhaltung">Finanz/Lohnbuchhaltung</option>
                    <option value="AL">AL</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    className="w-24 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold bg-card text-right"
                    value={e.salary}
                    onChange={(ev) => updateFromInput(e.id, "salary", ev.target.value)}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    step="0.5"
                    className="w-24 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold bg-card text-right"
                    value={e.baseMonths ?? state.settings.baseMonths}
                    onChange={(ev) => updateFromInput(e.id, "baseMonths", ev.target.value)}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    className="w-20 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold bg-card text-right"
                    value={e.factors.tenure}
                    onChange={(ev) => updateFromInput(e.id, "tenure", ev.target.value)}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    className="w-20 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold bg-card text-right"
                    value={e.factors.size}
                    onChange={(ev) => updateFromInput(e.id, "size", ev.target.value)}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    className="w-20 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold bg-card text-right"
                    value={e.factors.office}
                    onChange={(ev) => updateFromInput(e.id, "office", ev.target.value)}
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Nema zaposlenika za prikaz sa trenutnim filterom.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------ RESULTS VIEW ------------------

function ResultsView({ state }: { state: BonusState }) {
  const [exportingPdf, setExportingPdf] = useState(false);

  const groups = useMemo(() => {
    const byDept: Record<string, { rows: { emp: BonusEmployee; p: ReturnType<typeof calcPayout> }[] }> = {};
    for (const e of state.employees) {
      const dept = e.dept;
      if (!byDept[dept]) byDept[dept] = { rows: [] };
      byDept[dept].rows.push({ emp: e, p: calcPayout(e, state) });
    }
    return byDept;
  }, [state]);

  const grand = Object.values(groups).reduce(
    (acc, g) => {
      for (const r of g.rows) {
        acc.salary += r.emp.salary;
        acc.base += r.p.base;
        acc.cap += r.p.cap;
        acc.payout += r.p.payout;
      }
      return acc;
    },
    { salary: 0, base: 0, cap: 0, payout: 0 },
  );

  const fmt = (n: number) => n.toLocaleString("de-AT", { style: "currency", currency: "EUR" });

  const handleExportPdf = () => {
    setExportingPdf(true);
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const year = state.ui.selectedYear ?? BONUS_YEARS[0];

      doc.setFillColor(26, 56, 38);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("BONUS REZULTATI", 14, 14);
      doc.setFontSize(10);
      doc.setTextColor(255, 199, 44);
      doc.text(`Godina: ${year} · ${state.employees.length} zaposlenika`, 14, 22);

      let y = 36;
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Ukupna baza: ${fmt(grand.base)}  |  Ukupni plafon: ${fmt(grand.cap)}  |  Ukupna isplata: ${fmt(grand.payout)}`, 14, y);
      y += 10;

      for (const [dept, g] of Object.entries(groups)) {
        const totals = g.rows.reduce(
          (acc, r) => {
            acc.base += r.p.base;
            acc.cap += r.p.cap;
            acc.payout += r.p.payout;
            return acc;
          },
          { base: 0, cap: 0, payout: 0 },
        );
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(26, 56, 38);
        doc.text(`Odjel: ${dept}  ·  Baza: ${fmt(totals.base)}  |  Plafon: ${fmt(totals.cap)}  |  Isplata: ${fmt(totals.payout)}`, 14, y);
        y += 6;

        const tableData = g.rows.map(({ emp, p }) => [
          displayName(emp),
          fmt(emp.salary),
          fmt(p.base),
          `${Math.round(p.total * 100)}%`,
          p.factor.toFixed(3),
          fmt(p.cap),
          fmt(p.payout),
        ]);

        autoTable(doc, {
          startY: y,
          head: [["Zaposlenik", "Plata", "Baza", "Ukupno %", "Faktor", "Plafon", "Isplata"]],
          body: tableData,
          theme: "grid",
          headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14 },
        });

        y = (doc as any).lastAutoTable.finalY + 10;
      }

      doc.save(`Bonus_Rezultati_${year}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-3xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-black text-[#1a3826] tracking-tight uppercase">Ukupni rezultati</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="pill inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-slate-200 text-xs font-black text-muted-foreground">
            Zaposlenika: {state.employees.length}
          </span>
          <span className="pill inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-slate-200 text-xs font-black text-muted-foreground">
            Ukupna baza: {fmt(grand.base)}
          </span>
          <span className="pill inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-slate-200 text-xs font-black text-muted-foreground">
            Ukupni plafon: {fmt(grand.cap)}
          </span>
          <span className="pill inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFF7CC] border border-[#F2C94C] text-xs font-black text-[#1a3826]">
            Ukupna isplata: {fmt(grand.payout)}
          </span>
        </div>
      </div>

      {Object.entries(groups).map(([dept, g]) => {
        const totals = g.rows.reduce(
          (acc, r) => {
            acc.salary += r.emp.salary;
            acc.base += r.p.base;
            acc.cap += r.p.cap;
            acc.payout += r.p.payout;
            return acc;
          },
          { salary: 0, base: 0, cap: 0, payout: 0 },
        );

        return (
          <div key={dept} className="bg-card rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-[#1a3826] tracking-tight uppercase">Odjel: {dept}</h3>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1.5 rounded-full bg-muted border border-slate-200 font-black text-muted-foreground">
                  Baza: {fmt(totals.base)}
                </span>
                <span className="px-3 py-1.5 rounded-full bg-muted border border-slate-200 font-black text-muted-foreground">
                  Plafon: {fmt(totals.cap)}
                </span>
                <span className="px-3 py-1.5 rounded-full bg-[#FFF7CC] border border-[#F2C94C] font-black text-[#1a3826]">
                  Isplata: {fmt(totals.payout)}
                </span>
              </div>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-[11px] font-black uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Zaposlenik</th>
                    <th className="px-4 py-2 text-right">Plata</th>
                    <th className="px-4 py-2 text-right">Baza</th>
                    <th className="px-4 py-2 text-right">Ukupno %</th>
                    <th className="px-4 py-2 text-right">Faktor</th>
                    <th className="px-4 py-2 text-right">Plafon</th>
                    <th className="px-4 py-2 text-right">Isplata</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map(({ emp, p }) => (
                    <tr key={emp.id} className="border-t border-border">
                      <td className="px-4 py-2 text-left font-semibold text-foreground">{displayName(emp)}</td>
                      <td className="px-4 py-2 text-right text-foreground">{fmt(emp.salary)}</td>
                      <td className="px-4 py-2 text-right text-foreground">{fmt(p.base)}</td>
                      <td className="px-4 py-2 text-right font-bold text-foreground">
                        {Math.round(p.total * 100)}%
                      </td>
                      <td className="px-4 py-2 text-right text-foreground">{p.factor.toFixed(3)}</td>
                      <td className="px-4 py-2 text-right text-foreground">{fmt(p.cap)}</td>
                      <td className="px-4 py-2 text-right font-bold text-[#1a3826]">{fmt(p.payout)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="bg-card rounded-3xl border border-slate-200 p-6 shadow-sm flex justify-end">
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exportingPdf}
          className={cn(
            "inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-[#1a3826] text-white hover:bg-[#142d1f] transition-colors shadow-sm",
            exportingPdf && "opacity-70 cursor-wait",
          )}
        >
          {exportingPdf ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Export…
            </>
          ) : (
            <>Export PDF</>
          )}
        </button>
      </div>
    </div>
  );
}


function KpiCard({
  label,
  weightPct,
  valuePct,
  highlight,
}: {
  label: string;
  weightPct: number;
  valuePct: number;
  highlight?: boolean;
}) {
  const v = Math.round(valuePct * 10) / 10;
  const fill = Math.max(0, Math.min(v, 999));

  return (
    <div
      className={cn(
        "kpiCard bg-card rounded-3xl border p-4 shadow-sm",
        highlight ? "border-[#F2C94C] bg-[#FFF7CC]" : "border-slate-200",
      )}
    >
      <div className="kpiTop">
        <div className="kpiLabel text-xs font-black text-slate-500">
          {label} ({weightPct}%)
        </div>
      </div>
      <div className="kpiValue text-2xl font-black mt-1">{fill}%</div>
      <div className="kpiBar mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="kpiFill h-full rounded-full bg-[#F2C94C]"
          style={{ width: `${Math.min(fill, 100)}%` }}
        />
      </div>
    </div>
  );
}

