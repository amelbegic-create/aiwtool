"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startOfMonth, endOfMonth, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Plus,
  Trash2,
  ArrowLeft,
  X,
  Settings2,
  Pencil,
  Folder,
  FolderOpen,
  Search,
} from "lucide-react";
import {
  MAX_PERSONAL_ENTRIES_PER_DAY,
  dateStringToUtcNoon,
  isManagedCalendarEventId,
  type CalendarEventItem,
  type CalendarEventType,
  type CalendarEventCategoryItem,
} from "@/lib/calendarShared";
import { getCalendarYearBounds } from "@/lib/calendarYearBounds";
import {
  getCalendarEventsForDateRange,
  addCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarDataForExport,
  getCalendarCategories,
  createCalendarCategory,
  updateCalendarCategory,
  deleteCalendarCategory,
  createPersonalEntry,
  updatePersonalEntry,
  deletePersonalEntryById,
  deletePersonalEntry,
} from "@/app/actions/calendarActions";
import { createEvents } from "ics";
import MiniMonthCalendar from "@/components/calendar/MiniMonthCalendar";

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

function formatEventDateRangeDe(ev: CalendarEventItem): string {
  const start = parseEventDate(ev);
  const end = ev.endDate ? (typeof ev.endDate === "string" ? parseISO(ev.endDate) : ev.endDate) : null;
  const startStr = format(start, "d. MMM yyyy", { locale: de });
  if (end && format(end, "yyyy-MM-dd") !== format(start, "yyyy-MM-dd")) {
    return `${startStr} – ${format(end, "d. MMM yyyy", { locale: de })}`;
  }
  return startStr;
}

function mergeEventSpansForEvents(events: CalendarEventItem[]) {
  const byId = new Map<string, { base: CalendarEventItem; start: Date; end: Date }>();
  for (const ev of events) {
    const d = parseEventDate(ev);
    const endD =
      ev.endDate && typeof ev.endDate !== "string"
        ? ev.endDate
        : ev.endDate && typeof ev.endDate === "string"
          ? parseISO(ev.endDate)
          : d;
    const ex = byId.get(ev.id);
    if (!ex) {
      byId.set(ev.id, { base: ev, start: d, end: endD });
    } else {
      if (d < ex.start) ex.start = d;
      if (endD > ex.end) ex.end = endD;
    }
  }
  return byId;
}

function resolveMainEventSpan(ev: CalendarEventItem, allEvents: CalendarEventItem[]): { start: Date; end: Date } {
  if (!isManagedCalendarEventId(ev.id)) {
    const s = parseEventDate(ev);
    const end = ev.endDate
      ? typeof ev.endDate === "string"
        ? parseISO(ev.endDate)
        : ev.endDate
      : s;
    return { start: s, end };
  }
  const byId = mergeEventSpansForEvents(allEvents);
  const item = byId.get(ev.id);
  if (item) return { start: item.start, end: item.end };
  const s = parseEventDate(ev);
  const end = ev.endDate
    ? typeof ev.endDate === "string"
      ? parseISO(ev.endDate)
      : ev.endDate
    : s;
  return { start: s, end };
}

function canEditMainCalendarEvent(ev: CalendarEventItem, canWrite: boolean): boolean {
  if (!canWrite || !isManagedCalendarEventId(ev.id)) return false;
  if (ev.isPersonalEntry || ev.isFromVacationRequest) return false;
  return true;
}

/** Jedinstveni logički događaji koji sijeku zadani mjesec. */
function uniqueEventsOverlappingMonth(
  events: CalendarEventItem[],
  y: number,
  m: number
): CalendarEventItem[] {
  const monthStart = startOfMonth(new Date(y, m - 1));
  const monthEnd = endOfMonth(monthStart);
  const byId = mergeEventSpansForEvents(events);
  return Array.from(byId.values())
    .filter((item) => item.end >= monthStart && item.start <= monthEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((item) => ({ ...item.base, date: item.start, endDate: item.end }));
}

const PERSONAL_COLORS = [
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
                    onClick={() => {
                      setEditId(c.id);
                      setEditName(c.name);
                      setEditColor(c.color ?? "");
                    }}
                    className="p-1 rounded text-[#1a3826] dark:text-[#FFC72C]"
                  >
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => handleDelete(c.id)} className="p-1 rounded text-red-600">
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
  if (s) {
    return { bg: s.bg, text: s.text };
  }
  return { bg: "bg-[#FFBC0D]/20", text: "text-gray-900 dark:text-white" };
}

