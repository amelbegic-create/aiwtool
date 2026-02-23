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
  FileText,
  Plus,
  Trash2,
  Calendar,
  Clock,
  X,
  Check,
  Edit2,
  Loader2,
  GripVertical,
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

  const [mode, setMode] = useState<"template" | "date">("template");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("monday");
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

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoursWhenModalOpenedRef = useRef({ from: 6, to: 1 });

  const [showHoursModal, setShowHoursModal] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [newColName, setNewColName] = useState("");

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

  useEffect(() => {
    if (mode === "date") setHiddenColumns([]);
  }, [mode]);

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

  /** Zadnje dvije stanice se ne prikazuju u gridu; na kraju je jedna kolona „Σ Std.” */
  const displayStationColumns = useMemo(
    () => (orderedColumns.length >= 2 ? orderedColumns.slice(0, -2) : orderedColumns),
    [orderedColumns]
  );

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
    if (!activeRestId) return;
    const key = mode === "template" ? selectedTemplateKey : selectedDate;
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
        if (d.customDayNames) setCustomDayNames(d.customDayNames);
        if (mode === "template") {
          if (d.hiddenColumns) setHiddenColumns(d.hiddenColumns);
          if (Array.isArray(d.columnOrder)) setColumnOrder(d.columnOrder);
        } else {
          setHiddenColumns([]);
        }
        if (d.customStations) setCustomStations(d.customStations);
      } else {
        setRows({});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeRestId, selectedTemplateKey, selectedDate, mode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInputChange = (h: number, field: string, val: string) => {
    setRows((prev) => ({ ...prev, [h]: { ...prev[h], [field]: val } }));
  };

  const getDayLabel = (key: string) =>
    customDayNames[key] || DAYS.find((d) => d.key === key)?.label || key;

  const selectedDateDayName = useMemo(() => {
    if (mode !== "date" || !selectedDate) return null;
    try {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString("de-DE", { weekday: "long" });
    } catch {
      return null;
    }
  }, [mode, selectedDate]);

  const handleRenameDay = () => {
    if (tempName.trim()) {
      setCustomDayNames((prev) => ({ ...prev, [selectedTemplateKey]: tempName }));
    }
    setIsEditingName(false);
  };

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

  const performSave = useCallback(
    async (showToast = true) => {
      if (!activeRestId) {
        if (showToast) toast.error("Bitte Restaurant auswählen.");
        return;
      }
      setIsSaving(true);
      const key = mode === "template" ? selectedTemplateKey : selectedDate;
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
    [activeRestId, mode, selectedTemplateKey, selectedDate, getPayload]
  );

  const handleSave = useCallback(() => performSave(false), [performSave]);

  const handleBlurSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      performSave(false);
    }, 250);
  }, [performSave]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

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

  const handleExportPDF = () => {
    const doc = new jsPDF("l", "mm", "a4");
    const storeIdx = Math.max(0, restaurants.findIndex((r) => r.id === activeRestId) + 1);
    const storeTitle = storeIdx > 0 ? `Store ${storeIdx}` : "Store";
    const keyLabel =
      mode === "template" ? getDayLabel(selectedTemplateKey) : selectedDate;

    doc.setFillColor(26, 56, 38);
    doc.rect(0, 0, 297, 28, "F");

    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 199, 44);
    doc.setFontSize(16);
    doc.text(`${storeTitle} – Produktivität`, 14, 12);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`${storeTitle} | ${keyLabel}`, 14, 20);

    doc.setFontSize(9);
    doc.text(
      `Brutto: ${fmtInt(totals.sumBruto)} €  |  Netto: ${fmtInt(totals.sumNeto)} €  |  Arbeitsstunden: ${fmtInt(totals.sumStaff)}  |  Prod.: ${fmtInt(totals.avgProd)} €`,
      14,
      26
    );
    doc.setTextColor(0, 0, 0);

    const head = [
      "Uhr",
      "Brutto €",
      "Netto €",
      ...displayStationColumns.map((s) => s.label),
      "Σ Std.",
    ];
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
      ...displayStationColumns.map((col) => {
        const sum = totals.sumByStation[col.key] ?? 0;
        return sum !== 0 ? fmtInt(sum) : "-";
      }),
      fmtInt(totals.sumStaff),
    ];

    const colCount = head.length;
    const pageWidth = 297;
    const margin = 14;
    const tableWidth = pageWidth - 2 * margin;
    const timeW = 22;
    const brutoW = 24;
    const nettoW = 24;
    const restW = (tableWidth - timeW - brutoW - nettoW) / Math.max(1, colCount - 3);

    const colStyles: Record<number, { cellWidth?: number; halign?: string; fontStyle?: string; fillColor?: number[]; textColor?: number[] }> = {
      0: { cellWidth: timeW, halign: "left", fontStyle: "bold" },
      1: { cellWidth: brutoW, halign: "center", fontStyle: "bold" },
      2: { cellWidth: nettoW, halign: "center", fillColor: [255, 249, 230], textColor: [26, 56, 38], fontStyle: "bold" },
    };
    displayStationColumns.forEach((_, i) => {
      colStyles[3 + i] = { cellWidth: Math.max(restW, 12), halign: "center" };
    });
    colStyles[3 + displayStationColumns.length] = { cellWidth: Math.max(restW, 12), halign: "center", fontStyle: "bold" };

    autoTable(doc, {
      startY: 32,
      head: [head],
      body: [...body, footer],
      theme: "grid",
      headStyles: {
        fillColor: [26, 56, 38],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
        fontSize: 7,
        cellPadding: 2,
      },
      styles: {
        fontSize: 7,
        halign: "center",
        cellPadding: 2,
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
      columnStyles: colStyles,
      didParseCell: (data: { row: { index: number }; cell: { styles: Record<string, unknown> } }) => {
        if (data.row.index === body.length) {
          data.cell.styles.fillColor = [26, 56, 38];
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    doc.save(`Produktivitaet_Store_${storeIdx}_${keyLabel.replace(/\//g, "-")}.pdf`);
  };

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

      <div className="shrink-0 text-white" style={{ backgroundColor: COLORS.green }}>
        <div className="max-w-[1920px] mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="flex items-baseline gap-0.5 text-lg font-bold tracking-tight">
              <span style={{ color: COLORS.yellow }}>Prod</span>
              <span>Tool</span>
            </h1>
            <div className="flex rounded-md overflow-hidden border border-white/20 bg-white/5">
              <button
                onClick={() => setMode("template")}
                className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 ${
                  mode === "template" ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"
                }`}
              >
                <Settings size={12} /> Vorlagen
              </button>
              <button
                onClick={() => setMode("date")}
                className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 ${
                  mode === "date" ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"
                }`}
              >
                <Calendar size={12} /> Kalender
              </button>
            </div>
            {mode === "template" ? (
              <div className="flex items-center gap-1">
                {isEditingName ? (
                  <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-md border border-white/20">
                    <input
                      autoFocus
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="w-28 p-1 text-sm outline-none bg-transparent text-white placeholder:text-white/50"
                    />
                    <button onClick={handleRenameDay} className="p-0.5 text-white hover:bg-white/20 rounded">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setIsEditingName(false)} className="p-0.5 text-white/70 hover:bg-white/20 rounded">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedTemplateKey}
                      onChange={(e) => setSelectedTemplateKey(e.target.value)}
                      className="h-8 pl-2 pr-7 bg-white/10 border border-white/20 rounded-md text-sm font-medium text-white appearance-none outline-none focus:ring-1 focus:ring-white/40"
                    >
                      {DAYS.map((d) => (
                        <option key={d.key} value={d.key} className="bg-[#1b3a26] text-white">
                          {getDayLabel(d.key)}
                        </option>
                      ))}
                    </select>
                    {selectedTemplateKey.startsWith("special") && (
                      <button
                        onClick={() => {
                          setTempName(getDayLabel(selectedTemplateKey));
                          setIsEditingName(true);
                        }}
                        className="p-1.5 border border-white/20 rounded-md text-white/80 hover:bg-white/10"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="relative inline-flex">
                <div
                  className="flex items-center gap-2 h-8 pl-3 pr-2 bg-white/10 border border-white/20 rounded-md text-sm font-semibold text-white whitespace-nowrap pointer-events-none"
                  aria-hidden
                >
                  <span>{selectedDateDayName ?? "Datum wählen"}</span>
                  <Calendar size={16} className="text-white/80 shrink-0" />
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title={selectedDateDayName ?? "Datum wählen"}
                  aria-label="Datum wählen"
                />
              </div>
            )}
            <div className="flex items-center gap-2 border-l border-white/20 pl-4">
              <span className="text-[10px] font-medium text-white/80">Brutto</span>
              <span className="tabular-nums font-semibold text-white">{fmtInt(totals.sumBruto)} €</span>
              <span className="text-white/50">|</span>
              <span className="text-[10px] font-medium text-white/80">Netto</span>
              <span className="tabular-nums font-semibold text-white">{fmtInt(totals.sumNeto)} €</span>
              <span className="text-white/50">|</span>
              <span className="text-[10px] font-medium text-white/80">Σ MA</span>
              <span className="tabular-nums font-semibold text-white">{fmtInt(totals.sumStaff)}</span>
              <span className="text-white/50">|</span>
              <span className="text-[10px] font-medium text-white/80">Prod.</span>
              <span className="tabular-nums font-semibold text-white">{fmtInt(totals.avgProd)} €</span>
            </div>
            <div className="flex items-center gap-2 border-l border-white/20 pl-4">
              <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold uppercase text-white/90">Köff.</span>
              <input
                type="text"
                value={netCoeff}
                onChange={(e) => setNetCoeff(e.target.value)}
                className="w-11 h-6 px-1 bg-white/15 border border-white/20 rounded text-center text-xs font-semibold text-white outline-none focus:ring-1 focus:ring-white/40"
              />
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => {
                  hoursWhenModalOpenedRef.current = { from: hoursFrom, to: hoursTo };
                  setShowHoursModal(true);
                }}
                className="p-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white"
                title="Zeitspanne"
              >
                <Clock size={16} />
              </button>
              <button onClick={() => setShowColumnsModal(true)} className="p-2 rounded-md hover:bg-white/10 text-white/80 hover:text-white" title="Spalten">
                <Settings size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={handleSave} className="px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1.5 text-[#1b3a26] bg-white/90 hover:bg-white" title="Speichern">
                <Save size={14} /> Speichern
              </button>
              <button onClick={handleReset} className="px-3 py-1.5 rounded text-xs font-medium text-white/90 hover:bg-white/10 border border-white/20" title="Zurücksetzen">
                <Trash2 size={12} /> Zurücksetzen
              </button>
              <button onClick={handleExportPDF} className="px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1.5 text-white/90 hover:bg-white/10 border border-white/20" title="PDF">
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-muted/20">
        <div className="bg-white rounded-lg border border-border shadow-sm w-full overflow-hidden">
          <div
            className="overflow-x-auto relative"
            style={{ maxHeight: "calc(100vh - 160px)" }}
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
                          onBlur={handleBlurSave}
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
                            onBlur={handleBlurSave}
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

      {showHoursModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm border border-gray-200">
            <h3 className="font-bold text-lg text-center mb-4" style={{ color: COLORS.green }}>
              Zeitspanne einstellen
            </h3>
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Start</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hoursFrom}
                  onChange={(e) => setHoursFrom(Number(e.target.value))}
                  className="w-full h-12 border border-border rounded-lg text-xl font-medium text-center text-foreground bg-background focus:ring-1 focus:ring-ring outline-none"
                />
              </div>
              <div className="flex items-center text-muted-foreground pt-6 text-lg">→</div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Ende</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hoursTo}
                  onChange={(e) => setHoursTo(Number(e.target.value))}
                  className="w-full h-12 border border-border rounded-lg text-xl font-medium text-center text-foreground bg-background focus:ring-1 focus:ring-ring outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setHoursFrom(hoursWhenModalOpenedRef.current.from);
                  setHoursTo(hoursWhenModalOpenedRef.current.to);
                  setShowHoursModal(false);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm border border-border text-muted-foreground hover:bg-muted transition-colors"
              >
                <X size={18} /> Abbrechen
              </button>
              <button
                type="button"
                onClick={() => setShowHoursModal(false)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm text-[#1b3a26] hover:opacity-95 transition-opacity"
                style={{ backgroundColor: COLORS.yellow }}
              >
                <Check size={18} /> Übernehmen
              </button>
            </div>
          </div>
        </div>
      )}

      {showColumnsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white p-5 rounded-xl shadow-xl w-full max-md max-h-[85vh] flex flex-col border border-gray-200">
            <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-3 shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2" style={{ color: COLORS.green }}>
                <Settings size={18} /> Spalten & Stationen
              </h3>
              <button
                onClick={() => setShowColumnsModal(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {DEFAULT_STATIONS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => {
                      if (hiddenColumns.includes(s.key))
                        setHiddenColumns((prev) => prev.filter((k) => k !== s.key));
                      else setHiddenColumns((prev) => [...prev, s.key]);
                    }}
                    className={`p-2.5 rounded-lg text-xs font-medium flex justify-between items-center border transition-all ${
                      !hiddenColumns.includes(s.key)
                        ? "border-border bg-muted/50 text-foreground"
                        : "bg-background border-border text-muted-foreground"
                    }`}
                  >
                    {s.label}
                    {!hiddenColumns.includes(s.key) && <Check size={14} strokeWidth={3} />}
                  </button>
                ))}
              </div>
              <div className="pt-4 border-t border-border">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Eigene Stationen (max. 3)</h4>
                {customStations.map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center gap-2 mb-2 p-2 bg-muted/50 rounded-lg border border-border"
                  >
                    <span className="flex-1 text-xs font-medium px-2 text-foreground">{s.label}</span>
                    <button
                      onClick={() =>
                        setCustomStations((prev) => prev.filter((x) => x.key !== s.key))
                      }
                      className="text-muted-foreground hover:text-destructive p-1.5 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {customStations.length < 3 && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Bezeichnung…"
                      value={newColName}
                      onChange={(e) => setNewColName(e.target.value)}
                      className="flex-1 p-2.5 text-xs border border-border rounded-lg font-medium bg-background"
                    />
                    <button
                      onClick={() => {
                        if (!newColName) return;
                        setCustomStations((p) => [
                          ...p,
                          { key: `custom_${Date.now()}`, label: newColName, group: "Custom" },
                        ]);
                        setNewColName("");
                      }}
                      className="p-2.5 font-bold text-[#1b3a26] rounded-lg hover:opacity-95 transition-opacity"
                      style={{ backgroundColor: COLORS.yellow }}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowColumnsModal(false)}
              className="w-full mt-4 py-3 rounded-lg font-semibold text-sm text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: COLORS.green }}
            >
              Schließen
            </button>
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
