"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Plus, Pencil, Trash2, Download } from "lucide-react";
import {
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  importDefaultHolidaysAT,
  type HolidayRecord,
} from "@/app/actions/holidayActions";
import { toast } from "sonner";

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

type Props = { initialHolidays: HolidayRecord[] };

export default function HolidaysClient({ initialHolidays }: Props) {
  const [holidays, setHolidays] = useState<HolidayRecord[]>(initialHolidays);
  const [loading, setLoading] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ day: 1, month: 1, label: "", yearOnly: false, year: new Date().getFullYear() });

  const resetForm = () => {
    setForm({ day: 1, month: 1, label: "", yearOnly: false, year: new Date().getFullYear() });
    setShowForm(false);
    setEditingId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading("create");
    const res = await createHoliday({
      day: form.day,
      month: form.month,
      label: form.label.trim() || null,
      year: form.yearOnly ? form.year : null,
    });
    setLoading(null);
    if (res.ok) {
      const list = await listHolidays();
      setHolidays(list);
      resetForm();
      toast.success("Gespeichert.");
    } else {
      toast.error(res.error ?? "Fehler");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setLoading(editingId);
    const res = await updateHoliday(editingId, {
      day: form.day,
      month: form.month,
      label: form.label.trim() || null,
      year: form.yearOnly ? form.year : null,
    });
    setLoading(null);
    if (res.ok) {
      const list = await listHolidays();
      setHolidays(list);
      resetForm();
      toast.success("Gespeichert.");
    } else {
      toast.error(res.error ?? "Fehler");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Feiertag wirklich löschen?")) return;
    setLoading(id);
    const res = await deleteHoliday(id);
    setLoading(null);
    if (res.ok) {
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      if (editingId === id) resetForm();
      toast.success("Feiertag gelöscht.");
    } else {
      toast.error(res.error ?? "Fehler");
    }
  };

  const startEdit = (h: HolidayRecord) => {
    setEditingId(h.id);
    setForm({
      day: h.day,
      month: h.month,
      label: h.label ?? "",
      yearOnly: h.year != null,
      year: h.year ?? new Date().getFullYear(),
    });
  };

  const handleImportDefault = async () => {
    setLoading("import");
    const res = await importDefaultHolidaysAT();
    setLoading(null);
    if (res.ok) {
      const list = await listHolidays();
      setHolidays(list);
      toast.success("Standard-Feiertage (AT) importiert.");
    } else {
      toast.error(res.error ?? "Fehler");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-10 font-sans text-foreground">
      <div className="max-w-[900px] mx-auto space-y-8">
        <div className="flex items-end justify-between gap-4 border-b border-slate-200 dark:border-border pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter">
              FEIERTAGE <span className="text-[#FFC72C]">VERWALTUNG</span>
            </h1>
            <p className="text-muted-foreground text-sm font-semibold mt-1">
              Globale Feiertage für Arbeitsplaner und andere Module. Ostermontag und Pfingstmontag werden automatisch berechnet.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm font-bold text-[#1a3826] dark:text-[#FFC72C] hover:underline"
          >
            ← Zurück zur Verwaltung
          </Link>
        </div>

        {holidays.length === 0 && (
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">
              Noch keine Feiertage angelegt.
            </p>
            <button
              type="button"
              onClick={handleImportDefault}
              disabled={loading === "import"}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-card text-amber-800 dark:text-amber-200 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50"
            >
              <Download size={18} />
              Uvezi zadane (AT)
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              Alle Feiertage
            </h2>
            {!showForm && !editingId && (
              <button
                type="button"
                onClick={() => { setShowForm(true); setForm({ day: 1, month: 1, label: "", yearOnly: false, year: new Date().getFullYear() }); }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1a3826] dark:border-[#FFC72C] bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] font-semibold hover:opacity-90"
              >
                <Plus size={18} />
                Neuer Feiertag
              </button>
            )}
          </div>

          {(showForm || editingId) && (
            <form
              onSubmit={editingId ? handleUpdate : handleCreate}
              className="p-4 rounded-xl border border-slate-200 dark:border-border bg-card space-y-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Tag (1–31)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={form.day}
                    onChange={(e) => setForm((f) => ({ ...f, day: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Monat</label>
                  <select
                    value={form.month}
                    onChange={(e) => setForm((f) => ({ ...f, month: parseInt(e.target.value, 10) }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    {MONTH_NAMES.map((name, i) => (
                      <option key={i} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Name (optional)</label>
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="z. B. Neujahr"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.yearOnly}
                    onChange={(e) => setForm((f) => ({ ...f, yearOnly: e.target.checked }))}
                    className="rounded border-input"
                  />
                  <span className="text-sm font-medium">Nur für Jahr</span>
                </label>
                {form.yearOnly && (
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: parseInt(e.target.value, 10) || new Date().getFullYear() }))}
                    className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading !== null}
                  className="px-4 py-2 rounded-lg bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] font-semibold text-sm disabled:opacity-50"
                >
                  {editingId ? "Speichern" : "Anlegen"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-input font-semibold text-sm"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-semibold">Tag</th>
                  <th className="text-left p-3 font-semibold">Monat</th>
                  <th className="text-left p-3 font-semibold">Name</th>
                  <th className="text-left p-3 font-semibold">Jahr</th>
                  <th className="text-right p-3 font-semibold">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id} className="border-t border-slate-200 dark:border-border">
                    <td className="p-3">{h.day}</td>
                    <td className="p-3">{MONTH_NAMES[h.month - 1]}</td>
                    <td className="p-3">{h.label ?? "—"}</td>
                    <td className="p-3">{h.year == null ? "Jedes Jahr" : h.year}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(h)}
                        className="p-1.5 rounded border border-transparent hover:border-input text-muted-foreground hover:text-foreground"
                        title="Bearbeiten"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(h.id)}
                        disabled={loading === h.id}
                        className="p-1.5 rounded border border-transparent hover:border-red-300 text-muted-foreground hover:text-red-600 ml-1 disabled:opacity-50"
                        title="Löschen"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {holidays.length === 0 && !showForm && !editingId && (
              <p className="p-6 text-center text-muted-foreground">Keine Einträge.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
