"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Settings,
  Save,
  FileDown,
  CalendarDays,
  Plus,
  Trash2,
  Calendar,
  Clock,
  X,
  Loader2,
  GripVertical,
  Edit2,
} from "lucide-react";

// --- TIPOVI ---
interface Restaurant {
  id: string;
  code: string;
  name: string | null;
}

interface Station {
  key: string;
  label: string;
  group: string;
  isCustom?: boolean;
}

interface HourData {
  rev: string;
  [key: string]: string;
}

// Njemački nazivi stanica
const DEFAULT_STATIONS: Station[] = [
  { key: "ausgabe", label: "Ausgabe", group: "Service" },
  { key: "kueche", label: "Küche", group: "Kuhinja" },
  { key: "lobby", label: "Lobby", group: "Lobby" },
  { key: "mccafe", label: "McCafé", group: "McCafé" },
  { key: "drive", label: "Drive", group: "Service" },
  { key: "getraenke", label: "Getränke", group: "Service" },
  { key: "kasse", label: "Kasse", group: "Service" },
  { key: "tableservice", label: "T.Serv.", group: "Service" },
  { key: "pommes", label: "Pommes", group: "Service" },
  { key: "sf", label: "SF Prod.", group: "Ostalo" },
  { key: "pause", label: "Pause (-)", group: "Ostalo" },
];

const DAYS = [
  { key: "monday", label: "Montag" },
  { key: "tuesday", label: "Dienstag" },
  { key: "wednesday", label: "Mittwoch" },
  { key: "thursday", label: "Donnerstag" },
  { key: "friday", label: "Freitag" },
  { key: "saturday", label: "Samstag" },
  { key: "sunday", label: "Sonntag" },
  { key: "special_1", label: "Besonderer Tag 1" },
  { key: "special_2", label: "Besonderer Tag 2" },
  { key: "special_3", label: "Besonderer Tag 3" },
];

const parseNum = (val: string | undefined): number => {
  if (!val) return 0;
  const clean = val.replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const formatHourRange = (h: number) => {
  const next = (h + 1) % 24;
  return `${String(h).padStart(2, "0")}-${String(next).padStart(2, "0")} h`;
};

const fmtNum = (n: number, decimals = 0) =>
  new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n ?? 0);

const fmtInt = (n: number) => fmtNum(Math.round(n || 0));

const COLORS = {
  green: "#1b3a26",
  yellow: "#ffc72c",
  greenLight: "#142e1e",
};

function DraggableColumnHeader({
  s,
  isPause,
}: {
  s: Station;
  isPause: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: s.key });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: s.key });
  const ref = (node: HTMLTableCellElement | null) => {
    setNodeRef(node);
    setDropRef(node);
  };
  return (
    <th
      ref={ref}
      className={`py-2 px-1 min-w-[4.5rem] w-20 text-center border-r border-white/20 font-semibold text-[10px] uppercase text-white whitespace-nowrap ${
        isPause ? "bg-red-900/50 text-red-100" : ""
      } ${isDragging ? "opacity-50" : ""} ${isOver ? "ring-1 ring-inset ring-white/40" : ""}`}
      style={!isPause ? { backgroundColor: COLORS.green } : undefined}
    >
      <span className="flex items-center justify-center gap-0.5">
        <span
          className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-white/70 hover:text-white shrink-0"
          {...listeners}
          {...attributes}
        >
          <GripVertical size={10} />
        </span>
        <span>{s.label}</span>
      </span>
    </th>
  );
}

