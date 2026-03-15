"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  parseISO,
  getDay,
  differenceInDays,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Smartphone,
  Plus,
  Trash2,
  ArrowLeft,
  X,
  Settings2,
  Pencil,
} from "lucide-react";
import {
  getCalendarEvents,
  addCalendarEvent,
  deleteCalendarEvent,
  getCalendarDataForExport,
  getCalendarCategories,
  createCalendarCategory,
  updateCalendarCategory,
  deleteCalendarCategory,
  upsertPersonalEntry,
  deletePersonalEntry,
  type CalendarEventItem,
  type CalendarEventType,
  type CalendarEventCategoryItem,
} from "@/app/actions/calendarActions";
import { createEvents } from "ics";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const TYPE_STYLES: Record<
  CalendarEventType,
  { bg: string; text: string; label: string }
> = {
  personal: {
    bg: "bg-[#FFBC0D]/25",
    text: "text-gray-900",
    label: "Persönlich",
  },
  shift: {
    bg: "bg-[#DA291C]/20",
    text: "text-[#DA291C]",
    label: "Smjene",
  },
  vacation: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-800 dark:text-emerald-300",
    label: "Urlaub",
  },
};

function parseEventDate(e: CalendarEventItem): Date {
  return typeof e.date === "string" ? parseISO(e.date) : e.date;
}

const PRESET_COLORS = [
  "#FFBC0D",
  "#DA291C",
  "#1a3826",
  "#4169E1",
  "#9333ea",
  "#0d9488",
  "#ea580c",
];

