"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
} from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X, Smartphone } from "lucide-react";
import {
  getCalendarEvents,
  getCalendarDataForExport,
  upsertPersonalEntry,
  deletePersonalEntry,
  deleteCalendarEvent,
  type CalendarEventItem,
  type CalendarEventType,
} from "@/app/actions/calendarActions";
import { createEvents } from "ics";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const TYPE_COLORS: Record<CalendarEventType, string> = {
  personal: "#FFBC0D",
  shift: "#DA291C",
  vacation: "#1a3826",
};

const TYPE_LABELS: Record<CalendarEventType, string> = {
  personal: "Persönlich",
  shift: "Smjene",
  vacation: "Urlaub",
};

function getEventColor(ev: CalendarEventItem): string {
  if (ev.categoryColor && /^#[0-9A-Fa-f]{6}$/.test(ev.categoryColor)) return ev.categoryColor;
  if (ev.color && /^#[0-9A-Fa-f]{6}$/.test(ev.color)) return ev.color;
  return TYPE_COLORS[ev.type as CalendarEventType];
}

function getEventLabel(ev: CalendarEventItem): string {
  if (ev.isPersonalEntry) return "Osobni Eintrag";
  if (ev.categoryLabel) return ev.categoryLabel;
  return TYPE_LABELS[ev.type as CalendarEventType];
}

function parseEventDate(e: CalendarEventItem): Date {
  return typeof e.date === "string" ? parseISO(e.date) : e.date;
}

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  initialDate: Date;
  canWrite?: boolean;
};

export default function CalendarFullViewModal({ open, onClose, userId, initialDate, canWrite = false }: Props) {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [selectedDayForPopup, setSelectedDayForPopup] = useState<Date | null>(null);
  const [personalModalOpen, setPersonalModalOpen] = useState(false);
  const [personalDate, setPersonalDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [personalTitle, setPersonalTitle] = useState("");
  const [personalColor, setPersonalColor] = useState("#FFBC0D");
  const [personalSaving, setPersonalSaving] = useState(false);

  const PERSONAL_PRESET_COLORS = [
    "#FFBC0D",
    "#DA291C",
    "#1a3826",
    "#4169E1",
    "#9333ea",
    "#0d9488",
    "#ea580c",
  ];

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startWeekday = (getDay(monthStart) + 6) % 7;
  const monthPadding = Array(startWeekday).fill(null);
  const monthGridDays = [...monthPadding, ...monthDays];
  const monthTotalCells = Math.ceil(monthGridDays.length / 7) * 7;
  const monthFilledGrid = [...monthGridDays, ...Array(monthTotalCells - monthGridDays.length).fill(null)];

  const loadEvents = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const list = await getCalendarEvents(userId, currentDate.getFullYear(), currentDate.getMonth() + 1);
      setEvents(list);
    } finally {
      setLoading(false);
    }
  }, [open, userId, currentDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

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

  const goPrev = () => setCurrentDate((d) => subMonths(d, 1));
  const goNext = () => setCurrentDate((d) => addMonths(d, 1));
  const goToday = () => setCurrentDate(new Date());

  const formatEventDateRange = (ev: CalendarEventItem): string => {
    const start = parseEventDate(ev);
    const end = ev.endDate ? (typeof ev.endDate === "string" ? parseISO(ev.endDate) : ev.endDate) : null;
    const startStr = format(start, "d. MMM yyyy", { locale: de });
    if (end && format(end, "yyyy-MM-dd") !== format(start, "yyyy-MM-dd")) {
      return `${startStr} – ${format(end, "d. MMM yyyy", { locale: de })}`;
    }
    return startStr;
  };

  const handleExport = async () => {
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

  const handleSavePersonalEntry = async () => {
    setPersonalSaving(true);
    try {
      const d = parseISO(personalDate);
      await upsertPersonalEntry(
        userId,
        d,
        personalTitle.trim() || "Osobno",
        personalColor && /^#[0-9A-Fa-f]{6}$/.test(personalColor) ? personalColor : undefined
      );
      setPersonalModalOpen(false);
      setPersonalTitle("");
      loadEvents();
    } finally {
      setPersonalSaving(false);
    }
  };

  const headerTitle = format(monthStart, "MMMM yyyy", { locale: de });

  const handleDeleteEvent = async (ev: CalendarEventItem) => {
    // vacation iz VacationRequest i virtualni eventi se ne brišu ovdje
    if (ev.id.startsWith("vac-")) return;
    if (ev.id.startsWith("pe-")) {
      const d = parseEventDate(ev);
      await deletePersonalEntry(userId, d);
    } else if (canWrite) {
      await deleteCalendarEvent(ev.id, userId);
    } else {
      return;
    }
    setSelectedEvent(null);
    await loadEvents();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Kalender Übersicht"
    >
      <div
        className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[#1a3826]/20 dark:border-[#FFC72C]/30"
        onClick={(e) => e.stopPropagation()}
      >
        {selectedDayForPopup && (
          <div
            className="absolute inset-0 z-10 flex items-start justify-center pt-24 bg-black/40 px-4 pb-4 rounded-3xl"
            onClick={() => setSelectedDayForPopup(null)}
          >
            <div
              className="max-w-md w-full rounded-2xl bg-white dark:bg-[#1a3826] border border-[#1a3826]/20 dark:border-[#FFC72C]/30 shadow-xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-black text-[#1a3826] dark:text-[#FFC72C]">
                  {format(selectedDayForPopup, "d. MMMM yyyy", { locale: de })}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedDayForPopup(null)}
                  className="p-1.5 rounded-lg border border-[#1a3826]/20 dark:border-[#FFC72C]/30 hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10"
                  aria-label="Schließen"
                >
                  <X size={16} />
                </button>
              </div>
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {(() => {
                  const key = format(selectedDayForPopup, "yyyy-MM-dd");
                  const list = eventsByDay.get(key) ?? [];
                  if (list.length === 0) {
                    return (
                      <li className="text-sm text-muted-foreground">
                        Keine Einträge für diesen Tag.
                      </li>
                    );
                  }
                  return list.map((ev) => (
                    <li key={`${ev.id}-${key}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEvent(ev);
                          setSelectedDayForPopup(null);
                        }}
                        className="w-full text-left px-2 py-1 rounded-lg text-sm hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 flex items-center justify-between gap-2"
                      >
                        <span className="font-medium truncate">{ev.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {getEventLabel(ev)}
                        </span>
                      </button>
                    </li>
                  ));
                })()}
              </ul>
            </div>
          </div>
        )}
        {selectedEvent && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4 rounded-3xl"
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
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="flex-1 py-2 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 font-bold text-sm hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10"
                >
                  Schließen
                </button>
                {((canWrite && !selectedEvent.id.startsWith("vac-")) || selectedEvent.id.startsWith("pe-")) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(selectedEvent)}
                    className="py-2 px-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700"
                  >
                    Löschen
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-200 dark:border-[#1a3826]/30">
          <h2 className="text-lg font-black text-[#1a3826] dark:text-[#FFC72C]">Mein Kalender</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goPrev}
                disabled={loading}
                className="p-2 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 disabled:opacity-50"
                aria-label="Zurück"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="px-3 py-2 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 text-sm font-bold"
              >
                Heute
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={loading}
                className="p-2 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10 disabled:opacity-50"
                aria-label="Weiter"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <span className="text-sm font-bold text-foreground min-w-[180px] text-center capitalize">
              {headerTitle}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 hover:bg-[#1a3826]/5"
              aria-label="Schließen"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content – Monatsansicht */}
        <div className="p-4 overflow-auto flex-1 min-h-0">
          <div className="rounded-2xl border border-gray-200 dark:border-[#FFC72C]/20 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-[#FFC72C]/10">
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
                {monthFilledGrid.map((day, i) => {
                  if (!day) {
                    return (
                      <div
                        key={`empty-${i}`}
                        className="min-h-[60px] border-b border-r border-gray-100 dark:border-[#1a3826]/10"
                      />
                    );
                  }
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const isToday = isSameDay(day, new Date());
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  return (
                    <div
                      key={key}
                      className={`min-h-[60px] border-b border-r border-gray-100 dark:border-[#1a3826]/10 p-1.5 ${
                        !isCurrentMonth ? "bg-gray-50/50 dark:bg-[#1a3826]/5" : ""
                      }`}
                      onClick={() => setSelectedDayForPopup(day)}
                    >
                      <div
                        className={`text-xs font-bold mb-1 ${
                          isToday
                            ? "w-7 h-7 rounded-full bg-[#FFBC0D] text-[#1a3826] flex items-center justify-center"
                            : "text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 4).map((ev) => (
                          <button
                            key={`${ev.id}-${key}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(ev);
                            }}
                            className="w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate text-white cursor-pointer"
                            style={{ backgroundColor: `${getEventColor(ev)}CC` }}
                          >
                            {ev.title}
                          </button>
                        ))}
                        {dayEvents.length > 4 && (
                          <div className="text-[10px] text-gray-500">+{dayEvents.length - 4}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-[#FFC72C]/20 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPersonalModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 bg-white dark:bg-[#1a3826]/20 text-[#1a3826] dark:text-[#FFC72C] px-4 py-2.5 font-bold text-sm hover:bg-[#1a3826]/5 dark:hover:bg-[#FFC72C]/10"
          >
            Datum für mich markieren
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-700 dark:bg-gray-600 text-white px-4 py-2.5 font-bold text-sm hover:opacity-90"
          >
            <Smartphone size={18} /> Auf Handy exportieren
          </button>
          {canWrite && (
            <Link
              href="/tools/calendar"
              className="inline-flex items-center gap-2 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] px-4 py-2.5 font-bold text-sm hover:opacity-90"
            >
              Vollständigen Kalender öffnen
            </Link>
          )}
        </div>

        {personalModalOpen && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4 rounded-3xl"
            onClick={() => setPersonalModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Osobni Eintrag"
          >
            <div
              className="rounded-2xl bg-white dark:bg-[#1a3826] border border-[#1a3826]/20 dark:border-[#FFC72C]/30 shadow-xl max-w-sm w-full p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-black text-[#1a3826] dark:text-[#FFC72C] mb-3">
                Datum für mich markieren
              </h3>
              <input
                type="date"
                value={personalDate}
                onChange={(e) => setPersonalDate(e.target.value)}
                className="w-full bg-transparent border border-gray-300 dark:border-[#FFC72C]/30 rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-[#1a3826]/20 dark:focus:ring-[#FFC72C]/20 outline-none"
              />
              <input
                type="text"
                value={personalTitle}
                onChange={(e) => setPersonalTitle(e.target.value)}
                placeholder="Titel (nur für Sie sichtbar)"
                className="w-full bg-transparent border border-gray-300 dark:border-[#FFC72C]/30 rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-[#1a3826]/20 dark:focus:ring-[#FFC72C]/20 outline-none"
              />
              <div className="mb-4">
                <label className="text-xs text-muted-foreground block mb-1.5">
                  Farbe (optional)
                </label>
                <div className="flex flex-wrap gap-2 items-center">
                  {PERSONAL_PRESET_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setPersonalColor(hex)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        personalColor === hex
                          ? "border-[#1a3826] dark:border-[#FFC72C] scale-110"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(personalColor) ? personalColor : "#FFBC0D"}
                    onChange={(e) => setPersonalColor(e.target.value)}
                    className="w-8 h-8 rounded-full border-0 cursor-pointer p-0 overflow-hidden"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSavePersonalEntry}
                  disabled={personalSaving}
                  className="flex-1 py-2 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {personalSaving ? "…" : "Speichern"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPersonalModalOpen(false);
                    setPersonalTitle("");
                    setPersonalColor("#FFBC0D");
                  }}
                  className="py-2 px-4 rounded-xl border border-[#1a3826]/20 dark:border-[#FFC72C]/30 font-bold text-sm"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
