"use client";

import { useState } from "react";
import type { PDSEvaluationRecord } from "@/app/actions/pdsActions";

type Employee = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  department: string | null;
  departmentColor: string | null;
  restaurants: { code: string; name: string | null }[];
};

type Props = {
  employees: Employee[];
  currentUserName: string;
};

export default function PDSProClient({ employees, currentUserName }: Props) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | "">("");

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) ?? null;

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {/* HEADER */}
        <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              PERFORMANCE DEVELOPMENT SYSTEM
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#1a3826] dark:text-[#FFC72C]">
              PDS <span className="text-[#FFC72C]">PRO</span>
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Bonusrechner & Leistungsziele im McDonald’s Design.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 text-right text-xs">
            <p className="font-semibold text-muted-foreground">
              Evaluator: <span className="font-bold text-foreground">{currentUserName}</span>
            </p>
            <p className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200">
              BETA · Modul im Aufbau
            </p>
          </div>
        </header>

        {/* MAIN GRID */}
        <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* LEFT: Mitarbeiter-Auswahl */}
          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Mitarbeiter auswählen
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Crew & Shift Leader aus dem aktuell ausgewählten Restaurant.
              </p>
            </div>

            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]"
            >
              <option value="">– Mitarbeiter wählen –</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name ?? "Unbekannt"}{" "}
                  {e.restaurants.length > 0 ? `(${e.restaurants.map((r) => r.code).join(", ")})` : ""}
                </option>
              ))}
            </select>

            {selectedEmployee && (
              <div className="mt-2 rounded-xl border border-dashed border-border bg-muted/40 p-3 text-xs">
                <p className="font-semibold text-foreground">{selectedEmployee.name}</p>
                <p className="text-muted-foreground">
                  {selectedEmployee.department ? `Abteilung: ${selectedEmployee.department} · ` : ""}
                  Rolle: {selectedEmployee.role}
                </p>
              </div>
            )}
          </section>

          {/* RIGHT: Placeholder za kalkulator */}
          <section className="flex flex-col justify-between gap-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-5 shadow-inner">
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-[#1a3826]">
                PDS PRO Kalkulator
              </h2>
              <p className="mt-1 text-xs text-amber-800">
                Mathematische Logik aus dem bestehenden HTML-Tool wird hier integriert
                (Net-Income, Ziele, Noten-Logik). Diese Sektion ist momentan ein Platzhalter
                – Berechnungen folgen im sljedećem koraku.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-4 text-sm shadow">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Gesamtscore & Note
                </p>
                <p className="mt-1 text-2xl font-black text-[#DA291C]">–</p>
              </div>

              <button
                disabled
                className="rounded-xl bg-[#FFC72C] px-5 py-2 text-xs font-black uppercase tracking-widest text-[#1a3826] shadow-sm opacity-60"
              >
                Speichern (COMING SOON)
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

