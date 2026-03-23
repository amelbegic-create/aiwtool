"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Pencil, Trash2, Plus } from "lucide-react";
import { MAX_PERSONAL_ENTRIES_PER_DAY } from "@/lib/calendarShared";
import {
  adminCreatePersonalEntry,
  adminUpdatePersonalEntry,
  adminDeletePersonalEntry,
} from "@/app/actions/calendarActions";

type Row = {
  id: string;
  date: Date;
  title: string;
  color: string | null;
};

const PRESETS = ["#FFBC0D", "#DA291C", "#1a3826", "#4169E1", "#9333ea", "#0d9488", "#ea580c"];

export default function UserPersonalCalendarPanel({
  targetUserId,
  initialRows,
}: {
  targetUserId: string;
  initialRows: { id: string; date: string; title: string; color: string | null }[];
}) {
  const router = useRouter();
  const rows: Row[] = useMemo(
    () =>
      initialRows.map((r) => ({
        id: r.id,
        date: parseISO(r.date.slice(0, 10)),
        title: r.title,
        color: r.color,
      })),
    [initialRows]
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formTitle, setFormTitle] = useState("");
  const [formColor, setFormColor] = useState("#FFBC0D");
  const [saving, setSaving] = useState(false);

  const countOnFormDate = () =>
    rows.filter((r) => format(r.date, "yyyy-MM-dd") === formDate).length;

  const refresh = () => router.refresh();

  const startEdit = (r: Row) => {
    setEditingId(r.id);
    setFormDate(format(r.date, "yyyy-MM-dd"));
    setFormTitle(r.title);
    setFormColor(r.color && /^#[0-9A-Fa-f]{6}$/.test(r.color) ? r.color : "#FFBC0D");
  };

  const resetForm = () => {
    setEditingId(null);
    setFormTitle("");
    setFormColor("#FFBC0D");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const d = parseISO(formDate);
      const colorHex = /^#[0-9A-Fa-f]{6}$/.test(formColor) ? formColor : undefined;
      if (editingId) {
        await adminUpdatePersonalEntry(targetUserId, editingId, {
          title: formTitle.trim() || "Persönlich",
          color: colorHex ?? null,
        });
      } else {
        if (countOnFormDate() >= MAX_PERSONAL_ENTRIES_PER_DAY) {
          alert(`Maximal ${MAX_PERSONAL_ENTRIES_PER_DAY} Einträge an diesem Tag.`);
          return;
        }
        await adminCreatePersonalEntry(targetUserId, d, formTitle.trim() || "Persönlich", colorHex);
      }
      resetForm();
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eintrag löschen?")) return;
    setSaving(true);
    try {
      await adminDeletePersonalEntry(targetUserId, id);
      if (editingId === id) resetForm();
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-black text-slate-900 mb-1">Persönliche Kalendereinträge</h3>
      <p className="text-sm text-slate-600 mb-4">
        Private Markierungen im Kalender dieses Benutzers (max. {MAX_PERSONAL_ENTRIES_PER_DAY} pro Tag).
      </p>

      <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded-xl mb-4">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left p-2 font-bold">Datum</th>
              <th className="text-left p-2 font-bold">Titel</th>
              <th className="w-24 p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-4 text-slate-500">
                  Keine Einträge.
                </td>
              </tr>
            ) : (
              rows
                .slice()
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-2 whitespace-nowrap">
                      {format(r.date, "d. MMM yyyy", { locale: de })}
                    </td>
                    <td className="p-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              r.color && /^#[0-9A-Fa-f]{6}$/.test(r.color) ? r.color : "#FFBC0D",
                          }}
                        />
                        {r.title}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="p-1.5 text-[#1a3826] inline-flex"
                        aria-label="Bearbeiten"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 text-red-600 inline-flex"
                        aria-label="Löschen"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
        <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Plus size={18} />
          {editingId ? "Eintrag bearbeiten" : "Neuer Eintrag"}
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Datum</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Titel</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Titel"
            />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-xs font-bold text-slate-600 block mb-1">Farbe</span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFormColor(c)}
                className={`w-8 h-8 rounded-full border-2 ${formColor === c ? "ring-2 ring-[#1a3826]" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            disabled={saving || (!editingId && countOnFormDate() >= MAX_PERSONAL_ENTRIES_PER_DAY)}
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-[#1a3826] text-white text-sm font-bold disabled:opacity-50"
          >
            {saving ? "…" : "Speichern"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-xl border text-sm font-bold">
              Abbrechen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