function CategoriesModal({
  categories,
  onClose,
  onSaved,
}: {
  categories: CalendarEventCategoryItem[];
  onClose: () => void;
  onSaved: (list: CalendarEventCategoryItem[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createCalendarCategory(newName.trim(), newColor || undefined);
      setNewName("");
      setNewColor("");
      const list = await getCalendarCategories();
      onSaved(list);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    try {
      await updateCalendarCategory(id, { name: editName.trim(), color: editColor || null });
      setEditId(null);
      const list = await getCalendarCategories();
      onSaved(list);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCalendarCategory(id);
      const list = await getCalendarCategories();
      onSaved(list);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Kategorien verwalten"
    >
      <div
        className="rounded-2xl bg-white dark:bg-[#1a3826] border border-[#1a3826]/20 dark:border-[#FFC72C]/30 shadow-xl max-w-md w-full p-5 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-[#1a3826] dark:text-[#FFC72C]">Kategorien verwalten</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg border hover:bg-black/5">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 mb-4">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 flex-wrap">
              {editId === c.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 min-w-0 rounded-lg border px-2 py-1 text-sm"
                  />
                  <input
                    type="color"
                    value={editColor || "#FFBC0D"}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate(c.id)}
                    disabled={saving}
                    className="py-1 px-2 rounded bg-[#1a3826] dark:bg-[#FFC72C] text-white text-sm"
                  >
                    Speichern
                  </button>
                  <button type="button" onClick={() => setEditId(null)} className="py-1 px-2 rounded border text-sm">
                    Abbrechen
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{c.name}</span>
                  {c.color && (
                    <span
                      className="w-4 h-4 rounded-full border border-gray-300 inline-block"
                      style={{ backgroundColor: c.color }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => { setEditId(c.id); setEditName(c.name); setEditColor(c.color ?? ""); }}
                    className="p-1 rounded text-[#1a3826] dark:text-[#FFC72C]"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="p-1 rounded text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap items-center border-t pt-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Neue Kategorie"
            className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-[#FFC72C]/30 px-3 py-2 text-sm"
          />
          <input
            type="color"
            value={newColor || "#FFBC0D"}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-8 h-8 rounded border cursor-pointer"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving || !newName.trim()}
            className="py-2 px-4 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-bold disabled:opacity-50"
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}

function getEventStyle(ev: CalendarEventItem): { bg: string; text: string } {
  const hex = ev.categoryColor ?? ev.color;
  if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return {
      bg: "",
      text: "text-gray-900 dark:text-white",
    };
  }
  if (ev.isPersonalEntry) {
    return { bg: "bg-violet-500/25", text: "text-violet-800 dark:text-violet-200" };
  }
  const s = TYPE_STYLES[ev.type as CalendarEventType];
  return { bg: s.bg, text: s.text };
}

export default function CalendarClient({
  userId,
  initialYear,
  initialMonth,
  initialEvents,
  canWrite = false,
}: {
  userId: string;
  initialYear: number;
  initialMonth: number;
  initialEvents: CalendarEventItem[];
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [events, setEvents] = useState<CalendarEventItem[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newEndDate, setNewEndDate] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newColor, setNewColor] = useState("");
  const [adding, setAdding] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [categories, setCategories] = useState<CalendarEventCategoryItem[]>([]);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categoryEditId, setCategoryEditId] = useState<string | null>(null);
  const [categoryEditName, setCategoryEditName] = useState("");
  const [categoryEditColor, setCategoryEditColor] = useState("");
  const [selectedDayForPersonal, setSelectedDayForPersonal] = useState<Date | null>(null);
  const [personalEntryTitle, setPersonalEntryTitle] = useState("");
  const [personalEntrySaving, setPersonalEntrySaving] = useState(false);

  useEffect(() => {
    getCalendarCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !newCategoryId) setNewCategoryId(categories[0].id);
  }, [categories, newCategoryId]);

  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startWeekday = (getDay(monthStart) + 6) % 7;
  const padding = Array(startWeekday).fill(null);
  const gridDays = [...padding, ...daysInMonth];
  const totalCells = Math.ceil(gridDays.length / 7) * 7;
  const filledGrid = [...gridDays, ...Array(totalCells - gridDays.length).fill(null)];

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const e of events) {
      const d = parseEventDate(e);
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  /** Za višednevne događaje: id -> { start, end, ev }. Koristi se za kontinuiranu traku. */
  const multiDaySpans = useMemo(() => {
    const map = new Map<string, { start: Date; end: Date; ev: CalendarEventItem }>();
    for (const e of events) {
      const d = parseEventDate(e);
      const endD = e.endDate
        ? (typeof e.endDate === "string" ? parseISO(e.endDate) : e.endDate)
        : d;
      const existing = map.get(e.id);
      if (!existing) {
        map.set(e.id, { start: d, end: endD, ev: e });
      } else {
        if (d < existing.start) existing.start = d;
        if (endD > existing.end) existing.end = endD;
      }
    }
    return map;
  }, [events]);

  /** Indeksi ćelija koje su "nastavak" višednevnog događaja (ne renderamo ih). */
  const continuationIndices = useMemo(() => {
    const set = new Set<number>();
    const grid = filledGrid;
    multiDaySpans.forEach((span) => {
      const days = differenceInDays(span.end, span.start) + 1;
      if (days <= 1) return;
      const startKey = format(span.start, "yyyy-MM-dd");
      const idx = grid.findIndex((d) => d && format(d, "yyyy-MM-dd") === startKey);
      if (idx === -1) return;
      const col = idx % 7;
      const spanInRow = Math.min(days, 7 - col);
      for (let j = 1; j < spanInRow; j++) set.add(idx + j);
    });
    return set;
  }, [multiDaySpans, filledGrid]);

  /** Na početku višednevnog: koliko kolona ćelija spanati (1 = obična ćelija). */
  const cellSpanByIndex = useMemo(() => {
    const map = new Map<number, number>();
    const grid = filledGrid;
    multiDaySpans.forEach((span) => {
      const days = differenceInDays(span.end, span.start) + 1;
      if (days <= 1) return;
      const startKey = format(span.start, "yyyy-MM-dd");
      const idx = grid.findIndex((d) => d && format(d, "yyyy-MM-dd") === startKey);
      if (idx === -1) return;
      const col = idx % 7;
      map.set(idx, Math.min(days, 7 - col));
    });
    return map;
  }, [multiDaySpans, filledGrid]);

  const loadMonth = useCallback(
    async (y: number, m: number) => {
      setLoading(true);
      try {
        const list = await getCalendarEvents(userId, y, m);
        setEvents(list);
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const handlePrevMonth = () => {
    const d = subMonths(new Date(year, month - 1), 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    loadMonth(d.getFullYear(), d.getMonth() + 1);
  };

  const handleNextMonth = () => {
    const d = addMonths(new Date(year, month - 1), 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    loadMonth(d.getFullYear(), d.getMonth() + 1);
  };

  const handleAddEvent = async () => {
    if (!newTitle.trim() || !newCategoryId) return;
    setAdding(true);
    try {
      const start = parseISO(newDate);
      const end = newEndDate && newEndDate >= newDate ? parseISO(newEndDate) : null;
      await addCalendarEvent(userId, {
        title: newTitle.trim(),
        date: start,
        categoryId: newCategoryId,
        endDate: end ?? undefined,
      });
      setNewTitle("");
      setNewDate(format(new Date(), "yyyy-MM-dd"));
      setNewEndDate("");
      setNewColor("");
      router.refresh();
      await loadMonth(year, month);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteEvent = async (id: string, ev?: CalendarEventItem) => {
    if (id.startsWith("vac-")) return;
    if (id.startsWith("pe-")) {
      if (!ev) return;
      const d = parseEventDate(ev);
      await deletePersonalEntry(userId, d);
    } else {
      await deleteCalendarEvent(id, userId);
    }
    router.refresh();
    await loadMonth(year, month);
  };

  const handleSavePersonalEntry = async () => {
    if (!selectedDayForPersonal) return;
    setPersonalEntrySaving(true);
    try {
      await upsertPersonalEntry(userId, selectedDayForPersonal, personalEntryTitle.trim() || "Osobno");
      setSelectedDayForPersonal(null);
      setPersonalEntryTitle("");
      router.refresh();
      await loadMonth(year, month);
    } finally {
      setPersonalEntrySaving(false);
    }
  };

  const upcomingEvents = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return [...events]
      .map((e) => ({ ...e, date: parseEventDate(e) }))
      .filter((e) => format(e.date, "yyyy-MM-dd") >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 10);
  }, [events]);

  const exportToICS = async () => {
    const data = await getCalendarDataForExport(userId);
    const icsEvents: Parameters<typeof createEvents>[0] = [];

    for (const e of data.events) {
      const d = new Date(e.date);
      const end = e.endDate ? new Date(e.endDate) : null;
      const endSameDay = !end || format(d, "yyyy-MM-dd") === format(end, "yyyy-MM-dd");
      icsEvents.push({
        title: e.title,
        start: [d.getFullYear(), d.getMonth() + 1, d.getDate(), 0, 0],
        duration: end && !endSameDay
          ? { days: Math.ceil((end.getTime() - d.getTime()) / (24 * 60 * 60 * 1000)) + 1 }
          : { hours: 24 },
      });
    }
    for (const v of data.vacationRanges) {
      const start = new Date(v.start);
      const end = new Date(v.end);
      const current = new Date(start);
      while (current <= end) {
        icsEvents.push({
          title: v.title,
          start: [
            current.getFullYear(),
            current.getMonth() + 1,
            current.getDate(),
            0,
            0,
          ],
          duration: { hours: 24 },
        });
        current.setDate(current.getDate() + 1);
      }
    }

    if (icsEvents.length === 0) {
      icsEvents.push({
        title: "AIW Kalender",
        start: [
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          new Date().getDate(),
          0,
          0,
        ],
        duration: { minutes: 1 },
      });
    }

    const { error, value } = createEvents(icsEvents);
    if (error) {
      console.error(error);
      return;
    }
    const blob = new Blob([value!], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mein-aiw-kalender.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  const today = new Date();

  const getEventLabel = (ev: CalendarEventItem): string => {
    if (ev.isPersonalEntry) return "Osobni Eintrag";
    return ev.categoryLabel ?? TYPE_STYLES[ev.type as CalendarEventType].label;
  };

  const formatEventDateRange = (ev: CalendarEventItem): string => {
    const start = parseEventDate(ev);
    const end = ev.endDate ? (typeof ev.endDate === "string" ? parseISO(ev.endDate) : ev.endDate) : null;
    const startStr = format(start, "d. MMM yyyy", { locale: de });
    if (end && format(end, "yyyy-MM-dd") !== format(start, "yyyy-MM-dd")) {
      return `${startStr} – ${format(end, "d. MMM yyyy", { locale: de })}`;
    }
    return startStr;
  };

  return (
    <div className="min-h-screen bg-white font-sans text-foreground pb-8">
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedEvent(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Događaj detalji"
        >
          <div
            className="rounded-2xl bg-white dark:bg-[#1a3826] border border-[#1a3826]/20 dark:border-[#FFC72C]/30 shadow-xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-lg font-black text-[#1a3826] dark:text-[#FFC72C] break-words pr-8">
                {selectedEvent.title}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-lg border border-[#1a3826]/20 dark:border-[#FFC72C]/30 hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 shrink-0"
                aria-label="Schließen"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              {formatEventDateRange(selectedEvent)}
            </p>
            <p className="text-xs font-bold text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-wider">
              {getEventLabel(selectedEvent)}
            </p>
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="mt-4 w-full py-2 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 font-bold text-sm hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {selectedDayForPersonal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => { setSelectedDayForPersonal(null); setPersonalEntryTitle(""); }}
          role="dialog"
          aria-modal="true"
          aria-label="Osobni Eintrag"
        >
          <div
            className="rounded-2xl bg-white dark:bg-[#1a3826] border border-[#1a3826]/20 dark:border-[#FFC72C]/30 shadow-xl max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-[#1a3826] dark:text-[#FFC72C] mb-2">
              Osobni Eintrag – {format(selectedDayForPersonal, "d. MMM yyyy", { locale: de })}
            </h3>
            <input
              type="text"
              value={personalEntryTitle}
              onChange={(e) => setPersonalEntryTitle(e.target.value)}
              placeholder="Titel (nur für Sie sichtbar)"
              className="w-full bg-transparent border border-gray-300 dark:border-[#FFC72C]/30 rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-[#1a3826]/20 dark:focus:ring-[#FFC72C]/20 outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSavePersonalEntry}
                disabled={personalEntrySaving}
                className="flex-1 py-2 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
              >
                {personalEntrySaving ? "…" : "Speichern"}
              </button>
              <button
                type="button"
                onClick={() => { setSelectedDayForPersonal(null); setPersonalEntryTitle(""); }}
                className="py-2 px-4 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 font-bold text-sm"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {categoriesOpen && (
        <CategoriesModal
          categories={categories}
          onClose={() => { setCategoriesOpen(false); setCategoryEditId(null); }}
          onSaved={(list) => { setCategories(list); if (list.length > 0 && !newCategoryId) setNewCategoryId(list[0].id); }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* Left: Calendar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 px-3 py-2 text-sm font-bold text-[#1a3826] dark:text-[#FFC72C] hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 transition-colors shrink-0"
                >
                  <ArrowLeft size={18} /> Zurück zum Dashboard
                </Link>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                  <span className="text-[#1a3826] dark:text-[#FFC72C]">Mein</span>{" "}
                  <span className="text-[#FFC72C] dark:text-[#1a3826]">Kalender</span>
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  disabled={loading}
                  className="p-2 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 disabled:opacity-50"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm font-bold text-foreground min-w-[140px] text-center">
                  {format(monthStart, "MMMM yyyy", { locale: de })}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  disabled={loading}
                  className="p-2 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 disabled:opacity-50"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200/80 dark:border-[#FFC72C]/20 bg-white dark:bg-[#1a3826]/5 shadow-lg overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gray-200/80 dark:border-[#FFC72C]/10">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-xs font-bold text-gray-500 dark:text-[#FFC72C]/80 uppercase"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 auto-rows-fr" style={{ minHeight: "320px" }}>
                {filledGrid.map((day, i) => {
                  if (continuationIndices.has(i)) return null;
                  if (!day) {
                    return (
                      <div
                        key={`empty-${i}`}
                        className="min-h-[80px] border-b border-r border-gray-100 dark:border-[#1a3826]/10"
                      />
                    );
                  }
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const isToday = isSameDay(day, today);
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const colSpan = cellSpanByIndex.get(i) ?? 1;

                  return (
                    <div
                      key={key}
                      className={`min-h-[80px] border-b border-r border-gray-100 dark:border-[#1a3826]/10 p-1.5 transition-all hover:scale-[1.02] hover:shadow-md ${
                        !isCurrentMonth ? "bg-gray-50/50 dark:bg-[#1a3826]/5" : "bg-white dark:bg-background"
                      }`}
                      style={colSpan > 1 ? { gridColumn: `span ${colSpan}` } : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const key = format(day, "yyyy-MM-dd");
                          const existing = dayEvents.find((e) => e.id === `pe-${key}`);
                          setSelectedDayForPersonal(day);
                          setPersonalEntryTitle(existing?.title ?? "");
                        }}
                        className={`text-xs font-bold mb-1 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-[#1a3826]/30 dark:hover:ring-[#FFC72C]/30 ${
                          isToday
                            ? "bg-[#FFBC0D] dark:bg-[#FFC72C] text-[#1a3826] shadow-md"
                            : "text-gray-600 dark:text-muted-foreground"
                        }`}
                      >
                        {format(day, "d")}
                      </button>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev) => {
                          const span = multiDaySpans.get(ev.id);
                          const isContinuation =
                            span &&
                            differenceInDays(span.end, span.start) >= 1 &&
                            format(day, "yyyy-MM-dd") !== format(span.start, "yyyy-MM-dd") &&
                            format(day, "yyyy-MM-dd") <= format(span.end, "yyyy-MM-dd");
                          if (isContinuation) return null;
                          const style = getEventStyle(ev);
                          return (
                            <button
                              key={`${ev.id}-${format(parseEventDate(ev), "yyyy-MM-dd")}`}
                              type="button"
                              onClick={() => setSelectedEvent(ev)}
                              className={`w-full text-left rounded-md px-1.5 py-0.5 text-[10px] font-medium truncate cursor-pointer ${style.bg} ${style.text}`}
                              style={
                                (ev.categoryColor ?? ev.color) && /^#[0-9A-Fa-f]{6}$/.test(ev.categoryColor ?? ev.color ?? "")
                                  ? { backgroundColor: `${(ev.categoryColor ?? ev.color)!}40`, color: ev.categoryColor ?? ev.color ?? undefined }
                                  : undefined
                              }
                            >
                              {ev.title}
                            </button>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-gray-500">+{dayEvents.length - 3}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Glassmorphism card */}
          <div className="w-full lg:w-[340px] shrink-0">
            <div className="rounded-3xl bg-white/80 dark:bg-[#1a3826]/20 backdrop-blur-md shadow-xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 p-5 md:p-6 space-y-6">
              <h2 className="text-lg font-black text-[#1a3826] dark:text-[#FFC72C]">
                Anstehende Termine
              </h2>
              <ul className="space-y-2 max-h-[200px] overflow-y-auto">
                {upcomingEvents.length === 0 ? (
                  <li className="text-sm text-muted-foreground">Keine anstehenden Termine.</li>
                ) : (
                  upcomingEvents.map((ev) => (
                    <li
                      key={`${ev.id}-${format(parseEventDate(ev), "yyyy-MM-dd")}`}
                      className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-gray-100 dark:border-[#1a3826]/20 last:border-0"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(ev)}
                        className="flex-1 min-w-0 text-left cursor-pointer hover:opacity-80"
                      >
                        <span className="font-medium text-foreground">{ev.title}</span>
                        <span className="text-muted-foreground ml-2">
                          {format(parseEventDate(ev), "d. MMM", { locale: de })}
                        </span>
                      </button>
                      {((canWrite && !ev.id.startsWith("vac-")) || ev.id.startsWith("pe-")) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(ev.id, ev)}
                          className="p-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </li>
                  ))
                )}
              </ul>

              {canWrite && (
                <div className="border-t border-[#1a3826]/10 dark:border-[#FFC72C]/10 pt-4">
                  <h3 className="text-sm font-bold text-foreground mb-3">Neuer Eintrag</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Titel"
                      className="w-full bg-transparent border-0 border-b border-gray-300 dark:border-[#FFC72C]/30 py-2 text-sm focus:ring-0 focus:border-[#1a3826] dark:focus:border-[#FFC72C] outline-none"
                    />
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full bg-transparent border-0 border-b border-gray-300 dark:border-[#FFC72C]/30 py-2 text-sm focus:ring-0 focus:border-[#1a3826] dark:focus:border-[#FFC72C] outline-none"
                    />
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Enddatum (optional, z. B. mehrteilige Aktion)</label>
                      <input
                        type="date"
                        value={newEndDate}
                        onChange={(e) => setNewEndDate(e.target.value)}
                        min={newDate}
                        className="w-full bg-transparent border-0 border-b border-gray-300 dark:border-[#FFC72C]/30 py-2 text-sm focus:ring-0 focus:border-[#1a3826] dark:focus:border-[#FFC72C] outline-none"
                      />
                    </div>
                    {categories.length === 0 ? (
                      <p className="text-sm text-amber-600 dark:text-amber-400">Bitte zuerst Kategorien anlegen.</p>
                    ) : (
                      <select
                        value={newCategoryId}
                        onChange={(e) => setNewCategoryId(e.target.value)}
                        className="w-full bg-transparent border-0 border-b border-gray-300 dark:border-[#FFC72C]/30 py-2 text-sm focus:ring-0 focus:border-[#1a3826] dark:focus:border-[#FFC72C] outline-none"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={handleAddEvent}
                      disabled={adding || !newTitle.trim() || !newCategoryId || categories.length === 0}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
                    >
                      <Plus size={16} /> Hinzufügen
                    </button>
                  </div>
                </div>
              )}

              {canWrite && (
                <div className="border-t border-[#1a3826]/10 dark:border-[#FFC72C]/10 pt-4">
                  <button
                    type="button"
                    onClick={() => setCategoriesOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 font-bold text-sm hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10"
                  >
                    <Settings2 size={16} /> Kategorien verwalten
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={exportToICS}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gray-800 dark:bg-gray-700 text-white font-bold shadow-lg hover:bg-[#FFBC0D] hover:text-[#1a3826] dark:hover:bg-[#FFC72C] transition-colors"
              >
                <Smartphone size={20} /> Auf Handy exportieren
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
