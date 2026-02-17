"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Plus, Trash2 } from "lucide-react";
import { addDashboardHighlight, removeDashboardHighlight } from "@/app/actions/dashboardHighlightActions";
import { APP_TOOLS } from "@/lib/tools/tools-config";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";

type Highlight = { id: string; moduleKey: string; moduleLabel: string; addedAt: Date | string };

type Props = { initialHighlights: Highlight[] };

/** Display label for module – maps legacy Croatian labels from DB to German */
const MODULE_LABEL_DE: Record<string, string> = {
  "Jahresurlaub": "Jahresurlaub",
  "Pravila & Procedure": "Richtlinien & Dokumente",
  "Pravila": "Richtlinien",
};

function displayModuleLabel(label: string): string {
  return MODULE_LABEL_DE[label] ?? label;
}

export default function DashboardModulesClient({ initialHighlights }: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>(initialHighlights);
  const [loading, setLoading] = useState<string | null>(null);

  const highlightedKeys = new Set(highlights.map((h) => h.moduleKey));

  const handleAdd = async (tool: (typeof APP_TOOLS)[0]) => {
    setLoading(tool.id);
    const res = await addDashboardHighlight(tool.id, tool.name);
    setLoading(null);
    if (res.ok) {
      setHighlights((prev) => [...prev, { id: tool.id, moduleKey: tool.id, moduleLabel: tool.name, addedAt: new Date() }]);
    }
  };

  const handleRemove = async (moduleKey: string) => {
    setLoading(moduleKey);
    const res = await removeDashboardHighlight(moduleKey);
    setLoading(null);
    if (res.ok) {
      setHighlights((prev) => prev.filter((h) => h.moduleKey !== moduleKey));
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-10 font-sans text-foreground">
      <div className="max-w-[900px] mx-auto space-y-8">
        <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-black text-[#1a3826] flex items-center gap-2">
              <LayoutDashboard size={28} />
              Dashboard-Konfiguration
            </h1>
            <p className="text-muted-foreground text-sm font-semibold mt-1">
              Legen Sie fest, welche Module Nutzern auf der Startseite angezeigt werden.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm font-bold text-[#1a3826] hover:underline"
          >
            ← Zurück zur Verwaltung
          </Link>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
            Sichtbare Module (werden auf dem Dashboard angezeigt)
          </h2>
          {highlights.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Keine Module ausgewählt. Fügen Sie unten welche hinzu.</p>
          ) : (
            <ul className="space-y-2">
              {highlights.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-card"
                >
                  <span className="font-semibold text-foreground">{displayModuleLabel(h.moduleLabel)}</span>
                  <span className="text-xs text-muted-foreground">hinzugefügt {formatDateDDMMGGGG(h.addedAt)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(h.moduleKey)}
                    disabled={loading === h.moduleKey}
                    className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title="Von Liste entfernen"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
            Verfügbare Module – zur Anzeige auf der Startseite hinzufügen
          </h2>
          <ul className="grid gap-2">
            {APP_TOOLS.filter((t) => !highlightedKeys.has(t.id)).map((tool) => (
              <li key={tool.id}>
                <button
                  type="button"
                  onClick={() => handleAdd(tool)}
                  disabled={loading === tool.id}
                  className="w-full flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-card hover:bg-[#1a3826]/5 hover:border-[#1a3826]/30 transition-colors text-left disabled:opacity-50"
                >
                  <span className="font-semibold text-foreground">{tool.name}</span>
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-[#1a3826]">
                    <Plus size={18} />
                    Hinzufügen
                  </span>
                </button>
              </li>
            ))}
            {APP_TOOLS.every((t) => highlightedKeys.has(t.id)) && (
              <p className="text-sm text-muted-foreground py-2">Alle Module sind bereits hinzugefügt.</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
