"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  type HolidayRecord,
} from "@/app/actions/holidayActions";
import {
  listBlockedDays,
  createBlockedDay,
  deleteBlockedDay,
  type BlockedDayRecord,
  type RestaurantOption,
} from "@/app/actions/blockedDayActions";
import { toast } from "sonner";

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function groupHolidaysByYearAndMonth(list: HolidayRecord[]) {
  const recurring = list.filter((h) => h.year == null);
  const byYearNum = new Map<number, HolidayRecord[]>();
  for (const h of list) {
    if (h.year != null) {
      const arr = byYearNum.get(h.year) ?? [];
      arr.push(h);
      byYearNum.set(h.year, arr);
    }
  }
  const sortMonthBlocks = (items: HolidayRecord[]) => {
    const byM = new Map<number, HolidayRecord[]>();
    for (const h of items) {
      const arr = byM.get(h.month) ?? [];
      arr.push(h);
      byM.set(h.month, arr);
    }
    for (const arr of byM.values()) arr.sort((a, b) => a.day - b.day);
    return [...byM.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([month, rows]) => ({ month, rows }));
  };

  const sections: {
    key: string;
    title: string;
    months: { month: number; rows: HolidayRecord[] }[];
  }[] = [];
  if (recurring.length) {
    sections.push({ key: "recurring", title: "Jedes Jahr", months: sortMonthBlocks(recurring) });
  }
  for (const y of [...byYearNum.keys()].sort((a, b) => a - b)) {
    sections.push({
      key: String(y),
      title: String(y),
      months: sortMonthBlocks(byYearNum.get(y)!),
    });
  }
  return sections;
}

function blockedRestaurantLabel(b: BlockedDayRecord): string {
  const code = String(b.restaurantCode ?? "").trim();
  const name = (b.restaurantName ?? "").trim();
  if (!code && !name) return "—";
  if (!name || name === code) return code || name;
  return `${code} – ${name}`;
}

type BlockedDayGroupRow = {
  key: string;
  date: string;
  reason: string | null;
  ids: string[];
  restaurantLabel: string;
};