function ProductivityToolContent({
  defaultRestaurantId,
}: {
  defaultRestaurantId?: string | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlId = searchParams.get("restaurantId");

  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [activeRestId, setActiveRestId] = useState<string | null>(urlId || defaultRestaurantId || null);

  const [selectedDate, setSelectedDate] = useState("");

  const [rows, setRows] = useState<Record<number, HourData>>({});
  const [netCoeff, setNetCoeff] = useState("1,17");
  const [hoursFrom, setHoursFrom] = useState(6);
  const [hoursTo, setHoursTo] = useState(1);
  const [customDayNames, setCustomDayNames] = useState<Record<string, string>>({});
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [customStations, setCustomStations] = useState<Station[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const hoursWhenModalOpenedRef = useRef({ from: 6, to: 1 });

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const [templateEditMode, setTemplateEditMode] = useState(false);
  const [templateEditKey, setTemplateEditKey] = useState("monday");
  const [templateSelectInModal, setTemplateSelectInModal] = useState("monday");
  const [newColName, setNewColName] = useState("");
  const calendarDropdownRef = useRef<HTMLDivElement>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);

  const handleTableKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName !== "INPUT") return;
    e.preventDefault();
    const inputs = tableWrapperRef.current?.querySelectorAll<HTMLInputElement>("input");
    if (!inputs?.length) return;
    const list = Array.from(inputs);
    const idx = list.indexOf(target as HTMLInputElement);
    const nextIdx = idx < 0 ? 0 : (idx + 1) % list.length;
    list[nextIdx]?.focus();
  }, []);

  useEffect(() => {
    if (!showCalendarDropdown) return;
    const close = (e: MouseEvent) => {
      if (calendarDropdownRef.current && !calendarDropdownRef.current.contains(e.target as Node)) {
        setShowCalendarDropdown(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showCalendarDropdown]);

  useEffect(() => {
    setIsMounted(true);
    setSelectedDate(new Date().toISOString().split("T")[0]);
    fetch("/api/restaurants")
      .then((res) => res.json())
      .then((data) => {
        setRestaurants(data);
        if (!urlId && !activeRestId && data.length > 0) {
          const preferred =
            defaultRestaurantId && data.some((r: Restaurant) => r.id === defaultRestaurantId)
              ? defaultRestaurantId
              : data[0].id;
          setActiveRestId(preferred);
          const params = new URLSearchParams(searchParams.toString());
          params.set("restaurantId", preferred);
          router.replace(`?${params.toString()}`);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (urlId) setActiveRestId(urlId);
  }, [urlId]);

  useEffect(() => {
    if (defaultRestaurantId && defaultRestaurantId !== activeRestId) {
      setActiveRestId(defaultRestaurantId);
    }
  }, [defaultRestaurantId]);


  const allStations = useMemo(
    () => [...DEFAULT_STATIONS, ...customStations],
    [customStations]
  );
  const activeColumns = useMemo(
    () => allStations.filter((s) => !hiddenColumns.includes(s.key)),
    [hiddenColumns, allStations]
  );

  const orderedColumns = useMemo(() => {
    const hasKey = (s: Station) => s && String(s.key ?? "").trim() !== "";
    const active = activeColumns.filter(hasKey);
    if (!columnOrder.length) return active;
    const orderSet = new Set(columnOrder.filter((k) => String(k ?? "").trim() !== ""));
    const ordered = columnOrder
      .filter((k) => String(k ?? "").trim() !== "" && allStations.some((s) => s.key === k) && !hiddenColumns.includes(k))
      .map((k) => allStations.find((s) => s.key === k)!)
      .filter(hasKey);
    const rest = active.filter((s) => !orderSet.has(s.key));
    return [...ordered, ...rest];
  }, [activeColumns, columnOrder, allStations, hiddenColumns]);

  /** Sve odabrane kolone (ukl. Pause, SF Prod.) prikazuju se u gridu; na kraju je kolona „Σ Std.” */
  const displayStationColumns = useMemo(() => orderedColumns, [orderedColumns]);

  const activeHours = useMemo(() => {
    const arr: number[] = [];
    let h = hoursFrom;
    while (true) {
      arr.push(h);
      if (h === (hoursTo === 0 ? 23 : (hoursTo - 1 + 24) % 24)) break;
      h = (h + 1) % 24;
      if (arr.length >= 24) break;
    }
    return arr;
  }, [hoursFrom, hoursTo]);

  const loadData = useCallback(async () => {
    if (!activeRestId || !selectedDate) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/productivity?restaurantId=${activeRestId}&date=${selectedDate}`
      );
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setRows(d.rows || {});
        if (d.netCoeff != null) setNetCoeff(String(d.netCoeff).replace(".", ","));
        if (d.hoursFrom !== undefined) setHoursFrom(d.hoursFrom);
        if (d.hoursTo !== undefined) setHoursTo(d.hoursTo);
        if (d.customDayNames) setCustomDayNames(d.customDayNames);
        setHiddenColumns([]);
        if (d.customStations) setCustomStations(d.customStations);
      } else {
        setRows({});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeRestId, selectedDate]);

  useEffect(() => {
    if (selectedDate && !templateEditMode) setRows({});
  }, [selectedDate, templateEditMode]);

  useEffect(() => {
    if (!templateEditMode) loadData();
  }, [loadData, templateEditMode]);

  const loadTemplateForEdit = useCallback(
    async (key: string) => {
      if (!activeRestId) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/productivity?restaurantId=${activeRestId}&date=${key}`
        );
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          setRows(d.rows || {});
          if (d.netCoeff != null) setNetCoeff(String(d.netCoeff).replace(".", ","));
          if (d.hoursFrom !== undefined) setHoursFrom(d.hoursFrom);
          if (d.hoursTo !== undefined) setHoursTo(d.hoursTo);
          if (d.customDayNames) setCustomDayNames(d.customDayNames || {});
          if (d.hiddenColumns) setHiddenColumns(d.hiddenColumns || []);
          if (Array.isArray(d.columnOrder)) setColumnOrder(d.columnOrder);
          if (d.customStations) setCustomStations(d.customStations || []);
        } else {
          setRows({});
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [activeRestId]
  );

  const handleInputChange = (h: number, field: string, val: string) => {
    setRows((prev) => ({ ...prev, [h]: { ...prev[h], [field]: val } }));
  };

  const getDayLabel = (key: string) =>
    customDayNames[key] || DAYS.find((d) => d.key === key)?.label || key;

  const selectedDateDayName = useMemo(() => {
    if (!selectedDate) return null;
    try {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString("de-DE", { weekday: "long" });
    } catch {
      return null;
    }
  }, [selectedDate]);

  const activeRestaurantName = useMemo(
    () => restaurants.find((r) => r.id === activeRestId)?.name ?? restaurants.find((r) => r.id === activeRestId)?.code ?? "Restaurant",
    [restaurants, activeRestId]
  );
  const activeRestaurantCode = useMemo(
    () => restaurants.find((r) => r.id === activeRestId)?.code ?? "",
    [restaurants, activeRestId]
  );

  const calendarMonthYear = useMemo(() => {
    if (!selectedDate) return { year: new Date().getFullYear(), month: new Date().getMonth() };
    const [y, m] = selectedDate.split("-").map(Number);
    return { year: y, month: m - 1 };
  }, [selectedDate]);

  const [calendarViewMonth, setCalendarViewMonth] = useState<{ year: number; month: number } | null>(null);

  const calendarGrid = useMemo(() => {
    const view = calendarViewMonth ?? (selectedDate
      ? (() => {
          const [y, m] = selectedDate.split("-").map(Number);
          return { year: y, month: m - 1 };
        })()
      : { year: new Date().getFullYear(), month: new Date().getMonth() });
    const { year, month } = view;
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const cells: { day: number | null }[] = [];
    for (let i = 0; i < startDow; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
    while (cells.length % 7 !== 0) cells.push({ day: null });
    return { year, month, cells };
  }, [calendarViewMonth, selectedDate]);

  useEffect(() => {
    if (showCalendarDropdown && !calendarViewMonth && selectedDate) {
      const [y, m] = selectedDate.split("-").map(Number);
      setCalendarViewMonth({ year: y, month: m - 1 });
    }
    if (!showCalendarDropdown) setCalendarViewMonth(null);
  }, [showCalendarDropdown, selectedDate, calendarViewMonth]);

  const totals = useMemo(() => {
    let sumBruto = 0;
    let sumNeto = 0;
    let sumStaff = 0;
    const coeff = parseNum(netCoeff) || 1;
    const sumByStation: Record<string, number> = {};

    const rowStats = activeHours.map((h) => {
      const row = rows[h] ?? rows[String(h)] ?? {};
      const bruto = parseNum(row.rev);
      const neto = bruto / coeff;

      activeColumns.forEach((s) => {
        const val = parseNum(row[s.key]);
        sumByStation[s.key] = (sumByStation[s.key] ?? 0) + val;
      });

      const stationHours = activeColumns
        .filter((s) => s.key !== "pause")
        .reduce((acc, s) => acc + parseNum(row[s.key]), 0);

      const pauseHours = parseNum(row["pause"]);
      const staffTotal = Math.max(0, stationHours - pauseHours);

      sumBruto += bruto;
      sumNeto += neto;
      sumStaff += staffTotal;

      return { h, bruto, neto, staffTotal };
    });

    return {
      sumBruto,
      sumNeto,
      sumStaff,
      sumByStation,
      avgProd: sumStaff > 0 ? sumNeto / sumStaff : 0,
      rowStats,
    };
  }, [activeHours, rows, activeColumns, netCoeff]);

  const getPayload = useCallback(
    () => ({
      rows,
      netCoeff: netCoeff.replace(",", "."),
      hoursFrom,
      hoursTo,
      customDayNames,
      hiddenColumns,
      customStations,
      columnOrder: columnOrder.length ? columnOrder : activeColumns.map((s) => s.key),
    }),
    [rows, netCoeff, hoursFrom, hoursTo, customDayNames, hiddenColumns, customStations, columnOrder, activeColumns]
  );

  useEffect(() => {
    return () => {
      if (activeRestId && selectedDate && !templateEditMode) {
        const payload = getPayload();
        fetch("/api/productivity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId: activeRestId,
            date: selectedDate,
            data: payload,
          }),
        }).catch(() => {});
      }
    };
  }, [activeRestId, selectedDate, templateEditMode, getPayload]);

  const performSave = useCallback(
    async (showToast = true) => {
      if (!activeRestId) {
        if (showToast) toast.error("Bitte Restaurant auswählen.");
        return;
      }
      if (!selectedDate) {
        if (showToast) toast.error("Bitte Datum auswählen.");
        return;
      }
      setIsSaving(true);
      try {
        const res = await fetch("/api/productivity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId: activeRestId,
            date: selectedDate,
            data: getPayload(),
          }),
        });
        if (res.ok && showToast) {
          toast.success("Daten erfolgreich gespeichert!");
        } else if (!res.ok) {
          toast.error("Fehler beim Speichern.");
        }
      } catch {
        toast.error("Fehler beim Speichern.");
      } finally {
        setIsSaving(false);
      }
    },
    [activeRestId, selectedDate, getPayload]
  );

  const handleSave = useCallback(() => performSave(false), [performSave]);

  const saveTemplate = useCallback(
    async (key: string) => {
      if (!activeRestId) {
        toast.error("Bitte Restaurant auswählen.");
        return;
      }
      setIsSaving(true);
      try {
        const res = await fetch("/api/productivity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId: activeRestId,
            date: key,
            data: getPayload(),
          }),
        });
        if (res.ok) {
          toast.success(`Vorlage "${getDayLabel(key)}" gespeichert.`);
        } else {
          toast.error("Fehler beim Speichern.");
        }
      } catch {
        toast.error("Fehler beim Speichern.");
      } finally {
        setIsSaving(false);
      }
    },
    [activeRestId, getPayload, getDayLabel]
  );

  const TEMPLATE_KEYS = useMemo(
    () => ["monday", "tuesday", "wednesday", "thursday", "friday", "special_1", "special_2", "special_3"] as const,
    []
  );

  const handleApplyTemplate = useCallback(
    async (templateKey: string) => {
      if (!activeRestId) {
        toast.error("Bitte Restaurant auswählen.");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/productivity?restaurantId=${activeRestId}&date=${templateKey}`
        );
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          setRows(d.rows || {});
          if (d.netCoeff != null) setNetCoeff(String(d.netCoeff).replace(".", ","));
          if (d.hoursFrom !== undefined) setHoursFrom(d.hoursFrom);
          if (d.hoursTo !== undefined) setHoursTo(d.hoursTo);
          if (d.customDayNames) setCustomDayNames(d.customDayNames);
          if (d.hiddenColumns) setHiddenColumns(d.hiddenColumns);
          if (Array.isArray(d.columnOrder)) setColumnOrder(d.columnOrder);
          if (d.customStations) setCustomStations(d.customStations);
          const label = d.customDayNames?.[templateKey] || DAYS.find((x) => x.key === templateKey)?.label || templateKey;
          toast.success(`Vorlage ${label} übernommen.`);
        } else {
          setRows({});
          toast.info("Vorlage ist leer.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Fehler beim Laden der Vorlage.");
      } finally {
        setLoading(false);
      }
    },
    [activeRestId]
  );

  const handleApplyTemplateAndSave = useCallback(
    async (templateKey: string) => {
      if (!activeRestId || !selectedDate) {
        toast.error("Bitte Restaurant und Datum auswählen.");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/productivity?restaurantId=${activeRestId}&date=${templateKey}`
        );
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const payload = {
            rows: d.rows || {},
            netCoeff: String(d.netCoeff ?? "1.17").replace(".", ",").replace(",", "."),
            hoursFrom: d.hoursFrom ?? 6,
            hoursTo: d.hoursTo ?? 1,
            customDayNames: d.customDayNames || {},
            hiddenColumns: d.hiddenColumns || [],
            customStations: d.customStations || [],
            columnOrder: Array.isArray(d.columnOrder) ? d.columnOrder : [],
          };
          const saveRes = await fetch("/api/productivity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              restaurantId: activeRestId,
              date: selectedDate,
              data: {
                ...payload,
                netCoeff: String(d.netCoeff ?? "1.17").replace(",", "."),
              },
            }),
          });
          setRows(payload.rows);
          setNetCoeff(String(d.netCoeff ?? "1.17").replace(".", ","));
          setHoursFrom(payload.hoursFrom);
          setHoursTo(payload.hoursTo);
          setCustomDayNames(payload.customDayNames);
          setHiddenColumns(payload.hiddenColumns);
          setColumnOrder(payload.columnOrder.length ? payload.columnOrder : []);
          setCustomStations(payload.customStations);
          const label = d.customDayNames?.[templateKey] || DAYS.find((x) => x.key === templateKey)?.label || templateKey;
          if (saveRes.ok) {
            toast.success(`Vorlage ${label} übernommen und gespeichert.`);
          } else {
            toast.error("Vorlage übernommen, Speichern fehlgeschlagen.");
          }
        } else {
          setRows({});
          toast.info("Vorlage ist leer.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Fehler beim Laden der Vorlage.");
      } finally {
        setLoading(false);
      }
    },
    [activeRestId, selectedDate]
  );

  const handleClearRow = useCallback((h: number) => {
    setRows((prev) => {
      const next = { ...prev };
      delete next[h];
      return next;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleColumnDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const currentKeys = orderedColumns.map((c) => c.key);
      const fromIndex = currentKeys.indexOf(active.id as string);
      if (fromIndex === -1) return;
      const toIndex = currentKeys.indexOf(over.id as string);
      if (toIndex === -1) return;
      const next = currentKeys.filter((_, i) => i !== fromIndex);
      next.splice(toIndex, 0, active.id as string);
      setColumnOrder(next);
    },
    [orderedColumns]
  );

  const buildSingleDayTable = (
    doc: jsPDF,
    startY: number,
    dayLabel: string,
    dayRows: Record<number, HourData>,
    dayTotals: { sumBruto: number; sumNeto: number; sumStaff: number; avgProd: number; rowStats: { h: number; bruto: number; neto: number; staffTotal: number }[] },
    daySumByStation: Record<string, number>,
    cols: Station[]
  ) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    const tableWidth = pageWidth - 2 * margin;
    const head = ["Uhr", "Brutto €", "Netto €", ...cols.map((s) => s.label), "Σ Std."];
    const body = dayTotals.rowStats.map((s) => {
      const row = dayRows[s.h] ?? {};
      const coeff = parseNum(netCoeff) || 1;
      const bruto = parseNum(row.rev) || 0;
      const neto = bruto / coeff;
      return [
        formatHourRange(s.h),
        fmtInt(bruto),
        fmtInt(neto),
        ...cols.map((col) => {
          const val = parseNum(row[col.key]);
          return val === 0 ? "-" : fmtInt(val);
        }),
        fmtInt(s.staffTotal),
      ];
    });
    const footer = [
      "Gesamt",
      fmtInt(dayTotals.sumBruto),
      fmtInt(dayTotals.sumNeto),
      ...cols.map((col) => (daySumByStation[col.key] !== 0 ? fmtInt(daySumByStation[col.key]) : "-")),
      fmtInt(dayTotals.sumStaff),
    ];
    const colCount = head.length;
    const timeW = 18;
    const brutoW = 20;
    const nettoW = 20;
    const restW = (tableWidth - timeW - brutoW - nettoW) / Math.max(1, colCount - 3);
    const colStyles: Record<number, { cellWidth?: number; halign?: string; fontStyle?: string; fillColor?: number[]; textColor?: number[] }> = {
      0: { cellWidth: timeW, halign: "left", fontStyle: "bold" },
      1: { cellWidth: brutoW, halign: "center", fontStyle: "bold" },
      2: { cellWidth: nettoW, halign: "center", fillColor: [255, 249, 230], textColor: [26, 56, 38], fontStyle: "bold" },
    };
    cols.forEach((_, i) => {
      colStyles[3 + i] = { cellWidth: Math.max(restW, 10), halign: "center" };
    });
    colStyles[3 + cols.length] = { cellWidth: Math.max(restW, 10), halign: "center", fontStyle: "bold" };
    autoTable(doc, {
      startY,
      head: [head],
      body: [...body, footer],
      theme: "grid",
      headStyles: { fillColor: [26, 56, 38], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 7, cellPadding: 2 },
      styles: { fontSize: 7, halign: "center", cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.1 },
      columnStyles: colStyles,
      didParseCell: (data: { row: { index: number }; cell: { styles: Record<string, unknown> } }) => {
        if (data.row.index === body.length) {
          data.cell.styles.fillColor = [26, 56, 38];
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };

  const handleExportPDF = () => {
    const doc = new jsPDF("l", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const restName = activeRestaurantName || "Restaurant";
    const keyLabel = selectedDateDayName || selectedDate || "Produktivität";
    const dateFormatted = selectedDate ? new Date(selectedDate + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

    doc.setFillColor(26, 56, 38);
    doc.rect(0, 0, pageWidth, 28, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 199, 44);
    doc.setFontSize(16);
    doc.text(`${restName} – Produktivität`, margin, 10);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`${keyLabel}  |  ${dateFormatted}`, margin, 18);
    doc.setFontSize(9);
    doc.text(
      `Brutto: ${fmtInt(totals.sumBruto)} €  |  Netto: ${fmtInt(totals.sumNeto)} €  |  Σ MA: ${fmtInt(totals.sumStaff)}  |  Prod.: ${fmtInt(totals.avgProd)} €`,
      margin,
      24
    );
    doc.setTextColor(0, 0, 0);

    const head = ["Uhrzeit", "Brutto (€)", "Netto (€)", ...displayStationColumns.map((s) => s.label), "Σ Std."];
    const body = totals.rowStats.map((s) => {
      const row = rows[s.h] || {};
      return [
        formatHourRange(s.h),
        fmtInt(s.bruto),
        fmtInt(s.neto),
        ...displayStationColumns.map((col) => {
          const val = parseNum(row[col.key]);
          return val === 0 ? "-" : fmtInt(val);
        }),
        fmtInt(s.staffTotal),
      ];
    });
    const footer = [
      "Gesamt",
      fmtInt(totals.sumBruto),
      fmtInt(totals.sumNeto),
      ...displayStationColumns.map((col) => (totals.sumByStation[col.key] !== 0 ? fmtInt(totals.sumByStation[col.key]) : "-")),
      fmtInt(totals.sumStaff),
    ];
    const tableWidth = pageWidth - 2 * margin;
    const colCount = head.length;
    const timeW = 24;
    const brutoW = 26;
    const nettoW = 26;
    const restW = (tableWidth - timeW - brutoW - nettoW) / Math.max(1, colCount - 3);
    const colStyles: Record<number, { cellWidth?: number; halign?: string; fontStyle?: string; fillColor?: number[]; textColor?: number[] }> = {
      0: { cellWidth: timeW, halign: "left", fontStyle: "bold" },
      1: { cellWidth: brutoW, halign: "center", fontStyle: "bold", fillColor: [255, 249, 230], textColor: [26, 56, 38] },
      2: { cellWidth: nettoW, halign: "center", fontStyle: "bold", fillColor: [255, 249, 230], textColor: [26, 56, 38] },
    };
    displayStationColumns.forEach((_, i) => {
      colStyles[3 + i] = { cellWidth: Math.max(restW, 14), halign: "center" };
    });
    colStyles[3 + displayStationColumns.length] = { cellWidth: Math.max(restW, 14), halign: "center", fontStyle: "bold" };

    autoTable(doc, {
      startY: 32,
      margin: { left: margin, right: margin },
      head: [head],
      body: [...body, footer],
      theme: "grid",
      headStyles: { fillColor: [26, 56, 38], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 7, cellPadding: 2 },
      styles: { fontSize: 7, halign: "center", cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.1 },
      columnStyles: colStyles,
      didParseCell: (data: { row: { index: number }; cell: { styles: Record<string, unknown> } }) => {
        if (data.row.index === body.length) {
          data.cell.styles.fillColor = [26, 56, 38];
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    doc.setDrawColor(26, 56, 38);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${restName} – Produktivität – ${keyLabel}  ${dateFormatted}`, margin, pageHeight - 5);

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleExportPDFMonthly = useCallback(async () => {
    if (!activeRestId || !selectedDate) {
      toast.error("Bitte Datum auswählen.");
      return;
    }
    const [y, m] = selectedDate.split("-").map(Number);
    const monthStr = `${y}-${String(m).padStart(2, "0")}`;
    const restName = activeRestaurantName || "Restaurant";
    try {
      const res = await fetch(`/api/productivity?restaurantId=${activeRestId}&month=${monthStr}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        toast.error("Keine Daten für diesen Monat.");
        return;
      }
      const byDate = json.data as Record<string, { rows?: Record<number, HourData>; netCoeff?: number; customStations?: Station[] }>;
      const dates = Object.keys(byDate).sort();
      if (dates.length === 0) {
        toast.error("Keine Daten für diesen Monat.");
        return;
      }
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 18;
      const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      const dayCols = displayStationColumns.length ? displayStationColumns : DEFAULT_STATIONS;

      dates.forEach((dateKey, dayIndex) => {
        const dayData = byDate[dateKey];
        if (!dayData?.rows) return;

        if (dayIndex > 0) doc.addPage("p", "mm", "a4");

        const dayRows = dayData.rows as Record<number, HourData>;
        const coeff = (dayData.netCoeff != null ? Number(dayData.netCoeff) : parseNum(netCoeff)) || 1;
        const rowStats: { h: number; bruto: number; neto: number; staffTotal: number }[] = [];
        let sumBruto = 0, sumNeto = 0, sumStaff = 0;
        const sumByStation: Record<string, number> = {};
        const hoursUsed = new Set<number>();
        Object.keys(dayRows).forEach((k) => hoursUsed.add(Number(k)));
        const sortedHours = Array.from(hoursUsed).sort((a, b) => a - b);
        for (const h of sortedHours) {
          const row = dayRows[h] ?? {};
          const bruto = parseNum(row.rev) || 0;
          const neto = bruto / coeff;
          let staffTotal = 0;
          dayCols.forEach((s) => {
            const v = parseNum(row[s.key]);
            sumByStation[s.key] = (sumByStation[s.key] ?? 0) + v;
            if (s.key !== "pause") staffTotal += v;
          });
          staffTotal -= parseNum(row["pause"]) || 0;
          staffTotal = Math.max(0, staffTotal);
          sumBruto += bruto;
          sumNeto += neto;
          sumStaff += staffTotal;
          rowStats.push({ h, bruto, neto, staffTotal });
        }
        const avgProd = sumStaff > 0 ? sumNeto / sumStaff : 0;
        const dayLabel = new Date(dateKey + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

        if (dayIndex === 0) {
          doc.setFillColor(26, 56, 38);
          doc.rect(0, 0, pageWidth, 32, "F");
          doc.setFont("helvetica", "bold");
          doc.setTextColor(255, 199, 44);
          doc.setFontSize(16);
          doc.text(`${restName} – Produktivität monatlich`, margin, 12);
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(10);
          doc.text(monthLabel, margin, 22);
          doc.setTextColor(0, 0, 0);
        }

        let startY = dayIndex === 0 ? 40 : 20;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(26, 56, 38);
        doc.text(dayLabel, margin, startY);
        startY += 6;
        startY = buildSingleDayTable(doc, startY, dayLabel, dayRows, { sumBruto, sumNeto, sumStaff, avgProd, rowStats }, sumByStation, dayCols);
      });

      doc.setDrawColor(26, 56, 38);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`${restName} – Produktivität monatlich – ${monthLabel}`, margin, pageHeight - 6);

      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success("PDF monatlich erstellt.");
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Erstellen des Monats-PDF.");
    }
  }, [activeRestId, selectedDate, activeRestaurantName, displayStationColumns, netCoeff]);

  const handleReset = () => {
    setRows({});
    setNetCoeff("1,17");
    setCustomDayNames({});
    toast.success("Zurücksetzen durchgeführt.");
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans overflow-hidden">
      {loading && (
        <div className="fixed inset-0 bg-[#1b3a26]/20 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#ffc72c]/30 border-t-[#ffc72c]" />
        </div>
      )}

      {isSaving && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-[#1b3a26] shadow-lg" style={{ backgroundColor: COLORS.yellow }}>
          <Loader2 size={18} className="animate-spin" />
          <span>Speichert…</span>
        </div>
      )}

      {/* HEADER – naslov + veliki broj restorana, jedan red: kontrole (manje) | KPI (veće) | akcije (manje) */}
      <div className="w-full px-4 pt-4 pb-4 sm:px-6 md:px-8 border-b border-border bg-white">
        <div className="max-w-[1920px] mx-auto">
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter leading-tight flex flex-wrap items-baseline gap-2">
                PROD <span className="text-[#FFC72C]">TOOL</span>
                {activeRestaurantCode && (
                  <span className="text-[#1a3826] dark:text-[#FFC72C] tabular-nums" aria-label={`Restaurant ${activeRestaurantCode}`}>
                    {activeRestaurantCode}
                  </span>
                )}
              </h1>
              <p className="text-muted-foreground text-xs mt-1">
                Produktivitätsplanung pro Stunde und Station.
              </p>
            </div>
            <div className="flex flex-nowrap items-center gap-3 pt-2 border-t border-border min-h-[3.5rem]">
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative" ref={calendarDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowCalendarDropdown((v) => !v)}
                    className="flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-lg border border-[#1b3a26]/25 bg-[#1b3a26]/5 hover:bg-[#1b3a26]/10 text-foreground font-medium text-xs transition-colors focus:ring-2 focus:ring-[#1b3a26]/30 outline-none"
                    aria-expanded={showCalendarDropdown}
                    aria-haspopup="dialog"
                    aria-label="Datum auswählen"
                  >
                    <Calendar size={14} className="text-[#1b3a26] shrink-0" />
                    <span className="min-w-[6rem] text-left">
                      {selectedDate
                        ? `${selectedDateDayName}, ${selectedDate.split("-").reverse().join(".")}`
                        : "Datum wählen"}
                    </span>
                  </button>
                {showCalendarDropdown && (
                  <div className="absolute left-0 top-full mt-2 z-50 rounded-xl border-2 border-border bg-white shadow-xl p-4 w-[304px]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-base text-[#1a3826]">
                        {new Date(calendarGrid.year, calendarGrid.month, 1).toLocaleDateString("de-DE", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCalendarViewMonth((prev) => {
                              const p = prev ?? { year: calendarGrid.year, month: calendarGrid.month };
                              const d = new Date(p.year, p.month - 1, 1);
                              return { year: d.getFullYear(), month: d.getMonth() };
                            });
                          }}
                          className="p-2 rounded-lg hover:bg-muted text-[#1a3826] font-bold text-lg leading-none"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCalendarViewMonth((prev) => {
                              const p = prev ?? { year: calendarGrid.year, month: calendarGrid.month };
                              const d = new Date(p.year, p.month + 1, 1);
                              return { year: d.getFullYear(), month: d.getMonth() };
                            });
                          }}
                          className="p-2 rounded-lg hover:bg-muted text-[#1a3826] font-bold text-lg leading-none"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground mb-1">
                      {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => (
                        <span key={w}>{w}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarGrid.cells.map((cell, idx) => {
                        const dateStr =
                          cell.day !== null
                            ? `${calendarGrid.year}-${String(calendarGrid.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`
                            : "";
                        const isSelected = selectedDate === dateStr;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cell.day === null) return;
                              setSelectedDate(
                                `${calendarGrid.year}-${String(calendarGrid.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`
                              );
                              setShowCalendarDropdown(false);
                            }}
                            className={`min-h-[36px] w-full rounded-lg text-sm font-semibold transition-colors flex items-center justify-center ${
                              cell.day === null
                                ? "invisible"
                                : isSelected
                                  ? "bg-[#1b3a26] text-white"
                                  : "text-[#1a3826] hover:bg-[#1b3a26]/15"
                            }`}
                          >
                            {cell.day ?? ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                </div>
                <label htmlFor="prod-template-select" className="text-xs font-medium text-muted-foreground whitespace-nowrap sr-only sm:not-sr-only">
                  Vorlage:
                </label>
                <select
                  id="prod-template-select"
                  aria-label="Template übernehmen"
                  className="h-8 pl-2 pr-7 rounded-lg border border-[#1b3a26]/25 bg-[#1b3a26]/5 text-foreground font-medium text-xs focus:ring-2 focus:ring-[#1b3a26]/30 outline-none cursor-pointer shrink-0"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    e.target.value = "";
                    if (!selectedDate) {
                      toast.error("Bitte zuerst ein Datum wählen.");
                      return;
                    }
                    handleApplyTemplateAndSave(v);
                  }}
                >
                  <option value="">Template wählen…</option>
                  {TEMPLATE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {getDayLabel(key)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-center flex-nowrap overflow-x-auto py-0.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1b3a26] text-white min-h-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90 whitespace-nowrap">Brutto</span>
                  <span className="tabular-nums font-bold text-sm whitespace-nowrap">{fmtInt(totals.sumBruto)} €</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-sm min-h-0" style={{ backgroundColor: COLORS.yellow }}>
                  <span className="text-[10px] font-semibold text-[#1a3826] uppercase tracking-wide whitespace-nowrap">Netto</span>
                  <span className="tabular-nums font-bold text-sm text-[#1a3826] whitespace-nowrap">{fmtInt(totals.sumNeto)} €</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1b3a26] text-white min-h-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90 whitespace-nowrap">Σ MA</span>
                  <span className="tabular-nums font-bold text-sm whitespace-nowrap">{fmtInt(totals.sumStaff)}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-sm min-h-0" style={{ backgroundColor: COLORS.yellow }}>
                  <span className="text-[10px] font-semibold text-[#1a3826] uppercase tracking-wide whitespace-nowrap">Prod.</span>
                  <span className="tabular-nums font-bold text-sm text-[#1a3826] whitespace-nowrap">{fmtInt(totals.avgProd)} €</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    hoursWhenModalOpenedRef.current = { from: hoursFrom, to: hoursTo };
                    setShowSettingsModal(true);
                  }}
                  className="h-8 w-8 rounded-lg border border-[#1b3a26]/25 bg-[#1b3a26]/5 hover:bg-[#1b3a26]/10 flex items-center justify-center text-[#1b3a26] transition-colors"
                  title="Einstellungen"
                >
                  <Settings size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="h-8 px-3 rounded-sm bg-[#FFBC0D] hover:bg-[#e6b225] text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                  title="Speichern"
                >
                  <Save size={14} strokeWidth={2.5} className="shrink-0" />
                  <span className="whitespace-nowrap">Speichern</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="h-8 px-3 rounded-lg bg-[#FFC72C] text-[#1a3826] hover:bg-[#e6b225] transition flex items-center justify-center gap-1 shadow-sm font-bold text-xs"
                  title="PDF aktuell (Tag)"
                >
                  <FileDown size={14} strokeWidth={2.5} className="shrink-0" />
                  <span className="whitespace-nowrap">PDF aktuell</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPDFMonthly()}
                  className="h-8 px-3 rounded-lg bg-[#FFC72C] text-[#1a3826] hover:bg-[#e6b225] transition flex items-center justify-center gap-1 shadow-sm font-bold text-xs"
                  title="PDF monatlich (Restaurant)"
                >
                  <CalendarDays size={14} strokeWidth={2.5} className="shrink-0" />
                  <span className="whitespace-nowrap">PDF monatlich</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="h-8 px-3 rounded-lg bg-[#FFC72C] text-red-600 hover:bg-[#e6b225] transition flex items-center justify-center gap-1 shadow-sm font-bold text-xs"
                  title="Zurücksetzen"
                >
                  <Trash2 size={14} strokeWidth={2.5} className="shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {templateEditMode && (
        <div className="w-full px-4 py-3 sm:px-6 md:px-8 bg-[#1b3a26]/10 border-b border-[#1b3a26]/20">
          <div className="max-w-[1920px] mx-auto flex flex-wrap items-center gap-3">
            <span className="font-semibold text-[#1a3826]">Vorlage: {getDayLabel(templateEditKey)}</span>
            <button
              type="button"
              onClick={() => saveTemplate(templateEditKey)}
              className="h-10 px-4 rounded-sm bg-[#FFBC0D] hover:bg-[#e6b225] text-black font-bold text-sm flex items-center gap-2 shadow-sm"
            >
              <Save size={18} strokeWidth={2.5} /> Speichern
            </button>
            <button
              type="button"
              onClick={() => setTemplateEditMode(false)}
              className="h-10 px-4 rounded-lg border-2 border-[#1b3a26]/30 text-[#1a3826] hover:bg-[#1b3a26]/10 font-semibold text-sm"
            >
              Fertig
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 bg-muted/20">
        <div className="bg-white rounded-lg border border-border shadow-sm w-full overflow-hidden">
          <div
            ref={tableWrapperRef}
            className="overflow-x-auto relative"
            style={{ maxHeight: "calc(100vh - 160px)" }}
            onKeyDown={handleTableKeyDown}
          >
            <DndContext sensors={sensors} onDragEnd={handleColumnDragEnd}>
            <table className="w-full text-[11px] border-collapse [&>tbody>tr:last-child]:border-b-0" style={{ borderColor: "#d1d5db" }}>
              <colgroup>
                <col style={{ width: "5rem" }} />
                <col style={{ width: "6rem" }} />
                <col style={{ width: "6rem" }} />
                {displayStationColumns.map((s) => (
                  <col key={`col-${s.key}`} style={{ minWidth: "4.5rem" }} />
                ))}
                <col style={{ minWidth: "4rem" }} />
              </colgroup>
              <thead className="text-white sticky top-0 z-40 border-b" style={{ backgroundColor: COLORS.green }}>
                <tr className="font-semibold uppercase tracking-wide text-xs">
                  <th className="py-2 px-1.5 w-20 text-center border-r border-white/20 sticky left-0 z-50" style={{ backgroundColor: COLORS.green }}>
                    Uhrzeit
                  </th>
                  <th className="py-2 px-1.5 w-24 text-center border-r border-white/20 sticky left-20 z-50 font-bold" style={{ backgroundColor: COLORS.yellow, color: COLORS.green }}>
                    Brutto (€)
                  </th>
                  <th className="py-2 px-1.5 w-24 text-center border-r border-white/20 sticky left-[11rem] z-50 font-bold" style={{ backgroundColor: COLORS.yellow, color: COLORS.green }}>
                    Netto (€)
                  </th>
                  {displayStationColumns.map((s) => (
                    <DraggableColumnHeader key={s.key} s={s} isPause={s.key === "pause"} />
                  ))}
                  <th className="py-2 px-1 min-w-[4rem] w-20 text-center border-r border-white/20 font-semibold text-[10px] uppercase text-white" style={{ backgroundColor: COLORS.green }}>
                    Σ Std.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {totals.rowStats.map((stat, idx) => {
                  const row = rows[stat.h] || {};
                  return (
                    <tr
                      key={stat.h}
                      className={idx % 2 === 0 ? "bg-card" : "bg-muted/20 hover:bg-muted/30"}
                    >
                      <td className="py-1 px-1.5 text-muted-foreground text-center sticky left-0 z-10 border-r border-border bg-inherit font-medium">
                        {formatHourRange(stat.h)}
                      </td>
                      <td className="p-0 border-r border-border bg-amber-50/50 sticky left-20 z-10">
                        <input
                          type="text"
                          value={row.rev || ""}
                          onChange={(e) => handleInputChange(stat.h, "rev", e.target.value)}
                          className="w-full h-7 px-1 bg-transparent text-center font-medium text-foreground focus:bg-white focus:ring-1 focus:ring-[#1b3a26] outline-none border-0 tabular-nums"
                          placeholder="0"
                        />
                      </td>
                      <td className="py-1 px-1.5 text-center font-medium text-foreground bg-amber-50/50 border-r border-border sticky left-[11rem] z-10 tabular-nums">
                        {fmtInt(stat.neto)}
                      </td>
                      {displayStationColumns.map((s) => (
                        <td key={s.key} className={`p-0 border-r border-border ${s.key === "pause" ? "bg-red-50/30" : ""}`}>
                          <input
                            type="text"
                            value={row[s.key] || ""}
                            onChange={(e) => handleInputChange(stat.h, s.key, e.target.value)}
                            className="w-full h-7 px-0.5 bg-transparent text-center text-foreground font-medium focus:bg-white focus:ring-1 focus:ring-[#1b3a26] outline-none border-0 tabular-nums"
                            placeholder="-"
                          />
                        </td>
                      ))}
                      <td className="py-1 px-1.5 text-center font-medium text-foreground border-r border-border tabular-nums bg-muted/30">
                        {fmtInt(stat.staffTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-40 border-t-0" style={{ backgroundColor: COLORS.green }}>
                <tr className="text-xs font-bold text-white">
                  <td className="py-1 px-1.5 sticky left-0 z-50 text-center" style={{ backgroundColor: COLORS.green }}>
                    Gesamt
                  </td>
                  <td className="py-1 px-1.5 text-center sticky left-20 z-50 tabular-nums">
                    {fmtInt(totals.sumBruto)} €
                  </td>
                  <td className="py-1 px-1.5 text-center sticky left-[11rem] z-50 tabular-nums">
                    {fmtInt(totals.sumNeto)} €
                  </td>
                  {displayStationColumns.map((s) => {
                    const sum = totals.sumByStation[s.key] ?? 0;
                    return (
                      <td key={s.key} className="py-1 px-1 text-center tabular-nums border-r border-white/20">
                        {sum !== 0 ? fmtInt(sum) : "–"}
                      </td>
                    );
                  })}
                  <td className="py-1 px-1 text-center tabular-nums border-r border-white/20 font-bold">
                    {fmtInt(totals.sumStaff)}
                  </td>
                </tr>
              </tfoot>
            </table>
            </DndContext>
          </div>
        </div>
      </div>

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-border overflow-hidden">
            <div className="shrink-0 flex justify-between items-center px-6 py-4 border-b border-border bg-[#1b3a26]/5">
              <h2 className="font-bold text-xl text-[#1a3826] flex items-center gap-2">
                <Settings size={24} /> Einstellungen
              </h2>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-2 rounded-xl hover:bg-[#1b3a26]/10 text-[#1a3826] transition-colors"
              >
                <X size={22} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* 1. Arbeitszeit & Berechnung */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <h3 className="text-sm font-bold text-[#1a3826] mb-3 flex items-center gap-2">
                    <Clock size={18} /> Arbeitszeit (Zeitspanne)
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">Stundenbereich für die Tabelle (Start → Ende).</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] text-muted-foreground mb-1">Start</label>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={hoursFrom}
                        onChange={(e) => setHoursFrom(Number(e.target.value))}
                        className="w-full h-10 border border-border rounded-lg text-center font-medium bg-background text-sm focus:ring-2 focus:ring-[#1b3a26]/30 outline-none"
                      />
                    </div>
                    <span className="text-muted-foreground pt-5 text-sm">→</span>
                    <div className="flex-1">
                      <label className="block text-[11px] text-muted-foreground mb-1">Ende</label>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={hoursTo}
                        onChange={(e) => setHoursTo(Number(e.target.value))}
                        className="w-full h-10 border border-border rounded-lg text-center font-medium bg-background text-sm focus:ring-2 focus:ring-[#1b3a26]/30 outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <h3 className="text-sm font-bold text-[#1a3826] mb-3">Koeffizient (Köff.)</h3>
                  <p className="text-xs text-muted-foreground mb-3">Brutto/Netto-Umrechnung für die Tabelle.</p>
                  <input
                    type="text"
                    value={netCoeff}
                    onChange={(e) => setNetCoeff(e.target.value)}
                    className="w-24 h-10 px-3 border border-border rounded-lg text-center font-semibold bg-background text-sm focus:ring-2 focus:ring-[#1b3a26]/30 outline-none"
                  />
                </div>
              </section>

              {/* 2. Vorlagen – jedna sekcija, dva jasna akta */}
              <section className="rounded-xl border border-border bg-muted/20 p-4">
                <h3 className="text-sm font-bold text-[#1a3826] mb-1">Vorlagen</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Vorlagen sind gespeicherte Tages-Pläne (z. B. Montag). Sie können eine Vorlage auf das aktuelle Datum anwenden oder eine Vorlage bearbeiten.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      1. Vorlage auf aktuelles Datum anwenden
                    </label>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Wählen Sie eine Vorlage – die Daten werden für das heute gewählte Kalenderdatum übernommen und gespeichert.
                    </p>
                    <select
                      aria-label="Vorlage auf aktuelles Datum anwenden"
                      className="w-full max-w-xs h-10 pl-3 pr-9 border border-border rounded-lg font-medium bg-background text-sm focus:ring-2 focus:ring-[#1b3a26]/30 outline-none"
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) {
                          handleApplyTemplateAndSave(v);
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="">Vorlage wählen…</option>
                      {TEMPLATE_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {getDayLabel(key)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-3 border-t border-border">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      2. Vorlage bearbeiten (Tabelle öffnen)
                    </label>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      Wählen Sie einen Tag (z. B. Freitag) und klicken Sie „Öffnen“ – die Tabelle zeigt dann diese Vorlage zum Bearbeiten und Speichern.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={templateSelectInModal}
                        onChange={(e) => setTemplateSelectInModal(e.target.value)}
                        className="h-10 pl-3 pr-9 border border-border rounded-lg font-medium bg-background text-sm focus:ring-2 focus:ring-[#1b3a26]/30 outline-none min-w-[11rem]"
                      >
                        {TEMPLATE_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {getDayLabel(key)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateEditKey(templateSelectInModal);
                          setShowSettingsModal(false);
                          setTemplateEditMode(true);
                          loadTemplateForEdit(templateSelectInModal);
                        }}
                        className="h-10 px-4 rounded-lg bg-[#1b3a26] text-white hover:bg-[#1b3a26]/90 font-semibold text-sm flex items-center gap-2"
                      >
                        <Edit2 size={16} /> Öffnen
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. Spalten – male checkboxe, sve kolone ukl. Pause */}
              <section className="rounded-xl border border-border bg-muted/20 p-4">
                <h3 className="text-sm font-bold text-[#1a3826] mb-1">Spalten in der Tabelle</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Ein Häkchen = Spalte wird in der Tabelle angezeigt. Kein Häkchen = Spalte ausgeblendet.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {DEFAULT_STATIONS.map((s) => {
                    const isVisible = !hiddenColumns.includes(s.key);
                    return (
                      <label
                        key={s.key}
                        className={`flex items-center gap-2 py-2 px-2.5 rounded-lg border cursor-pointer transition-colors ${
                          isVisible ? "border-[#1b3a26]/30 bg-[#1b3a26]/5" : "border-border bg-background"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => {
                            if (isVisible)
                              setHiddenColumns((prev) => [...prev, s.key]);
                            else
                              setHiddenColumns((prev) => prev.filter((k) => k !== s.key));
                          }}
                          className="w-4 h-4 rounded border-border text-[#1b3a26] focus:ring-[#1b3a26]/50 cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-medium text-foreground truncate">{s.label}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="text-xs font-semibold text-foreground mb-2">Eigene Stationen (max. 3)</h4>
                  {customStations.map((s) => (
                    <div
                      key={s.key}
                      className="flex items-center gap-2 mb-2 py-1.5 px-2 bg-background rounded-lg border border-border"
                    >
                      <span className="flex-1 text-xs font-medium text-foreground">{s.label}</span>
                      <button
                        type="button"
                        onClick={() => setCustomStations((prev) => prev.filter((x) => x.key !== s.key))}
                        className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {customStations.length < 3 && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Neue Station…"
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        className="flex-1 h-9 px-2.5 text-xs border border-border rounded-lg font-medium bg-background focus:ring-2 focus:ring-[#1b3a26]/30 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newColName.trim()) return;
                          setCustomStations((p) => [
                            ...p,
                            { key: `custom_${Date.now()}`, label: newColName.trim(), group: "Custom" },
                          ]);
                          setNewColName("");
                        }}
                        className="h-9 px-3 font-bold text-[#1a3826] rounded-lg text-xs shrink-0"
                        style={{ backgroundColor: COLORS.yellow }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
            <div className="shrink-0 p-4 border-t border-border bg-muted/10">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: COLORS.green }}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductivityClient(props: {
  defaultRestaurantId?: string | null;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center font-black uppercase tracking-widest">
          Modul wird geladen…
        </div>
      }
    >
      <ProductivityToolContent defaultRestaurantId={props.defaultRestaurantId} />
    </Suspense>
  );
}