const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export default function CalendarClient({
  userId,
  initialYear,
  initialMonth,
  initialYearEvents,
  canWrite = false,
}: {
  userId: string;
  initialYear: number;
  initialMonth: number;
  initialYearEvents: CalendarEventItem[];
  canWrite?: boolean;
}) {
  const router = useRouter();
  const now = new Date();
  const yearBounds = getCalendarYearBounds(now);

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [events, setEvents] = useState<CalendarEventItem[]>(initialYearEvents);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(() =>
    format(startOfMonth(new Date(initialYear, initialMonth - 1)), "yyyy-MM-dd")
  );
  const [newEndDate, setNewEndDate] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [adding, setAdding] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [categories, setCategories] = useState<CalendarEventCategoryItem[]>([]);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [selectedDayForPersonal, setSelectedDayForPersonal] = useState<Date | null>(null);
  /** null = neuer Eintrag; sonst DB-ID (ohne pe-) */
  const [personalEditingEntryId, setPersonalEditingEntryId] = useState<string | null>(null);
  const [personalEntryTitle, setPersonalEntryTitle] = useState("");
  const [personalEntrySaving, setPersonalEntrySaving] = useState(false);
  const [personalEntryColor, setPersonalEntryColor] = useState<string>("#FFBC0D");
  const [upcomingSearch, setUpcomingSearch] = useState("");
  const [mainEventEditorOpen, setMainEventEditorOpen] = useState(false);
  const [mainEventEditId, setMainEventEditId] = useState<string | null>(null);
  const [mainEventEditTitle, setMainEventEditTitle] = useState("");
  const [mainEventEditDate, setMainEventEditDate] = useState("");
  const [mainEventEditEndDate, setMainEventEditEndDate] = useState("");
  const [mainEventEditCategoryId, setMainEventEditCategoryId] = useState("");
  const [mainEventEditSaving, setMainEventEditSaving] = useState(false);

  useEffect(() => {
    getCalendarCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !newCategoryId) setNewCategoryId(categories[0].id);
  }, [categories, newCategoryId]);

  useEffect(() => {
    setNewDate(format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd"));
  }, [year, month]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("month", String(month));
    router.replace(`/tools/calendar?${params.toString()}`, { scroll: false });
  }, [year, month, router]);

  const loadYear = useCallback(
    async (y: number) => {
      setLoading(true);
      try {
        const start = new Date(y, 0, 1, 0, 0, 0, 0);
        const end = new Date(y, 11, 31, 23, 59, 59, 999);
        const list = await getCalendarEventsForDateRange(userId, start, end);
        setEvents(list);
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const handlePrevYear = () => {
    if (year <= yearBounds.min) return;
    const y = year - 1;
    setYear(y);
    loadYear(y);
  };

  const handleNextYear = () => {
    if (year >= yearBounds.max) return;
    const y = year + 1;
    setYear(y);
    loadYear(y);
  };

  const handleSelectMonth = (m: number) => {
    setMonth(m);
  };

  const handleMiniPrevMonth = () => {
    if (month <= 1) {
      if (year > yearBounds.min) {
        const y = year - 1;
        setYear(y);
        setMonth(12);
        loadYear(y);
      }
    } else {
      setMonth(month - 1);
    }
  };

  const handleMiniNextMonth = () => {
    if (month >= 12) {
      if (year < yearBounds.max) {
        const y = year + 1;
        setYear(y);
        setMonth(1);
        loadYear(y);
      }
    } else {
      setMonth(month + 1);
    }
  };

  const monthEventsList = useMemo(
    () => uniqueEventsOverlappingMonth(events, year, month),
    [events, year, month]
  );

  const monthCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const m of MONTH_NUMBERS) {
      map.set(m, uniqueEventsOverlappingMonth(events, year, m).length);
    }
    return map;
  }, [events, year]);

  const eventsForMiniMonth = useMemo(() => {
    const s = startOfMonth(new Date(year, month - 1));
    const e = endOfMonth(s);
    return events.filter((ev) => {
      const d = parseEventDate(ev);
      return d >= s && d <= e;
    });
  }, [events, year, month]);

  const handleAddEvent = async () => {
    if (!newTitle.trim() || !newCategoryId) return;
    setAdding(true);
    try {
      const start = dateStringToUtcNoon(newDate);
      const end = newEndDate && newEndDate >= newDate ? dateStringToUtcNoon(newEndDate) : null;
      await addCalendarEvent(userId, {
        title: newTitle.trim(),
        date: start,
        categoryId: newCategoryId,
        endDate: end ?? undefined,
      });
      setNewTitle("");
      setNewEndDate("");
      router.refresh();
      await loadYear(year);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteEvent = async (id: string, ev?: CalendarEventItem) => {
    if (id.startsWith("vac-")) return;
    if (id.startsWith("pe-")) {
      const rest = id.slice(3);
      if (/^\d{4}-\d{2}-\d{2}$/.test(rest)) {
        if (!ev) return;
        await deletePersonalEntry(userId, parseEventDate(ev));
      } else {
        await deletePersonalEntryById(rest, userId);
      }
    } else {
      await deleteCalendarEvent(id, userId);
    }
    router.refresh();
    await loadYear(year);
  };

  const personalListForModal = useMemo(() => {
    if (!selectedDayForPersonal) return [];
    const key = format(selectedDayForPersonal, "yyyy-MM-dd");
    return events.filter(
      (e) => e.isPersonalEntry && format(parseEventDate(e), "yyyy-MM-dd") === key
    );
  }, [events, selectedDayForPersonal]);

  const closePersonalModal = () => {
    setSelectedDayForPersonal(null);
    setPersonalEditingEntryId(null);
    setPersonalEntryTitle("");
    setPersonalEntryColor("#FFBC0D");
  };

  const handleSavePersonalEntry = async () => {
    if (!selectedDayForPersonal) return;
    setPersonalEntrySaving(true);
    try {
      const colorHex =
        personalEntryColor && /^#[0-9A-Fa-f]{6}$/.test(personalEntryColor)
          ? personalEntryColor
          : undefined;
      if (personalEditingEntryId) {
        await updatePersonalEntry(personalEditingEntryId, userId, {
          title: personalEntryTitle.trim() || "Persönlich",
          color: colorHex ?? null,
          date: selectedDayForPersonal,
        });
      } else {
        await createPersonalEntry(
          userId,
          selectedDayForPersonal,
          personalEntryTitle.trim() || "Persönlich",
          colorHex
        );
      }
      setPersonalEditingEntryId(null);
      setPersonalEntryTitle("");
      setPersonalEntryColor("#FFBC0D");
      router.refresh();
      await loadYear(year);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler beim Speichern.");
    } finally {
      setPersonalEntrySaving(false);
    }
  };

  const upcomingEvents = useMemo(() => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const byId = mergeEventSpansForEvents(events);
    const list = Array.from(byId.values())
      .filter((item) => format(item.end, "yyyy-MM-dd") >= todayKey)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((item) => ({
        ...item.base,
        date: item.start,
        endDate: item.end,
      }));

    const q = upcomingSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((ev) => {
      const title = (ev.title || "").toLowerCase();
      const range = formatEventDateRangeDe(ev).toLowerCase();
      return title.includes(q) || range.includes(q);
    });
  }, [events, upcomingSearch]);

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
        duration:
          end && !endSameDay
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
          start: [current.getFullYear(), current.getMonth() + 1, current.getDate(), 0, 0],
          duration: { hours: 24 },
        });
        current.setDate(current.getDate() + 1);
      }
    }

    if (icsEvents.length === 0) {
      icsEvents.push({
        title: "AIW Kalender",
        start: [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate(), 0, 0],
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

  const getEventLabel = (ev: CalendarEventItem): string => {
    if (ev.isPersonalEntry) return "Osobni Eintrag";
    if (ev.categoryLabel) return ev.categoryLabel;
    const style = TYPE_STYLES[ev.type as CalendarEventType];
    if (style) return style.label;
    return "Termin";
  };

  const formatEventDateRange = (ev: CalendarEventItem): string => formatEventDateRangeDe(ev);

  const openPersonalForDay = (day: Date) => {
    setSelectedDayForPersonal(day);
    setPersonalEditingEntryId(null);
    setPersonalEntryTitle("");
    setPersonalEntryColor("#FFBC0D");
  };

  const isLegacyPersonalEventId = (id: string) => /^pe-\d{4}-\d{2}-\d{2}$/.test(id);

  const openMainEventEdit = (ev: CalendarEventItem) => {
    if (!canEditMainCalendarEvent(ev, canWrite)) return;
    const { start, end } = resolveMainEventSpan(ev, events);
    setMainEventEditId(ev.id);
    setMainEventEditTitle(ev.title || "");
    setMainEventEditDate(format(start, "yyyy-MM-dd"));
    setMainEventEditEndDate(
      format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd") ? "" : format(end, "yyyy-MM-dd")
    );
    setMainEventEditCategoryId(ev.categoryId || newCategoryId || categories[0]?.id || "");
    setMainEventEditorOpen(true);
  };

  const closeMainEventEditor = () => {
    setMainEventEditorOpen(false);
    setMainEventEditId(null);
    setMainEventEditTitle("");
    setMainEventEditDate("");
    setMainEventEditEndDate("");
    setMainEventEditCategoryId("");
  };

  const handleSaveMainEventEdit = async () => {
    if (!mainEventEditId || !mainEventEditTitle.trim() || !mainEventEditCategoryId) return;
    setMainEventEditSaving(true);
    try {
      const start = dateStringToUtcNoon(mainEventEditDate);
      const end =
        mainEventEditEndDate && mainEventEditEndDate >= mainEventEditDate
          ? dateStringToUtcNoon(mainEventEditEndDate)
          : null;
      await updateCalendarEvent(mainEventEditId, userId, {
        title: mainEventEditTitle.trim(),
        date: start,
        categoryId: mainEventEditCategoryId,
        endDate: end,
      });
      closeMainEventEditor();
      router.refresh();
      await loadYear(year);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler beim Speichern.");
    } finally {
      setMainEventEditSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-foreground pb-8">
      {mainEventEditorOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={closeMainEventEditor}
          role="dialog"
          aria-modal="true"
          aria-label="Termin bearbeiten"
        >
          <div
            className="rounded-2xl bg-white dark:bg-[#1a3826] border border-[#1a3826]/20 dark:border-[#FFC72C]/30 shadow-xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="text-lg font-black text-[#1a3826] dark:text-[#FFC72C]">Termin bearbeiten</h3>
              <button
                type="button"
                onClick={closeMainEventEditor}
                className="p-1.5 rounded-lg border shrink-0"
                aria-label="Schließen"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={mainEventEditTitle}
                onChange={(e) => setMainEventEditTitle(e.target.value)}
                placeholder="Titel"
                className="w-full border border-gray-300 dark:border-[#FFC72C]/30 rounded-lg px-3 py-2 text-sm"
              />
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Startdatum</label>
                <input
                  type="date"
                  value={mainEventEditDate}
                  onChange={(e) => setMainEventEditDate(e.target.value)}
                  className="w-full border border-gray-300 dark:border-[#FFC72C]/30 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">
                  Enddatum (optional)
                </label>
                <input
                  type="date"
                  value={mainEventEditEndDate}
                  onChange={(e) => setMainEventEditEndDate(e.target.value)}
                  min={mainEventEditDate}
                  className="w-full border border-gray-300 dark:border-[#FFC72C]/30 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {categories.length === 0 ? (
                <p className="text-sm text-amber-600">Bitte zuerst Kategorien anlegen.</p>
              ) : (
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Kategorie</label>
                  <select
                    value={mainEventEditCategoryId}
                    onChange={(e) => setMainEventEditCategoryId(e.target.value)}
                    className="w-full border border-gray-300 dark:border-[#FFC72C]/30 rounded-lg px-3 py-2 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={closeMainEventEditor}
                className="flex-1 min-w-[6rem] py-2 rounded-xl border font-bold text-sm"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={
                  mainEventEditSaving ||
                  !mainEventEditTitle.trim() ||
                  !mainEventEditCategoryId ||
                  categories.length === 0
                }
                onClick={handleSaveMainEventEdit}
                className="flex-1 min-w-[6rem] py-2 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-bold disabled:opacity-50"
              >
                {mainEventEditSaving ? "…" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
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
            <p className="text-sm text-muted-foreground mb-1">{formatEventDateRange(selectedEvent)}</p>
            <p className="text-xs font-bold text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-wider">
              {getEventLabel(selectedEvent)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="flex-1 min-w-[6rem] py-2 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 font-bold text-sm hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10"
              >
                Schließen
              </button>
              {selectedEvent.isPersonalEntry &&
                !isLegacyPersonalEventId(selectedEvent.id) &&
                selectedEvent.id.startsWith("pe-") && (
                  <button
                    type="button"
                    onClick={() => {
                      const dbId = selectedEvent.id.slice(3);
                      setSelectedDayForPersonal(parseEventDate(selectedEvent));
                      setPersonalEditingEntryId(dbId);
                      setPersonalEntryTitle(selectedEvent.title || "");
                      setPersonalEntryColor(
                        (selectedEvent.color && /^#[0-9A-Fa-f]{6}$/.test(selectedEvent.color)
                          ? selectedEvent.color
                          : "#FFBC0D") as string
                      );
                      setSelectedEvent(null);
                    }}
                    className="py-2 px-3 rounded-xl border border-[#1a3826]/40 dark:border-[#FFC72C]/50 font-bold text-sm hover:bg-[#1a3826]/10"
                  >
                    Bearbeiten
                  </button>
                )}
              {canEditMainCalendarEvent(selectedEvent, canWrite) && (
                <button
                  type="button"
                  onClick={() => {
                    openMainEventEdit(selectedEvent);
                    setSelectedEvent(null);
                  }}
                  className="py-2 px-3 rounded-xl border border-[#1a3826]/40 dark:border-[#FFC72C]/50 font-bold text-sm hover:bg-[#1a3826]/10"
                >
                  Bearbeiten
                </button>
              )}
              {((canWrite && !selectedEvent.id.startsWith("vac-")) || selectedEvent.id.startsWith("pe-")) && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleDeleteEvent(selectedEvent.id, selectedEvent);
                    setSelectedEvent(null);
                  }}
                  className="py-2 px-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700"
                >
                  Löschen
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedDayForPersonal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closePersonalModal}
          role="dialog"
          aria-modal="true"
          aria-label="Persönliche Einträge"
        >
          <div
            className="rounded-2xl bg-white dark:bg-[#1a3826] border border-[#1a3826]/20 dark:border-[#FFC72C]/30 shadow-xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="text-lg font-black text-[#1a3826] dark:text-[#FFC72C]">
                Persönlich – {format(selectedDayForPersonal, "d. MMMM yyyy", { locale: de })}
              </h3>
              <button
                type="button"
                onClick={closePersonalModal}
                className="p-1.5 rounded-lg border border-[#1a3826]/20 shrink-0"
                aria-label="Schließen"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Bis zu {MAX_PERSONAL_ENTRIES_PER_DAY} Einträge pro Tag.
            </p>
            <label className="text-xs font-bold block mb-1">Datum</label>
            <input
              type="date"
              value={format(selectedDayForPersonal, "yyyy-MM-dd")}
              onChange={(e) => {
                const v = e.target.value;
                if (v) setSelectedDayForPersonal(parseISO(v));
              }}
              className="w-full bg-transparent border border-gray-300 dark:border-[#FFC72C]/30 rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-[#1a3826]/20 outline-none"
            />
            {personalListForModal.length > 0 && (
              <ul className="space-y-2 mb-4 border-b border-border pb-4">
                {personalListForModal.map((ev) => {
                  const legacy = isLegacyPersonalEventId(ev.id);
                  const dbId = legacy ? null : ev.id.slice(3);
                  return (
                    <li
                      key={ev.id}
                      className="flex items-center gap-2 rounded-lg border border-gray-100 dark:border-[#FFC72C]/20 p-2"
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border"
                        style={{
                          backgroundColor:
                            ev.color && /^#[0-9A-Fa-f]{6}$/.test(ev.color) ? ev.color : "#FFBC0D",
                        }}
                      />
                      <span className="flex-1 min-w-0 text-sm font-medium truncate">{ev.title}</span>
                      {!legacy && dbId && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setPersonalEditingEntryId(dbId);
                              setPersonalEntryTitle(ev.title || "");
                              setPersonalEntryColor(
                                (ev.color && /^#[0-9A-Fa-f]{6}$/.test(ev.color) ? ev.color : "#FFBC0D") as string
                              );
                            }}
                            className="p-1.5 text-[#1a3826] dark:text-[#FFC72C]"
                            aria-label="Bearbeiten"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("Diesen Eintrag löschen?")) return;
                              await deletePersonalEntryById(dbId, userId);
                              router.refresh();
                              await loadYear(year);
                            }}
                            className="p-1.5 text-red-600"
                            aria-label="Löschen"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <h4 className="text-sm font-bold mb-2">
              {personalEditingEntryId ? "Eintrag bearbeiten" : "Neuer Eintrag"}
            </h4>
            <input
              type="text"
              value={personalEntryTitle}
              onChange={(e) => setPersonalEntryTitle(e.target.value)}
              placeholder="Titel (nur für Sie sichtbar)"
              className="w-full bg-transparent border border-gray-300 dark:border-[#FFC72C]/30 rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-[#1a3826]/20 outline-none"
            />
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1">Farbe</p>
              <div className="flex flex-wrap gap-1.5">
                {PERSONAL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPersonalEntryColor(c)}
                    className={`w-6 h-6 rounded-full border transition-transform ${
                      personalEntryColor === c
                        ? "ring-2 ring-[#1a3826] border-white"
                        : "border-gray-300 hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label="Farbe wählen"
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSavePersonalEntry}
                disabled={
                  personalEntrySaving ||
                  (!personalEditingEntryId && personalListForModal.length >= MAX_PERSONAL_ENTRIES_PER_DAY)
                }
                className="flex-1 min-w-[8rem] py-2 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
              >
                {personalEntrySaving ? "…" : "Speichern"}
              </button>
              {personalEditingEntryId && (
                <button
                  type="button"
                  onClick={() => {
                    setPersonalEditingEntryId(null);
                    setPersonalEntryTitle("");
                    setPersonalEntryColor("#FFBC0D");
                  }}
                  className="py-2 px-3 rounded-xl border text-sm font-bold"
                >
                  Neu statt Bearbeiten
                </button>
              )}
              <button type="button" onClick={closePersonalModal} className="py-2 px-4 rounded-xl border text-sm font-bold">
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}

      {categoriesOpen && (
        <CategoriesModal
          categories={categories}
          onClose={() => setCategoriesOpen(false)}
          onSaved={(list) => {
            setCategories(list);
            if (list.length > 0 && !newCategoryId) setNewCategoryId(list[0].id);
          }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <div className="flex-1 min-w-0 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap">
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
                  onClick={handlePrevYear}
                  disabled={loading || year <= yearBounds.min}
                  className="p-2 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 disabled:opacity-40"
                  aria-label="Vorheriges Jahr"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-base font-black text-foreground min-w-[4rem] text-center">{year}</span>
                <button
                  type="button"
                  onClick={handleNextYear}
                  disabled={loading || year >= yearBounds.max}
                  className="p-2 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 disabled:opacity-40"
                  aria-label="Nächstes Jahr"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-3">Monate</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {MONTH_NUMBERS.map((m) => {
                  const count = monthCounts.get(m) ?? 0;
                  const isActive = month === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectMonth(m)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition-all ${
                        isActive
                          ? "border-[#1a3826] dark:border-[#FFC72C] bg-[#1a3826]/10 dark:bg-[#FFC72C]/15 ring-2 ring-[#1a3826]/30 dark:ring-[#FFC72C]/30"
                          : "border-gray-200 dark:border-[#FFC72C]/20 hover:bg-gray-50 dark:hover:bg-[#1a3826]/10"
                      }`}
                    >
                      {isActive ? (
                        <FolderOpen className="shrink-0 text-[#1a3826] dark:text-[#FFC72C]" size={20} />
                      ) : (
                        <Folder className="shrink-0 text-muted-foreground" size={20} />
                      )}
                      <span className="flex-1 min-w-0 font-bold text-sm truncate">
                        {format(new Date(year, m - 1, 1), "MMMM", { locale: de })}
                      </span>
                      <span
                        className={`text-xs font-black tabular-nums px-2 py-0.5 rounded-full shrink-0 ${
                          count > 0
                            ? "bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826]"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200/80 dark:border-[#FFC72C]/20 bg-white dark:bg-[#1a3826]/5 shadow-lg p-4 md:p-6">
              <h2 className="text-lg font-black text-[#1a3826] dark:text-[#FFC72C] mb-4">
                {format(new Date(year, month - 1, 1), "MMMM yyyy", { locale: de })}
              </h2>
              {monthEventsList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Termine in diesem Monat.</p>
              ) : (
                <ul className="space-y-2 max-h-[min(60vh,480px)] overflow-y-auto pr-1">
                  {monthEventsList.map((ev) => {
                    const style = getEventStyle(ev);
                    return (
                      <li
                        key={`${ev.id}-${format(parseEventDate(ev), "yyyy-MM-dd")}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 dark:border-[#1a3826]/20 p-3"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(ev)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <span className="font-bold text-foreground block truncate">{ev.title}</span>
                          <span className="text-xs text-muted-foreground">{formatEventDateRange(ev)}</span>
                          <span
                            className={`text-[10px] font-bold uppercase mt-1 inline-block rounded px-1.5 py-0.5 ${style.bg} ${style.text}`}
                            style={
                              (ev.categoryColor ?? ev.color) &&
                              /^#[0-9A-Fa-f]{6}$/.test(ev.categoryColor ?? ev.color ?? "")
                                ? {
                                    backgroundColor: `${(ev.categoryColor ?? ev.color)!}35`,
                                    color: ev.categoryColor ?? ev.color ?? undefined,
                                  }
                                : undefined
                            }
                          >
                            {getEventLabel(ev)}
                          </span>
                        </button>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {canEditMainCalendarEvent(ev, canWrite) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openMainEventEdit(ev);
                              }}
                              className="p-2 rounded-lg text-[#1a3826] dark:text-[#FFC72C] hover:bg-[#1a3826]/10 dark:hover:bg-[#FFC72C]/10"
                              aria-label="Bearbeiten"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {((canWrite && !ev.id.startsWith("vac-")) || ev.id.startsWith("pe-")) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEvent(ev.id, ev);
                              }}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              aria-label="Löschen"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="w-full lg:w-[340px] shrink-0 space-y-6">
            <div className="rounded-3xl bg-white/80 dark:bg-[#1a3826]/20 backdrop-blur-md shadow-xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 p-5 md:p-6">
              <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                Übersicht
              </h2>
              <MiniMonthCalendar
                year={year}
                month={month}
                events={eventsForMiniMonth}
                onDayClick={
                  canWrite
                    ? (day) => openPersonalForDay(day)
                    : undefined
                }
                onPrevMonth={handleMiniPrevMonth}
                onNextMonth={handleMiniNextMonth}
                loading={loading}
                showNavigation
                variant="sidebar"
                className="rounded-xl border border-gray-100 dark:border-[#1a3826]/20 overflow-hidden"
              />
              {!canWrite && (
                <p className="text-[10px] text-muted-foreground mt-2">Nur Ansicht – persönliche Einträge mit Schreibberechtigung.</p>
              )}
            </div>

            <div className="rounded-3xl bg-white/80 dark:bg-[#1a3826]/20 backdrop-blur-md shadow-xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 p-5 md:p-6 space-y-4">
              <h2 className="text-lg font-black text-[#1a3826] dark:text-[#FFC72C]">Anstehende Termine</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="search"
                  value={upcomingSearch}
                  onChange={(e) => setUpcomingSearch(e.target.value)}
                  placeholder="Suchen…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-[#FFC72C]/20 text-sm bg-white/90 dark:bg-[#1a3826]/40"
                />
              </div>
              <ul className="space-y-2 max-h-[min(50vh,360px)] overflow-y-auto pr-1">
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
                        <span className="font-medium text-foreground block truncate">{ev.title}</span>
                        <span className="text-muted-foreground text-xs">
                          {formatEventDateRange(ev)}
                        </span>
                      </button>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {canEditMainCalendarEvent(ev, canWrite) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openMainEventEdit(ev);
                            }}
                            className="p-1 rounded text-[#1a3826] dark:text-[#FFC72C] hover:bg-[#1a3826]/10 dark:hover:bg-[#FFC72C]/10"
                            aria-label="Bearbeiten"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {((canWrite && !ev.id.startsWith("vac-")) || ev.id.startsWith("pe-")) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEvent(ev.id, ev);
                            }}
                            className="p-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="rounded-3xl bg-white/80 dark:bg-[#1a3826]/20 backdrop-blur-md shadow-xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 p-5 md:p-6 space-y-6">
              {canWrite && (
                <div>
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
                      <label className="text-xs text-muted-foreground block mb-1">
                        Enddatum (optional, z. B. mehrteilige Aktion)
                      </label>
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
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
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