/** Isti datum + isti Grund → jedan red, restorani odvojeni zarezom (kraći pregled). */
function aggregateBlockedDaysByDateAndReason(list: BlockedDayRecord[]): BlockedDayGroupRow[] {
  const map = new Map<string, BlockedDayRecord[]>();
  for (const b of list) {
    const k = `${b.date}|${(b.reason ?? "").trim()}`;
    const arr = map.get(k) ?? [];
    arr.push(b);
    map.set(k, arr);
  }
  return Array.from(map.values())
    .map((entries) => {
      const sorted = [...entries].sort((a, b) =>
        String(a.restaurantCode).localeCompare(String(b.restaurantCode), "de")
      );
      const labels = sorted.map(blockedRestaurantLabel);
      const uniq = [...new Set(labels)];
      return {
        key: `${entries[0].date}|${(entries[0].reason ?? "").trim()}`,
        date: entries[0].date,
        reason: entries[0].reason,
        ids: sorted.map((x) => x.id),
        restaurantLabel: uniq.join(", "),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function groupBlockedGroupsByYearAndMonth(groups: BlockedDayGroupRow[]) {
  const sorted = [...groups].sort((a, b) => a.date.localeCompare(b.date));
  const byYear = new Map<number, Map<number, BlockedDayGroupRow[]>>();
  for (const g of sorted) {
    const d = new Date(`${g.date}T12:00:00`);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    let mm = byYear.get(y);
    if (!mm) {
      mm = new Map();
      byYear.set(y, mm);
    }
    const arr = mm.get(m) ?? [];
    arr.push(g);
    mm.set(m, arr);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  return years.map((year) => {
    const mm = byYear.get(year)!;
    const months = [...mm.keys()]
      .sort((a, b) => a - b)
      .map((month) => ({ month, rows: mm.get(month)! }));
    return { year, months };
  });
}

function filterHolidaysByYearMonth(
  list: HolidayRecord[],
  yearF: "all" | number,
  monthF: "all" | number
): HolidayRecord[] {
  return list.filter((h) => {
    if (monthF !== "all" && h.month !== monthF) return false;
    if (yearF === "all") return true;
    if (h.year == null) return true;
    return h.year === yearF;
  });
}

function filterBlockedDaysByYearMonth(
  list: BlockedDayRecord[],
  yearF: "all" | number,
  monthF: "all" | number
): BlockedDayRecord[] {
  return list.filter((b) => {
    const d = new Date(`${b.date}T12:00:00`);
    if (yearF !== "all" && d.getFullYear() !== yearF) return false;
    if (monthF !== "all" && d.getMonth() + 1 !== monthF) return false;
    return true;
  });
}

type Props = {
  initialHolidays: HolidayRecord[];
  initialBlockedDays: BlockedDayRecord[];
  restaurants: RestaurantOption[];
};

export default function HolidaysClient({
  initialHolidays,
  initialBlockedDays,
  restaurants,
}: Props) {
  const [holidays, setHolidays] = useState<HolidayRecord[]>(initialHolidays);
  const [loading, setLoading] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ day: 1, month: 1, label: "", yearOnly: false, year: new Date().getFullYear() });

  const [blockedDays, setBlockedDays] = useState<BlockedDayRecord[]>(initialBlockedDays);
  const [blockedDate, setBlockedDate] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const [blockedRestaurantId, setBlockedRestaurantId] = useState<string>("all");
  const [blockedLoading, setBlockedLoading] = useState<string | null>(null);

  const [holidayYearFilter, setHolidayYearFilter] = useState<"all" | number>("all");
  const [holidayMonthFilter, setHolidayMonthFilter] = useState<"all" | number>("all");
  const [blockedYearFilter, setBlockedYearFilter] = useState<"all" | number>("all");
  const [blockedMonthFilter, setBlockedMonthFilter] = useState<"all" | number>("all");

  const holidayYearsInData = useMemo(() => {
    const s = new Set<number>();
    for (const h of holidays) {
      if (h.year != null) s.add(h.year);
    }
    return [...s].sort((a, b) => a - b);
  }, [holidays]);

  const blockedYearsInData = useMemo(() => {
    const s = new Set<number>();
    for (const b of blockedDays) {
      s.add(new Date(`${b.date}T12:00:00`).getFullYear());
    }
    return [...s].sort((a, b) => a - b);
  }, [blockedDays]);

  const filteredHolidays = useMemo(
    () => filterHolidaysByYearMonth(holidays, holidayYearFilter, holidayMonthFilter),
    [holidays, holidayYearFilter, holidayMonthFilter]
  );
  const filteredBlockedRaw = useMemo(
    () => filterBlockedDaysByYearMonth(blockedDays, blockedYearFilter, blockedMonthFilter),
    [blockedDays, blockedYearFilter, blockedMonthFilter]
  );
  const blockedAggregated = useMemo(
    () => aggregateBlockedDaysByDateAndReason(filteredBlockedRaw),
    [filteredBlockedRaw]
  );

  const holidaySections = useMemo(() => groupHolidaysByYearAndMonth(filteredHolidays), [filteredHolidays]);
  const blockedSections = useMemo(
    () => groupBlockedGroupsByYearAndMonth(blockedAggregated),
    [blockedAggregated]
  );

  const resetForm = () => {
    setForm({ day: 1, month: 1, label: "", yearOnly: false, year: new Date().getFullYear() });
    setShowForm(false);
    setEditingId(null);
  };

  const resetBlockedForm = () => {
    setBlockedDate("");
    setBlockedReason("");
    setBlockedRestaurantId("all");
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

  const handleCreateBlocked = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockedDate) {
      toast.error("Datum ist erforderlich.");
      return;
    }
    setBlockedLoading("create");
    const res = await createBlockedDay({
      date: blockedDate,
      reason: blockedReason || null,
      restaurantId: blockedRestaurantId,
    });
    setBlockedLoading(null);
    if (res.ok) {
      const list = await listBlockedDays();
      setBlockedDays(list);
      resetBlockedForm();
      toast.success("Gespeichert.");
    } else {
      toast.error(res.error ?? "Fehler");
    }
  };

  const handleDeleteBlockedGroup = async (ids: string[]) => {
    const msg =
      ids.length > 1
        ? `${ids.length} Einträge für dieses Datum wirklich löschen?`
        : "Gesperrten Tag wirklich löschen?";
    if (!confirm(msg)) return;
    setBlockedLoading("bulk");
    try {
      for (const id of ids) {
        const res = await deleteBlockedDay(id);
        if (!res.ok) {
          toast.error(res.error ?? "Fehler");
          setBlockedLoading(null);
          return;
        }
      }
      const list = await listBlockedDays();
      setBlockedDays(list);
      toast.success("Gespeichert.");
    } finally {
      setBlockedLoading(null);
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-10 font-sans text-foreground">
      <div className="max-w-[900px] mx-auto space-y-8">
        <div className="flex items-end justify-between gap-4 border-b border-slate-200 dark:border-border pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter">
              FEIERTAGE <span className="text-[#FFC72C]">VERWALTUNG</span>
            </h1>
            <p className="text-muted-foreground text-sm font-semibold mt-1">
              Verwalten Sie zentrale Feiertage für alle Module. Diese Tage werden bei Urlaubsanträgen nicht als Urlaubstage gezählt.
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
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-1">
              Noch keine Feiertage angelegt.
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
              Legen Sie die Feiertage manuell an. Diese gelten anschließend automatisch für alle Mitarbeiter.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
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
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                  Filter Jahr
                </label>
                <select
                  value={holidayYearFilter === "all" ? "all" : String(holidayYearFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHolidayYearFilter(v === "all" ? "all" : parseInt(v, 10));
                  }}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm min-w-[120px]"
                >
                  <option value="all">Alle Jahre</option>
                  {holidayYearsInData.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                  Filter Monat
                </label>
                <select
                  value={holidayMonthFilter === "all" ? "all" : String(holidayMonthFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHolidayMonthFilter(v === "all" ? "all" : parseInt(v, 10));
                  }}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm min-w-[140px]"
                >
                  <option value="all">Alle Monate</option>
                  {MONTH_NAMES.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
                {holidaySections.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      {holidays.length === 0
                        ? "Keine Einträge."
                        : "Keine Einträge für die gewählten Filter."}
                    </td>
                  </tr>
                ) : (
                  holidaySections.map((sec) => (
                    <Fragment key={sec.key}>
                      <tr className="bg-muted/70 border-t border-slate-200 dark:border-border">
                        <td
                          colSpan={5}
                          className="p-3 font-black text-xs uppercase tracking-wider text-[#1a3826] dark:text-[#FFC72C]"
                        >
                          {sec.title}
                        </td>
                      </tr>
                      {sec.months.map((monthBlock) => (
                        <Fragment key={`${sec.key}-m${monthBlock.month}`}>
                          <tr className="bg-muted/40 border-t border-slate-200 dark:border-border">
                            <td colSpan={5} className="p-2 pl-4 text-xs font-bold text-muted-foreground">
                              {MONTH_NAMES[monthBlock.month - 1]}
                            </td>
                          </tr>
                          {monthBlock.rows.map((h) => (
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
                        </Fragment>
                      ))}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* GESPERRENTE TAGE – BLOKIRANI DANI ZA GODIŠNJI */}
        <div className="mt-10 space-y-4">
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              Gesperrte Tage (Urlaub)
            </h2>
            <p className="text-xs text-muted-foreground">
              Mehrere Restaurants am selben Tag mit gleichem Grund erscheinen in einer Zeile.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                  Filter Jahr
                </label>
                <select
                  value={blockedYearFilter === "all" ? "all" : String(blockedYearFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBlockedYearFilter(v === "all" ? "all" : parseInt(v, 10));
                  }}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm min-w-[120px]"
                >
                  <option value="all">Alle Jahre</option>
                  {blockedYearsInData.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                  Filter Monat
                </label>
                <select
                  value={blockedMonthFilter === "all" ? "all" : String(blockedMonthFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBlockedMonthFilter(v === "all" ? "all" : parseInt(v, 10));
                  }}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm min-w-[140px]"
                >
                  <option value="all">Alle Monate</option>
                  {MONTH_NAMES.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleCreateBlocked}
            className="p-4 rounded-xl border border-slate-200 dark:border-border bg-card space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Datum
                </label>
                <input
                  type="date"
                  value={blockedDate}
                  onChange={(e) => setBlockedDate(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Restaurant
                </label>
                <select
                  value={blockedRestaurantId}
                  onChange={(e) => setBlockedRestaurantId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">Alle Restaurants</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} – {r.name ?? "Ohne Name"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Grund (optional)
                </label>
                <input
                  type="text"
                  value={blockedReason}
                  onChange={(e) => setBlockedReason(e.target.value)}
                  placeholder="z. B. Betriebsurlaub"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={blockedLoading !== null}
                className="px-4 py-2 rounded-lg bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] font-semibold text-sm disabled:opacity-50"
              >
                Speichern
              </button>
              <button
                type="button"
                onClick={resetBlockedForm}
                className="px-4 py-2 rounded-lg border border-input font-semibold text-sm"
              >
                Abbrechen
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-slate-200 dark:border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-semibold">Datum</th>
                  <th className="text-left p-3 font-semibold">Restaurant</th>
                  <th className="text-left p-3 font-semibold">Grund</th>
                  <th className="text-right p-3 font-semibold">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {blockedSections.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-xs text-muted-foreground italic">
                      {blockedDays.length === 0
                        ? "Keine gesperrten Tage angelegt."
                        : "Keine Einträge für die gewählten Filter."}
                    </td>
                  </tr>
                ) : (
                  blockedSections.map((yearSec) => (
                    <Fragment key={yearSec.year}>
                      <tr className="bg-muted/70 border-t border-slate-200 dark:border-border">
                        <td
                          colSpan={4}
                          className="p-3 font-black text-xs uppercase tracking-wider text-[#1a3826] dark:text-[#FFC72C]"
                        >
                          {yearSec.year}
                        </td>
                      </tr>
                      {yearSec.months.map((monthBlock) => (
                        <Fragment key={`${yearSec.year}-m${monthBlock.month}`}>
                          <tr className="bg-muted/40 border-t border-slate-200 dark:border-border">
                            <td colSpan={4} className="p-2 pl-4 text-xs font-bold text-muted-foreground">
                              {MONTH_NAMES[monthBlock.month - 1]}
                            </td>
                          </tr>
                          {monthBlock.rows.map((g) => (
                            <tr key={g.key} className="border-t border-slate-200 dark:border-border">
                              <td className="p-3">
                                {new Date(`${g.date}T12:00:00`).toLocaleDateString("de-AT")}
                              </td>
                              <td className="p-3 max-w-[240px] break-words">{g.restaurantLabel}</td>
                              <td className="p-3">{g.reason ?? "—"}</td>
                              <td className="p-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteBlockedGroup(g.ids)}
                                  disabled={blockedLoading !== null}
                                  className="p-1.5 rounded border border-transparent hover:border-red-300 text-muted-foreground hover:text-red-600 ml-1 disabled:opacity-50"
                                  title="Löschen"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
