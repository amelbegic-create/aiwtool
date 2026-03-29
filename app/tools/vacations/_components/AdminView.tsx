/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  updateVacationStatus,
  getGlobalVacationStats,
  createVacationRequest,
  saveVacationEmployeeSortOrder,
  deleteApprovedVacationAsApprover,
  addBlockedDay,
  removeBlockedDay,
} from "@/app/actions/vacationActions";
import { toast } from "sonner";
import {
  Check,
  X,
  Trash2,
  Calendar,
  Search,
  RotateCcw,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Globe,
  CalendarPlus,
  Loader2,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateDDMMGGGG, MONTH_ABBREVS_DE_AT } from "@/lib/dateUtils";
import { openPdfInSameTab, pdfToBlobUrl } from "@/lib/pdfUtils";
import { sortUserStatsForVacationTable } from "@/lib/vacationTableSort";
import { rangeHitsBlockedDay } from "@/lib/vacationBlockedRange";
import VacationBlockedDateModal from "@/app/tools/vacations/_components/VacationBlockedDateModal";

// --- TIPOVI ---
type TabType = "STATS" | "REQUESTS" | "BLOCKED";

export interface BlockedDay {
  id: string;
  date: string;
  reason: string | null;
}

export interface UserStat {
  id: string;
  name: string | null;
  email?: string | null;
  /** Prisma Role – za sort hijerarhije u tablici/PDF */
  role?: string | null;
  /** RestaurantUser.vacationListOrder za aktivni restoran */
  vacationListOrder?: number;
  restaurantNames: string[];
  department: string | null;
  departmentColor?: string | null;
  allowance?: number;
  carriedOver?: number;
  total: number;
  used: number;
  remaining: number;
}

export interface RequestWithUser {
  id: string;
  start: string;
  end: string;
  days: number;
  status: string;
  note?: string | null;
  restaurantName?: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    mainRestaurant: string;
  };
}

interface AdminViewProps {
  allRequests: RequestWithUser[];
  blockedDays: BlockedDay[];
  usersStats: UserStat[];
  selectedYear: number;
  reportRestaurantLabel?: string;
  /** Prikaži dugme "Registruj Moj Godišnji" (global-scope / admin uloge u modulu) */
  canRegisterOwnVacation?: boolean;
  /** Globalni praznici za godinu (iz Admin panela) */
  globalHolidays?: { d: number; m: number }[];
  /** Link avatar/ime na admin edit korisnika (samo ako ima users:manage) */
  canLinkToAdminUserEdit?: boolean;
  /** Početni tab (STATS / REQUESTS / BLOCKED), npr. iz query parametra tab=requests */
  initialTab?: TabType;
  /** Da li je korisnik restaurant manager (ograničen UI: nema globalnog exporta). */
  isRestaurantManager?: boolean;
  /** Cookie aktivni restoran (za spremanje redoslijeda). */
  activeRestaurantId?: string | null;
  /** DnD redoslijeda: global-scope (npr. SYSTEM_ARCHITECT, ADMIN) i jedan odabran restoran. */
  canReorderVacationEmployees?: boolean;
  /** Deep link iz notifikacije: scroll/highlight retka zahtjeva */
  highlightRequestId?: string | null;
  /** ID prijavljenog korisnika – Restaurant Manager ne vidi vlastite zahtjeve u tabu ANTRÄGE */
  vacationActorUserId?: string | null;
}

const formatDate = (dateStr: string) => formatDateDDMMGGGG(dateStr);

// ===============================
// ✅ NOVO: Boje po odjelima (deterministički)
// ===============================
type RGB = [number, number, number];

// McD / enterprise-friendly paleta (nije šarena kao cirkus, ali dovoljno različita)
const DEPT_PALETTE: RGB[] = [
  [26, 56, 38], // McD dark green
  [13, 148, 136], // teal
  [37, 99, 235], // blue
  [124, 58, 237], // violet
  [219, 39, 119], // pink
  [180, 83, 9], // amber/brown
  [5, 150, 105], // emerald
  [51, 65, 85], // slate
  [22, 163, 74], // green bright
  [59, 130, 246], // blue bright
];

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function deptColor(department?: string | null): RGB {
  const dep = String(department || "").trim();
  if (!dep) return [148, 163, 184]; // slate-400 fallback
  const idx = hashString(dep.toLowerCase()) % DEPT_PALETTE.length;
  return DEPT_PALETTE[idx];
}

const BLOCKED_TAB_MONTH_NAMES = [
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
] as const;

// Boja odjela iz baze (HEX → RGB); fallback na paletu po imenu
function resolveDeptRGB(user: { department?: string | null; departmentColor?: string | null }): RGB {
  const hex = user.departmentColor?.trim();
  if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }
  return deptColor(user.department);
}

function statusLabel(s: string) {
  if (s === "APPROVED") return "Genehmigt";
  if (s === "REJECTED") return "Abgelehnt";
  if (s === "PENDING") return "Ausstehend";
  if (s === "RETURNED") return "Zur Überarbeitung";
  if (s === "CANCEL_PENDING") return "Stornierung ausstehend";
  if (s === "CANCELLED") return "Storniert";
  if (s === "COMPLETED") return "Abgeschlossen";
  return s;
}

/** Desktop red statistike – s opcionalnim DnD ručkom (samo za SortableContext). */
function SortableVacationDesktopRow({
  user: u,
  canReorder,
  canLinkToAdminUserEdit,
  onOpenPdf,
}: {
  user: UserStat;
  canReorder: boolean;
  canLinkToAdminUserEdit: boolean;
  onOpenPdf: (u: UserStat) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: u.id,
    disabled: !canReorder,
  });
  const style = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-accent/50 transition-colors"
    >
      <div className="col-span-3 flex items-center gap-2 min-w-0">
        {canReorder ? (
          <button
            type="button"
            className="touch-none p-1 rounded text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing shrink-0"
            {...attributes}
            {...listeners}
            aria-label="Reihenfolge ändern"
          >
            <GripVertical size={18} />
          </button>
        ) : null}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {canLinkToAdminUserEdit ? (
            <Link
              href={`/admin/users/${u.id}`}
              className="h-8 w-8 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-xs font-bold shrink-0 hover:ring-2 hover:ring-[#1a3826] hover:ring-offset-1 transition-all"
            >
              {(u.name || "K").charAt(0)}
            </Link>
          ) : (
            <div className="h-8 w-8 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-xs font-bold">
              {(u.name || "K").charAt(0)}
            </div>
          )}
          <div>
            {canLinkToAdminUserEdit ? (
              <Link href={`/admin/users/${u.id}`} className="font-bold text-sm text-foreground hover:underline hover:text-[#1a3826]">
                {u.name}
              </Link>
            ) : (
              <div className="font-bold text-sm text-foreground">{u.name}</div>
            )}
            <div className="text-[10px] text-muted-foreground uppercase">{u.department}</div>
          </div>
        </div>
      </div>
      <div className="col-span-3 flex flex-wrap gap-1">
        {u.restaurantNames.map((r, i) => (
          <span key={i} className="text-[9px] bg-muted px-2 py-1 rounded border border-border">
            {r}
          </span>
        ))}
      </div>
      <div className="col-span-4 grid grid-cols-4 text-center font-bold text-sm">
        <span className="text-muted-foreground">{u.carriedOver ?? 0}</span>
        <span className="text-muted-foreground">{u.total}</span>
        <span className="text-green-600">{u.used}</span>
        <span className="text-orange-500">{u.remaining}</span>
      </div>
      <div className="col-span-2 text-right">
        <button
          type="button"
          onClick={() => onOpenPdf(u)}
          className="bg-[#1a3826] hover:bg-[#142e1e] text-white px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-2 text-[10px] font-bold uppercase min-h-[44px]"
        >
          <FileText size={14} /> PDF
        </button>
      </div>
    </div>
  );
}

// ===============================
// PDF header: AIW Services, ispod njega restoran (manji), zatim Urlaubsübersicht; desno samo godina u bijelom boxu. Adresa se ne prikazuje.
// ===============================
function drawPdfHeader(
  doc: jsPDF,
  opts: {
    title: string;
    subtitle?: string;
    restaurantName?: string;
    year?: number;
    headerHeight?: number;
  }
) {
  const pageW = doc.internal.pageSize.getWidth();
  const headerHeight = opts.headerHeight ?? 38;
  doc.setFillColor(26, 56, 38);
  doc.rect(0, 0, pageW, headerHeight, "F");

  let y = 12;
  doc.setTextColor(255, 199, 44);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("AIW Services", 14, y);
  y += 10;

  if (opts.restaurantName) {
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(String(opts.restaurantName).trim() || "–", 14, y);
    y += 7;
  }

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.text(typeof opts.title === "string" ? opts.title : "", 14, y);
  y += 6;

  if (opts.year != null) {
    const yearStr = String(opts.year);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    const textW = doc.getTextWidth(yearStr);
    const padding = 6;
    const boxW = textW + padding * 2;
    const boxH = 16;
    const boxX = pageW - 14 - boxW;
    const boxY = (headerHeight - boxH) / 2;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, "F");
    doc.setTextColor(26, 56, 38);
    doc.text(yearStr, boxX + boxW / 2, boxY + boxH / 2 + 2, { align: "center" });
  }
}

// --- Exportirane PDF funkcije za view stranice (sve podatke primaju kao argumente) ---
export function exportTablePDFWithData(
  stats: UserStat[],
  year: number,
  reportRestaurantLabel?: string,
  /**
   * Ako je true, funkcija ne otvara PDF sama već vraća jsPDF instancu
   * (koristi se za popup prikaz).
   */
  returnDoc?: boolean
): jsPDF | void {
  const doc = new jsPDF();
  drawPdfHeader(doc, {
    title: "Urlaubsübersicht",
    subtitle: reportRestaurantLabel || undefined,
    restaurantName: reportRestaurantLabel,
    year,
    headerHeight: 38,
  });
  const restaurantDisplay = (names: string[]) =>
    names.length > 2 ? "Alle Restaurants" : names.join(", ");
  const data = stats.map((u) => [
    u.name || "N/A",
    (u.department || "N/A").toString(),
    restaurantDisplay(u.restaurantNames),
    u.carriedOver ?? 0,
    u.total,
    u.used,
    u.remaining,
  ]);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const tableWidth = pageWidth - margin * 2;
  autoTable(doc, {
    startY: 50,
    head: [["Name", "Abteilung", "Restaurants", "Vortrag", "Gesamt", "Verbraucht", "Resturlaub"]],
    body: data,
    theme: "plain",
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [15, 23, 42],
      overflow: "linebreak",
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      halign: "center",
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
      fontSize: 8,
      overflow: "linebreak",
      cellPadding: 3,
    },
    bodyStyles: {
      fillColor: false,
      textColor: [15, 23, 42],
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold", cellWidth: tableWidth * 0.22 },
      1: { halign: "center", cellWidth: tableWidth * 0.12 },
      2: { halign: "left", cellWidth: tableWidth * 0.18 },
      3: { halign: "center", cellWidth: tableWidth * 0.13 },
      4: { halign: "center", cellWidth: tableWidth * 0.09 },
      5: { halign: "center", cellWidth: tableWidth * 0.14 },
      6: { halign: "center", cellWidth: tableWidth * 0.12 },
    },
    alternateRowStyles: { fillColor: [252, 253, 254] },
    margin: { left: margin, right: margin },
  });
  if (returnDoc) {
    return doc;
  }
  openPdfInSameTab(doc);
}

export function exportIndividualReportWithData(
  user: UserStat,
  allRequests: RequestWithUser[],
  year: number,
  returnDoc?: boolean
): jsPDF | void {
  const doc = new jsPDF();
  const userRequests = allRequests.filter((r) => r.user.id === user.id);

  // Gornji brending header (AIW Services + godina) ostaje isti
  drawPdfHeader(doc, {
    title: "Urlaubsübersicht",
    subtitle: `Erstellt: ${formatDate(new Date().toISOString())}`,
    restaurantName: user.restaurantNames?.[0] ?? undefined,
    year,
  });

  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const contentWidth = pageW - margin * 2;

  // --- INFO + STAT KARTICA (modernija, nije više centrirana u sred stranice) ---
  const cardTop = 46;
  const cardHeight = 34;
  const cardPaddingX = 10;
  const cardPaddingY = 7;

  doc.setFillColor(248, 250, 252); // bg-slate-50
  doc.setDrawColor(226, 232, 240); // border-slate-200
  doc.roundedRect(margin, cardTop, contentWidth, cardHeight, 4, 4, "FD");

  // Lijeva strana: podaci o zaposleniku
  const textX = margin + cardPaddingX;
  let textY = cardTop + cardPaddingY + 2;

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(user.name || "N/A", textX, textY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  textY += 6;
  doc.text(`E-Mail: ${user.email || "N/A"}`, textX, textY);
  textY += 5;
  doc.text(`Abteilung: ${user.department || "N/A"}`, textX, textY);

  // Desna strana: tri mala statistička boxa u jednoj liniji
  const statsLabelFontSize = 6;
  const statsValueFontSize = 11;
  const statsBoxWidth = 30;
  const statsBoxHeight = 16;
  const statsBoxGap = 4;
  const statsTotalWidth = statsBoxWidth * 3 + statsBoxGap * 2;
  const statsStartX = margin + contentWidth - cardPaddingX - statsTotalWidth;
  const statsY = cardTop + cardPaddingY + 1;
  const statsBg: [number, number, number] = [26, 56, 38]; // McD green

  const drawStatBox = (x: number, label: string, value: string | number) => {
    doc.setFillColor(...statsBg);
    doc.setDrawColor(...statsBg);
    doc.roundedRect(x, statsY, statsBoxWidth, statsBoxHeight, 2, 2, "FD");

    const centerX = x + statsBoxWidth / 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(statsLabelFontSize);
    doc.setTextColor(255, 255, 255);
    doc.text(label, centerX, statsY + 5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(statsValueFontSize);
    doc.setTextColor(255, 255, 255);
    doc.text(String(value), centerX, statsY + 12, { align: "center" });
  };

  drawStatBox(statsStartX, "GESAMT", user.total);
  drawStatBox(statsStartX + statsBoxWidth + statsBoxGap, "VERBRAUCHT", user.used);
  drawStatBox(statsStartX + (statsBoxWidth + statsBoxGap) * 2, "RESTURLAUB", user.remaining);

  const tableBody = userRequests.map((req) => [
    formatDate(req.start),
    formatDate(req.end),
    req.days,
    statusLabel(req.status),
  ]);

  const tableWidth = contentWidth;

  // --- Tabela: Von / Bis / Tage / Status ---
  // Zaobljeni žuti header ispod kartice
  const headerTop = cardTop + cardHeight + 14;
  const headerHeight = 9;

  // Žuta pozadina sa zaobljenim gornjim uglovima
  doc.setFillColor(255, 199, 44); // AIW yellow
  doc.setDrawColor(255, 199, 44);
  doc.roundedRect(margin, headerTop, tableWidth, headerHeight, 3, 3, "F");

  const tableStartY = headerTop + 2; // niži offset – ukupno niži header

  autoTable(doc, {
    startY: tableStartY,
    head: [["Von", "Bis", "Tage", "Status"]],
    body: tableBody,
    theme: "plain",
    styles: {
      fontSize: 10,
      cellPadding: 5,
      textColor: [15, 23, 42],
      lineWidth: 0.1,
      lineColor: [229, 231, 235], // light grid
      halign: "center",
    },
    headStyles: {
      // Žuti header sa crnim, boldiranim slovima
      fillColor: [255, 199, 44], // AIW yellow
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      lineWidth: 0,
      lineColor: [255, 199, 44],
    },
    bodyStyles: {
      lineWidth: 0.1,
      lineColor: [229, 231, 235],
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: tableWidth * 0.28 },
      1: { halign: "center", cellWidth: tableWidth * 0.28 },
      2: { halign: "center", cellWidth: tableWidth * 0.14 },
      3: { halign: "center", cellWidth: tableWidth * 0.30 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      const hook = data as { section: string; column: { index: number }; cell: { raw: string; styles: { textColor?: number[] } } };
      if (hook.section === "body" && hook.column.index === 3) {
        const raw = String(hook.cell.raw ?? "");
        if (raw === "Genehmigt") hook.cell.styles.textColor = [22, 163, 74];
        else if (raw === "Abgelehnt") hook.cell.styles.textColor = [220, 38, 38];
      }
    },
  });
  const safeName = (user.name || "Benutzer")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "_");

  if (returnDoc) {
    return doc;
  }

  openPdfInSameTab(doc);
}

/** Datumi praznika za crvenu liniju: niz ISO stringova (YYYY-MM-DD) ili iz BlockedDay. */
function holidayDatesFromBlockedDays(blockedDays: BlockedDay[], year: number): string[] {
  return blockedDays
    .filter((d) => new Date(d.date).getFullYear() === year)
    .map((d) => d.date);
}

export function exportTimelinePDFWithData(
  stats: UserStat[],
  requests: RequestWithUser[],
  blockedDays: BlockedDay[],
  year: number,
  reportRestaurantLabel?: string,
  filename?: string,
  /** Ako proslijeđeno, koristi se za crvenu liniju (Feiertag); inače blockedDays */
  holidayDates?: string[],
  /**
   * Ako je true, funkcija samo vraća jsPDF instancu (za popup),
   * umjesto da odmah otvori novi tab.
   */
  returnDoc?: boolean
): jsPDF | void {
  const datesForRedLine = holidayDates ?? holidayDatesFromBlockedDays(blockedDays, year);
  const doc = new jsPDF("l", "mm", "a3");
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const marginLeft = 62;
  const marginRight = 14;
  const marginBottom = 18;
  const gridWidth = width - marginLeft - marginRight;
  const monthWidth = gridWidth / 12;
  const rowHeight = 9;
  drawPdfHeader(doc, {
    title: "Übersichtsplan und Verteilung",
    subtitle: reportRestaurantLabel || undefined,
    year,
    headerHeight: 42,
  });
  const contentStartY = 58;
  const months = MONTH_ABBREVS_DE_AT;
  doc.setFillColor(248, 250, 252);
  doc.rect(marginLeft, contentStartY - 12, gridWidth, 12, "F");
  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  months.forEach((m, i) => {
    const x = marginLeft + i * monthWidth;
    doc.text(m, x + monthWidth / 2, contentStartY - 5, { align: "center" });
  });
  const gridColor: [number, number, number] = [203, 213, 225];
  const gridLineWidth = 0.25;
  let currentY = contentStartY;
  const nameColumnLeft = 10;
  const drawRowSeparator = (y: number) => {
    doc.setDrawColor(...gridColor);
    doc.setLineWidth(gridLineWidth);
    doc.line(nameColumnLeft, y, width - marginRight, y);
  };
  const drawVerticalGridLines = (rowTop: number, rowBottom: number) => {
    doc.setDrawColor(...gridColor);
    doc.setLineWidth(gridLineWidth);
    for (let i = 0; i <= 12; i++) {
      const x = marginLeft + i * monthWidth;
      doc.line(x, rowTop, x, rowBottom);
    }
  };
  stats.forEach((user) => {
    if (currentY > height - marginBottom) {
      doc.addPage();
      drawPdfHeader(doc, {
        title: "Übersichtsplan und Verteilung",
        subtitle: reportRestaurantLabel || undefined,
        year,
        headerHeight: 42,
      });
      doc.setFillColor(248, 250, 252);
      doc.rect(marginLeft, contentStartY - 12, gridWidth, 12, "F");
      doc.setTextColor(51, 65, 85);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      months.forEach((m, i) => {
        const x = marginLeft + i * monthWidth;
        doc.text(m, x + monthWidth / 2, contentStartY - 5, { align: "center" });
      });
      currentY = contentStartY;
    }
    doc.setDrawColor(...gridColor);
    doc.setLineWidth(gridLineWidth);
    doc.line(nameColumnLeft, currentY, nameColumnLeft, currentY + rowHeight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(user.name || "N/A", 12, currentY + 6);
    drawVerticalGridLines(currentY, currentY + rowHeight);
    drawRowSeparator(currentY + rowHeight);
    const userRequests = requests.filter((r) => r.user.id === user.id && r.status === "APPROVED");
    const depRGB = resolveDeptRGB(user);
    userRequests.forEach((req) => {
      const start = new Date(req.start);
      const end = new Date(req.end);
      if (start.getFullYear() !== year) return;
      const startX = marginLeft + start.getMonth() * monthWidth + (start.getDate() / 31) * monthWidth;
      const endX = marginLeft + end.getMonth() * monthWidth + (end.getDate() / 31) * monthWidth;
      const barW = Math.max(endX - startX, 2);
      doc.setFillColor(depRGB[0], depRGB[1], depRGB[2]);
      doc.rect(startX, currentY + 2, barW, rowHeight - 4, "F");
      datesForRedLine.forEach((dateStr) => {
        const bDate = new Date(dateStr);
        if (bDate >= start && bDate <= end && bDate.getFullYear() === year) {
          const holidayX = marginLeft + bDate.getMonth() * monthWidth + (bDate.getDate() / 31) * monthWidth;
          doc.setDrawColor(220, 38, 38);
          doc.setLineWidth(0.5);
          doc.line(holidayX, currentY + 2, holidayX, currentY + rowHeight - 2);
        }
      });
    });
    currentY += rowHeight;
  });
  const deptMap = new Map<string, { name: string; rgb: RGB }>();
  stats.forEach((u) => {
    const name = u.department?.trim() || "N/A";
    if (!deptMap.has(name)) deptMap.set(name, { name, rgb: resolveDeptRGB(u) });
  });
  const deptLegendItems = Array.from(deptMap.values());
  let legendY = currentY + 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Rote Linie = Feiertag innerhalb des Urlaubs.", 15, legendY);
  legendY += 10;
  const boxW = 5;
  const boxH = 3.5;
  const gap = 2;
  const itemGap = 28;
  let legendX = 15;
  deptLegendItems.forEach((item) => {
    const label = item.name;
    const labelW = doc.getTextWidth(label);
    if (legendX + boxW + gap + labelW > width - marginRight) {
      legendY += 6;
      legendX = 15;
    }
    doc.setFillColor(item.rgb[0], item.rgb[1], item.rgb[2]);
    doc.rect(legendX, legendY - boxH, boxW, boxH, "F");
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.rect(legendX, legendY - boxH, boxW, boxH, "S");
    doc.setTextColor(15, 23, 42);
    doc.text(label, legendX + boxW + gap, legendY - 0.5);
    legendX += boxW + gap + labelW + itemGap;
  });

  if (returnDoc) {
    return doc;
  }

  openPdfInSameTab(doc);
}

export default function AdminView({
  allRequests,
  blockedDays,
  usersStats,
  selectedYear,
  reportRestaurantLabel,
  canRegisterOwnVacation = false,
  globalHolidays: globalHolidaysProp = [],
  canLinkToAdminUserEdit = false,
  initialTab,
  isRestaurantManager = false,
  activeRestaurantId = null,
  canReorderVacationEmployees = false,
  highlightRequestId = null,
  vacationActorUserId = null,
}: AdminViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab ?? "STATS");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "RETURNED" | "CANCEL_PENDING" | "CANCELLED"
  >("ALL");
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");
  /** Filter „BLOCKED“ taba: svi mjeseci ili 1–12 */
  const [blockedListMonth, setBlockedListMonth] = useState<"all" | number>("all");

  const handleAddBlocked = async () => {
    if (!newBlockedDate.trim()) {
      toast.error("Datum wählen.");
      return;
    }
    try {
      await addBlockedDay(newBlockedDate, newBlockedReason.trim() || "Gesperrt");
      toast.success("Gesperrter Tag hinzugefügt.");
      setNewBlockedDate("");
      setNewBlockedReason("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern.");
    }
  };

  const handleRemoveBlockedGroup = async (ids: string[]) => {
    const msg =
      ids.length > 1
        ? `${ids.length} Einträge für dieses Datum wirklich löschen?`
        : "Eintrag wirklich löschen?";
    if (!confirm(msg)) return;
    try {
      for (const id of ids) {
        await removeBlockedDay(id);
      }
      toast.success("Gelöscht.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen.");
    }
  };

  const handleYearChange = (y: number) => {
    if (y === selectedYear) return;
    startTransition(() => {
      router.push(`/tools/vacations?year=${y}`);
    });
  };

  const globalHolidays = globalHolidaysProp ?? [];

  const holidaysForBlockedTab = useMemo(() => {
    if (blockedListMonth === "all") return globalHolidays;
    return globalHolidays.filter((h) => h.m === blockedListMonth);
  }, [globalHolidays, blockedListMonth]);

  const blockedDayGroupsForTab = useMemo(() => {
    const inYear = blockedDays.filter((d) => new Date(d.date).getFullYear() === selectedYear);
    const inMonth =
      blockedListMonth === "all"
        ? inYear
        : inYear.filter((d) => new Date(d.date).getMonth() + 1 === blockedListMonth);
    const map = new Map<string, BlockedDay[]>();
    for (const d of inMonth) {
      const k = `${d.date}|${(d.reason ?? "").trim()}`;
      const arr = map.get(k) ?? [];
      arr.push(d);
      map.set(k, arr);
    }
    return Array.from(map.entries())
      .map(([key, entries]) => ({
        key,
        date: entries[0].date,
        reason: entries[0].reason,
        ids: entries.map((e) => e.id),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [blockedDays, selectedYear, blockedListMonth]);

  const [deptExportModalOpen, setDeptExportModalOpen] = useState(false);
  const [deptExportData, setDeptExportData] = useState<{
    usersStats: UserStat[];
    allRequests: RequestWithUser[];
  } | null>(null);
  const [loadingDeptExport, setLoadingDeptExport] = useState(false);
  const [selectedDeptNamesForExport, setSelectedDeptNamesForExport] = useState<string[]>([]);

  // Modal: Registruj Moj Godišnji (self-service za admine)
  const [myVacationModalOpen, setMyVacationModalOpen] = useState(false);
  const [myVacationStart, setMyVacationStart] = useState("");
  const [myVacationEnd, setMyVacationEnd] = useState("");
  const [myVacationNote, setMyVacationNote] = useState("");
  const [myVacationSubmitting, setMyVacationSubmitting] = useState(false);
  const [myVacationBlockedModalOpen, setMyVacationBlockedModalOpen] = useState(false);
  const [myVacationBlockedDetail, setMyVacationBlockedDetail] = useState<{
    dateDe: string;
    reason: string | null;
  } | null>(null);

  // Provjera ima li zahtjeva na čekanju (za crvenu notifikaciju)
  const hasPendingRequests = useMemo(() => {
    const list =
      isRestaurantManager && vacationActorUserId
        ? allRequests.filter((r) => r.user.id !== vacationActorUserId)
        : allRequests;
    return list.some((r) => r.status === "PENDING" || r.status === "CANCEL_PENDING");
  }, [allRequests, isRestaurantManager, vacationActorUserId]);

  // --- FILTERI ---
  const filteredStats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = usersStats.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const dep = (u.department || "").toLowerCase();
      const rest = (u.restaurantNames || []).join(" ").toLowerCase();
      return !q || name.includes(q) || dep.includes(q) || rest.includes(q);
    });
    return sortUserStatsForVacationTable(filtered);
  }, [usersStats, searchQuery]);

  const usersStatsOrderSig = useMemo(
    () => usersStats.map((u) => `${u.id}:${u.vacationListOrder ?? 0}`).join("|"),
    [usersStats]
  );
  const [optimisticVacationOrder, setOptimisticVacationOrder] = useState<string[] | null>(null);
  useEffect(() => {
    setOptimisticVacationOrder(null);
  }, [usersStatsOrderSig]);

  const enableVacationDnD =
    canReorderVacationEmployees === true &&
    !!activeRestaurantId &&
    activeRestaurantId !== "all" &&
    !searchQuery.trim();

  const statsForTable = useMemo(() => {
    if (!enableVacationDnD || !optimisticVacationOrder?.length) return filteredStats;
    const byId = new Map(filteredStats.map((u) => [u.id, u]));
    const ordered: UserStat[] = [];
    const seen = new Set<string>();
    for (const id of optimisticVacationOrder) {
      const u = byId.get(id);
      if (u) {
        ordered.push(u);
        seen.add(id);
      }
    }
    for (const u of filteredStats) {
      if (!seen.has(u.id)) ordered.push(u);
    }
    return ordered;
  }, [filteredStats, optimisticVacationOrder, enableVacationDnD]);

  /** ANTRÄGE: Restaurant Manager ne vidi vlastite zahtjeve (ostaju u Mein Urlaub / self view). */
  const allRequestsForAntraegeTab = useMemo(() => {
    if (!isRestaurantManager || !vacationActorUserId) return allRequests;
    return allRequests.filter((r) => r.user.id !== vacationActorUserId);
  }, [allRequests, isRestaurantManager, vacationActorUserId]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRequestsForAntraegeTab.filter((req) => {
      const name = (req.user.name || "").toLowerCase();
      const rest = (req.user.mainRestaurant || "").toLowerCase();
      const matchesSearch = !q || name.includes(q) || rest.includes(q);

      const matchesStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "PENDING"
          ? req.status === "PENDING"
          : statusFilter === "RETURNED"
          ? req.status === "RETURNED"
          : statusFilter === "CANCEL_PENDING"
          ? req.status === "CANCEL_PENDING"
          : statusFilter === "CANCELLED"
          ? req.status === "CANCELLED"
          : statusFilter === "APPROVED"
          ? req.status === "APPROVED"
          : statusFilter === "REJECTED"
          ? req.status === "REJECTED"
          : true;

      return matchesSearch && matchesStatus;
    });
  }, [allRequestsForAntraegeTab, searchQuery, statusFilter]);

  // --- AKCIJE ---
  const handleStatus = async (
    id: string,
    status: "APPROVED" | "REJECTED" | "RETURNED" | "CANCELLED" | "PENDING"
  ) => {
    const messages: Record<string, string> = {
      APPROVED: "Diesen Antrag genehmigen?",
      REJECTED: "Diesen Antrag ablehnen?",
      RETURNED: "Antrag zur Überarbeitung an den Mitarbeiter zurücksenden?",
      CANCELLED: "Stornierung des Urlaubs genehmigen? Die Tage werden dem Mitarbeiter wieder gutgeschrieben.",
      PENDING: "Antrag wieder auf „Ausstehend“ setzen?",
    };

    let comment: string | undefined = undefined;
    if (status === "REJECTED" || status === "RETURNED") {
      const input = window.prompt(
        "Unesite razlog (vidi ga radnik u svojim zahtjevima):",
        ""
      );
      if (input === null) {
        return; // user cancelled
      }
      comment = input.trim();
    } else if (status === "PENDING") {
      // čišćenje prethodnog razloga
      comment = "";
    }

    if (confirm(messages[status])) {
      await updateVacationStatus(id, status, comment);
      toast.success(
        status === "APPROVED"
          ? "Antrag genehmigt."
          : status === "REJECTED"
            ? "Antrag abgelehnt."
            : status === "CANCELLED"
              ? "Stornierung genehmigt."
              : "Status aktualisiert."
      );
      router.refresh();
    }
  };

  const handleDeleteApproved = async (id: string) => {
    if (
      !confirm(
        "Genehmigten Urlaub wirklich löschen? Die Urlaubstage werden dem Mitarbeiter wieder gutgeschrieben."
      )
    ) {
      return;
    }
    try {
      await deleteApprovedVacationAsApprover(id);
      toast.success("Antrag gelöscht. Urlaubstage wurden gutgeschrieben.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen.");
    }
  };

  useEffect(() => {
    if (!highlightRequestId || activeTab !== "REQUESTS") return;

    const rid = highlightRequestId;
    const timer = window.setTimeout(() => {
      const safe =
        typeof window !== "undefined" && typeof window.CSS?.escape === "function"
          ? window.CSS.escape(rid)
          : rid.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const el = document.querySelector(`[data-vacation-request-id="${safe}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-[#ffc72c]", "ring-offset-2", "rounded-lg", "transition-shadow");
        window.setTimeout(() => {
          el.classList.remove(
            "ring-2",
            "ring-[#ffc72c]",
            "ring-offset-2",
            "rounded-lg",
            "transition-shadow"
          );
        }, 4500);
      }

      try {
        const params = new URLSearchParams(window.location.search);
        if (params.has("requestId")) {
          params.delete("requestId");
          const qs = params.toString();
          router.replace(qs ? `/tools/vacations?${qs}` : "/tools/vacations", { scroll: false });
          router.refresh();
        }
      } catch {
        /* ignore */
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [highlightRequestId, activeTab, router]);

  // =====================================================================
  // 1. POJEDINAČNI IZVJEŠTAJ (ZA JEDNOG RADNIKA) — CLEAN + boja po odjelu
  // =====================================================================
  const exportIndividualReport = (user: UserStat): jsPDF | null => {
    const doc = exportIndividualReportWithData(
      user,
      allRequests as RequestWithUser[],
      selectedYear,
      true
    );
    return (doc as jsPDF) ?? null;
  };

  const openEmployeePdf = (u: UserStat) => {
    const doc = exportIndividualReport(u);
    if (!doc) return;
    const url = pdfToBlobUrl(doc);
    setPdfPopupTitle(`Urlaubsbericht ${selectedYear} – ${u.name || ""}`);
    setPdfPopupUrl(url);
  };

  const reorderSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleVacationDragEnd = async (event: DragEndEvent) => {
    if (!activeRestaurantId || activeRestaurantId === "all") return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = statsForTable.findIndex((x) => x.id === active.id);
    const newIndex = statsForTable.findIndex((x) => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newIds = arrayMove(
      statsForTable.map((x) => x.id),
      oldIndex,
      newIndex
    );
    setOptimisticVacationOrder(newIds);
    try {
      await saveVacationEmployeeSortOrder(activeRestaurantId, newIds);
      toast.success("Reihenfolge gespeichert.");
      router.refresh();
    } catch (e) {
      setOptimisticVacationOrder(null);
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern.");
    }
  };

  // =====================================================================
  // 2. TABLIČNI PDF — clean, bez boja, linije samo za redove s korisnicima
  // =====================================================================
  const exportTablePDF = (overrideStats?: UserStat[]): jsPDF => {
    const statsToUse = overrideStats ?? statsForTable;

    const doc = new jsPDF();
    drawPdfHeader(doc, {
      title: "Urlaubsübersicht",
      subtitle: reportRestaurantLabel || undefined,
      restaurantName: reportRestaurantLabel,
      year: selectedYear,
      headerHeight: 38,
    });

    const restaurantDisplay = (names: string[]) =>
      names.length > 2 ? "Alle Restaurants" : names.join(", ");

    const data = statsToUse.map((u) => [
      u.name || "N/A",
      (u.department || "N/A").toString(),
      restaurantDisplay(u.restaurantNames),
      u.carriedOver ?? 0,
      u.total,
      u.used,
      u.remaining,
    ]);

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const tableWidth = pageWidth - margin * 2;
    autoTable(doc, {
      startY: 50,
      head: [["Name", "Abteilung", "Restaurants", "Vortrag", "Gesamt", "Verbraucht", "Resturlaub"]],
      body: data,
      theme: "plain",
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [15, 23, 42],
        overflow: "linebreak",
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [15, 23, 42],
        fontStyle: "bold",
        halign: "center",
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
        fontSize: 8,
        overflow: "linebreak",
        cellPadding: 3,
      },
      bodyStyles: {
        fillColor: false,
        textColor: [15, 23, 42],
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold", cellWidth: tableWidth * 0.22 },
        1: { halign: "center", cellWidth: tableWidth * 0.12 },
        2: { halign: "left", cellWidth: tableWidth * 0.18 },
        3: { halign: "center", cellWidth: tableWidth * 0.13 },
        4: { halign: "center", cellWidth: tableWidth * 0.09 },
        5: { halign: "center", cellWidth: tableWidth * 0.14 },
        6: { halign: "center", cellWidth: tableWidth * 0.12 },
      },
      alternateRowStyles: { fillColor: [252, 253, 254] },
      margin: { left: margin, right: margin },
    });

    return doc;
  };

  // =====================================================================
  // 3. VIZUALNI TIMELINE — CLEAN + boje po odjelu
  // =====================================================================
  const exportTimelinePDF = (
    overrideStats?: UserStat[],
    overrideRequests?: RequestWithUser[],
    filename?: string
  ): jsPDF => {
    const statsToUse = overrideStats ?? statsForTable;
    const requestsToUse = overrideRequests || allRequests;

    const doc = new jsPDF("l", "mm", "a3");
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    const marginLeft = 62;
    const marginRight = 14;
    const marginBottom = 18;

    const gridWidth = width - marginLeft - marginRight;
    const monthWidth = gridWidth / 12;
    const rowHeight = 9; // malo kompaktnije i “clean”

    drawPdfHeader(doc, {
      title: "Übersichtsplan und Verteilung",
      subtitle: reportRestaurantLabel || undefined,
      year: selectedYear,
      headerHeight: 42,
    });

    const contentStartY = 58;
    const months = MONTH_ABBREVS_DE_AT;

    // header za mjesece – ispod zelenog headera s razmakom
    doc.setFillColor(248, 250, 252);
    doc.rect(marginLeft, contentStartY - 12, gridWidth, 12, "F");
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    months.forEach((m, i) => {
      const x = marginLeft + i * monthWidth;
      doc.text(m, x + monthWidth / 2, contentStartY - 5, { align: "center" });
    });

    const gridColor: [number, number, number] = [203, 213, 225];
    const gridLineWidth = 0.25;

    let currentY = contentStartY;
    const nameColumnLeft = 10;

    const drawRowSeparator = (y: number) => {
      doc.setDrawColor(...gridColor);
      doc.setLineWidth(gridLineWidth);
      doc.line(nameColumnLeft, y, width - marginRight, y);
    };

    const drawVerticalGridLines = (rowTop: number, rowBottom: number) => {
      doc.setDrawColor(...gridColor);
      doc.setLineWidth(gridLineWidth);
      for (let i = 0; i <= 12; i++) {
        const x = marginLeft + i * monthWidth;
        doc.line(x, rowTop, x, rowBottom);
      }
    };

    statsToUse.forEach((user) => {
      if (currentY > height - marginBottom) {
        doc.addPage();
        drawPdfHeader(doc, {
          title: "Übersichtsplan und Verteilung",
          subtitle: reportRestaurantLabel || undefined,
          year: selectedYear,
          headerHeight: 42,
        });

        // ponovi mjesec header na novoj stranici
        doc.setFillColor(248, 250, 252);
        doc.rect(marginLeft, contentStartY - 12, gridWidth, 12, "F");
        doc.setTextColor(51, 65, 85);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);

        months.forEach((m, i) => {
          const x = marginLeft + i * monthWidth;
          doc.text(m, x + monthWidth / 2, contentStartY - 5, { align: "center" });
        });

        currentY = contentStartY;
      }

      doc.setDrawColor(...gridColor);
      doc.setLineWidth(gridLineWidth);
      doc.line(nameColumnLeft, currentY, nameColumnLeft, currentY + rowHeight);

      // Ime zaposlenika (lijevo od mreže)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(user.name || "N/A", 12, currentY + 6);

      // Vertikalne linije za ovaj red (stupci mjeseci) – unutar okvira
      drawVerticalGridLines(currentY, currentY + rowHeight);
      drawRowSeparator(currentY + rowHeight);

      // --- GODIŠNJI BAROVI (odobreni) — pravougaonici, boja iz baze (odjel)
      const userRequests = requestsToUse.filter((r) => r.user.id === user.id && r.status === "APPROVED");
      const depRGB = resolveDeptRGB(user);

      userRequests.forEach((req) => {
        const start = new Date(req.start);
        const end = new Date(req.end);

        if (start.getFullYear() !== selectedYear) return;

        const startX =
          marginLeft +
          start.getMonth() * monthWidth +
          (start.getDate() / 31) * monthWidth;

        const endX =
          marginLeft +
          end.getMonth() * monthWidth +
          (end.getDate() / 31) * monthWidth;

        const barW = Math.max(endX - startX, 2);

        // bar: pravougaonik (oštri uglovi), boja odjela iz baze
        doc.setFillColor(depRGB[0], depRGB[1], depRGB[2]);
        doc.rect(startX, currentY + 2, barW, rowHeight - 4, "F");

        // praznici unutar bara: tanka crvena linija (globalni praznici iz Admin)
        const holidayDatesForPdf = globalHolidays.map(
          (h) => `${selectedYear}-${String(h.m).padStart(2, "0")}-${String(h.d).padStart(2, "0")}`
        );
        holidayDatesForPdf.forEach((dateStr) => {
          const bDate = new Date(dateStr);
          if (bDate >= start && bDate <= end && bDate.getFullYear() === selectedYear) {
            const holidayX =
              marginLeft +
              bDate.getMonth() * monthWidth +
              (bDate.getDate() / 31) * monthWidth;

            doc.setDrawColor(220, 38, 38);
            doc.setLineWidth(0.5);
            doc.line(holidayX, currentY + 2, holidayX, currentY + rowHeight - 2);
          }
        });
      });

      currentY += rowHeight;
    });

    // Legenda na dnu: jedinstveni odjeli s bojama (pravougaonik + "Boja – Naziv odjela")
    const deptMap = new Map<string, { name: string; rgb: RGB }>();
    statsToUse.forEach((u) => {
      const name = u.department?.trim() || "N/A";
      if (!deptMap.has(name)) {
        deptMap.set(name, { name, rgb: resolveDeptRGB(u) });
      }
    });
    const deptLegendItems = Array.from(deptMap.values());

    let legendY = currentY + 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Rote Linie = Feiertag innerhalb des Urlaubs.", 15, legendY);

    legendY += 10;
    const boxW = 5;
    const boxH = 3.5;
    const gap = 2;
    const itemGap = 28;
    let legendX = 15;
    deptLegendItems.forEach((item) => {
      const label = item.name;
      const labelW = doc.getTextWidth(label);
      if (legendX + boxW + gap + labelW > width - marginRight) {
        legendY += 6;
        legendX = 15;
      }
      doc.setFillColor(item.rgb[0], item.rgb[1], item.rgb[2]);
      doc.rect(legendX, legendY - boxH, boxW, boxH, "F");
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.rect(legendX, legendY - boxH, boxW, boxH, "S");
      doc.setTextColor(15, 23, 42);
      doc.text(label, legendX + boxW + gap, legendY - 0.5);
      legendX += boxW + gap + labelW + itemGap;
    });

    return doc;
  };

  const [pdfPopupUrl, setPdfPopupUrl] = useState<string | null>(null);
  const [pdfPopupTitle, setPdfPopupTitle] = useState<string>("");

  const closePdfPopup = () => {
    if (pdfPopupUrl) {
      URL.revokeObjectURL(pdfPopupUrl);
    }
    setPdfPopupUrl(null);
    setPdfPopupTitle("");
  };

  const handleGlobalExport = async () => {
    setLoadingGlobal(true);
    try {
      const globalData = await getGlobalVacationStats(selectedYear);
      const doc = exportTimelinePDF(globalData.usersStats, globalData.allRequests as any);
      const url = pdfToBlobUrl(doc);
      setPdfPopupTitle(`Gesamt Export ${selectedYear}`);
      setPdfPopupUrl(url);
    } catch {
      alert("Fehler beim Laden der globalen Daten.");
    } finally {
      setLoadingGlobal(false);
    }
  };

  const handleOpenDeptExportModal = async () => {
    setLoadingDeptExport(true);
    setDeptExportModalOpen(false);
    try {
      const globalData = await getGlobalVacationStats(selectedYear);
      setDeptExportData(globalData);
      setSelectedDeptNamesForExport([]);
      setDeptExportModalOpen(true);
    } catch {
      alert("Fehler beim Abrufen der Exportdaten nach Abteilungen.");
    } finally {
      setLoadingDeptExport(false);
    }
  };

  const uniqueDeptNames = useMemo(() => {
    if (!deptExportData?.usersStats) return [];
    const names = new Set(
      deptExportData.usersStats.map((u) => (u.department?.trim() || "N/A"))
    );
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [deptExportData]);

  const toggleDeptForExport = (name: string) => {
    setSelectedDeptNamesForExport((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleDeptExportPDF = () => {
    if (!deptExportData || selectedDeptNamesForExport.length === 0) {
      alert("Bitte wählen Sie mindestens eine Abteilung.");
      return;
    }
    const deptSet = new Set(selectedDeptNamesForExport);
    const filteredStats = sortUserStatsForVacationTable(
      deptExportData.usersStats.filter((u) => deptSet.has(u.department?.trim() || "N/A"))
    );
    const filteredUserIds = new Set(filteredStats.map((u) => u.id));
    const filteredRequests = deptExportData.allRequests.filter((r) =>
      filteredUserIds.has(r.user.id)
    );
    const safeNames = selectedDeptNamesForExport.map((n) => n.replace(/\s+/g, "_"));
    const doc = exportTimelinePDF(
      filteredStats,
      filteredRequests as any,
      `Plan_${selectedYear}_${safeNames.join("_")}.pdf`
    );
    const url = pdfToBlobUrl(doc);
    setPdfPopupTitle(`Export nach Abteilungen ${selectedYear}`);
    setPdfPopupUrl(url);
    setDeptExportModalOpen(false);
    setDeptExportData(null);
  };

  const handleSubmitMyVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = myVacationStart.trim();
    const end = myVacationEnd.trim();
    if (!start || !end) {
      alert("Bitte wählen Sie Von- und Bis-Datum.");
      return;
    }
    if (new Date(end) < new Date(start)) {
      alert("Das Bis-Datum muss nach dem Von-Datum liegen.");
      return;
    }
    const blockedHit = rangeHitsBlockedDay(start, end, blockedDays);
    if (blockedHit.hit) {
      setMyVacationBlockedDetail({
        dateDe: formatDateDDMMGGGG(blockedHit.blockedDates[0]),
        reason: blockedHit.sampleReason,
      });
      setMyVacationBlockedModalOpen(true);
      return;
    }
    setMyVacationSubmitting(true);
    try {
      await createVacationRequest({
        start,
        end,
        note: myVacationNote.trim() || undefined,
      });
      toast.success("Antrag gestellt und genehmigt.");
      setMyVacationModalOpen(false);
      setMyVacationStart("");
      setMyVacationEnd("");
      setMyVacationNote("");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Fehler bei der Urlaubserfassung.");
    } finally {
      setMyVacationSubmitting(false);
    }
  };

  const years = [2025, 2026, 2027, 2028, 2029, 2030];

  return (
    <div className="min-h-screen bg-background px-4 py-5 sm:p-6 md:p-10 font-sans text-foreground">
      <div className={`max-w-[1600px] mx-auto space-y-8 transition-opacity duration-150 ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
        {/* HEADER */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
              ADMIN <span className="text-[#FFC72C]">URLAUB</span>
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Verwaltung von Abwesenheiten (<span className="font-bold text-foreground">{selectedYear}</span>)
            </p>
            <div className="mt-3 flex items-center gap-2">
              {isPending && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Loader2 size={14} className="animate-spin shrink-0" />
                  Laden…
                </span>
              )}
              <div className="flex bg-card p-1 rounded-xl shadow-sm border border-border overflow-x-auto max-w-full">
                {years.map((y) => (
                  <button
                    key={y}
                    onClick={() => handleYearChange(y)}
                    disabled={isPending}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      selectedYear === y
                        ? "bg-[#1a3826] text-white shadow-md"
                        : "text-muted-foreground hover:bg-accent"
                    } disabled:opacity-70`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap bg-card p-1 rounded-xl shadow-sm border border-border gap-1">
              <button
                onClick={() => setActiveTab("STATS")}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg text-xs font-bold transition-all touch-manipulation ${
                  activeTab === "STATS" ? "bg-[#FFC72C] text-[#1a3826]" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                STATISTIK
              </button>

              <button
                onClick={() => setActiveTab("REQUESTS")}
                className={`relative min-h-[44px] px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 touch-manipulation ${
                  activeTab === "REQUESTS" ? "bg-[#1a3826] text-white" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                ANTRÄGE
                {hasPendingRequests && (
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("BLOCKED")}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg text-xs font-bold transition-all touch-manipulation ${
                  activeTab === "BLOCKED"
                    ? "bg-[#1a3826] text-white"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                FT/Sperrtage
              </button>
            </div>

            {canRegisterOwnVacation && !isRestaurantManager && (
              <button
                type="button"
                onClick={() => setMyVacationModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-[#1a3826] text-white hover:bg-[#142e1e] shadow-sm transition-all"
              >
                <CalendarPlus size={16} />
                Meinen Urlaub eintragen
              </button>
            )}

            {canRegisterOwnVacation && isRestaurantManager && (
              <Link
                href={`/tools/vacations?year=${selectedYear}&view=self`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-[#1a3826] text-white hover:bg-[#142e1e] shadow-sm transition-all"
              >
                <CalendarPlus size={16} />
                Meinen Urlaub eintragen
              </Link>
            )}
          </div>
        </div>

        {/* TOOLBAR */}
        {true && (
          <div className="bg-card p-4 rounded-2xl shadow-sm border border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Search size={16} className="text-muted-foreground" />
              <input
                type="text"
                placeholder="Mitarbeiter suchen (Name, Abteilung, Restaurant)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-sm font-bold text-foreground w-full min-w-0 md:min-w-[26rem] placeholder:text-muted-foreground"
              />
            </div>
            {activeTab === "STATS" && enableVacationDnD && (
              <p className="text-[11px] text-muted-foreground w-full md:w-auto md:text-right">
                Reihenfolge per Ziehen ändern (nur diese Ansicht). Wird für alle gespeichert.
              </p>
            )}

            {activeTab === "STATS" && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const doc = exportTablePDF();
                    const url = pdfToBlobUrl(doc);
                    setPdfPopupTitle(`Tabelle ${selectedYear}`);
                    setPdfPopupUrl(url);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-lg text-xs font-black transition-all hover:bg-[#142e1e]"
                >
                  <FileSpreadsheet size={16} /> TABELLE
                </button>

                <button
                  onClick={() => {
                    const doc = exportTimelinePDF();
                    const url = pdfToBlobUrl(doc);
                    setPdfPopupTitle(`Plan (aktuell) ${selectedYear}`);
                    setPdfPopupUrl(url);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-lg text-xs font-black transition-all hover:bg-[#142e1e]"
                >
                  <FileBarChart size={16} /> PLAN (AKTUELL)
                </button>

                {!isRestaurantManager && (
                  <>
                    <button
                      onClick={handleGlobalExport}
                      disabled={loadingGlobal}
                      className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-lg text-xs font-black transition-all hover:bg-[#142e1e] disabled:opacity-70"
                    >
                      <Globe size={16} /> {loadingGlobal ? "LADEN…" : "GESAMT EXPORT"}
                    </button>

                    <button
                      onClick={handleOpenDeptExportModal}
                      disabled={loadingDeptExport}
                      className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-lg text-xs font-black transition-all hover:bg-[#142e1e] disabled:opacity-70"
                    >
                      <FileBarChart size={16} />
                      {loadingDeptExport ? "LADEN…" : "EXPORT NACH ABTEILUNGEN"}
                    </button>
                  </>
                )}
              </div>
            )}

            {activeTab === "REQUESTS" && (
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as typeof statusFilter)
                  }
                  className="min-h-[36px] px-3 py-2 rounded-lg border border-border bg-background text-xs font-bold text-foreground uppercase tracking-widest"
                >
                  <option value="ALL">Alle</option>
                  <option value="PENDING">Ausstehend</option>
                  <option value="APPROVED">Genehmigt</option>
                  <option value="REJECTED">Abgelehnt</option>
                  <option value="RETURNED">Zur Überarbeitung</option>
                  <option value="CANCEL_PENDING">Stornierung beantragt</option>
                  <option value="CANCELLED">Storniert</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Modal: Export po odjelima */}
        {deptExportModalOpen && deptExportData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-card rounded-xl shadow-xl max-w-sm w-full p-6 border border-border">
              <h3 className="text-lg font-bold text-card-foreground mb-1">Export nach Abteilungen</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Wählen Sie Abteilungen für den Urlaubsplan ({selectedYear}). Es wird eine PDF nur mit diesen Abteilungen erstellt.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {uniqueDeptNames.map((name) => (
                  <label
                    key={name}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-accent cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDeptNamesForExport.includes(name)}
                      onChange={() => toggleDeptForExport(name)}
                      className="h-4 w-4 rounded border-border text-[#1a3826] dark:text-[#FFC72C] focus:ring-[#1a3826]"
                    />
                    <span className="text-sm font-medium text-foreground">{name}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeptExportModalOpen(false);
                    setDeptExportData(null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium text-muted-foreground hover:bg-accent"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleDeptExportPDF}
                  disabled={selectedDeptNamesForExport.length === 0}
                  className="flex-1 px-4 py-2.5 rounded-lg font-bold bg-[#1a3826] text-white hover:bg-[#142d1f] disabled:opacity-50"
                >
                  PDF herunterladen
                </button>
              </div>
            </div>
          </div>
        )}

        {pdfPopupUrl && (
          <div className="fixed inset-0 top-14 md:top-16 z-[200] bg-black flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-[#1b3a26] text-white shrink-0">
              <span className="font-bold text-sm">
                {pdfPopupTitle || "PDF Vorschau"}
              </span>
              <button
                type="button"
                onClick={closePdfPopup}
                className="text-white hover:text-[#FFC72C] font-bold text-lg leading-none px-2"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
            <iframe
              src={pdfPopupUrl}
              title={pdfPopupTitle || "PDF Vorschau"}
              className="flex-1 w-full border-0 bg-white"
            />
          </div>
        )}

        {/* Modal: Registruj Moj Godišnji (self-service za admine) */}
        <VacationBlockedDateModal
          open={myVacationBlockedModalOpen}
          onClose={() => {
            setMyVacationBlockedModalOpen(false);
            setMyVacationBlockedDetail(null);
          }}
          detailDateDe={myVacationBlockedDetail?.dateDe}
          detailReason={myVacationBlockedDetail?.reason}
        />

        {myVacationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6 border border-border">
              <h3 className="text-lg font-bold text-card-foreground mb-1">Meinen Urlaub eintragen</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Geben Sie den Zeitraum ein. Der Antrag wird automatisch genehmigt (nur für Administratoren).
              </p>
              <form onSubmit={handleSubmitMyVacation} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Von
                  </label>
                  <input
                    type="date"
                    value={myVacationStart}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMyVacationStart(v);
                      if (v && myVacationEnd && new Date(myVacationEnd) >= new Date(v)) {
                        const r = rangeHitsBlockedDay(v, myVacationEnd, blockedDays);
                        if (r.hit) {
                          setMyVacationBlockedDetail({
                            dateDe: formatDateDDMMGGGG(r.blockedDates[0]),
                            reason: r.sampleReason,
                          });
                          setMyVacationBlockedModalOpen(true);
                        }
                      }
                    }}
                    required
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Bis
                  </label>
                  <input
                    type="date"
                    value={myVacationEnd}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMyVacationEnd(v);
                      if (myVacationStart && v && new Date(v) >= new Date(myVacationStart)) {
                        const r = rangeHitsBlockedDay(myVacationStart, v, blockedDays);
                        if (r.hit) {
                          setMyVacationBlockedDetail({
                            dateDe: formatDateDDMMGGGG(r.blockedDates[0]),
                            reason: r.sampleReason,
                          });
                          setMyVacationBlockedModalOpen(true);
                        }
                      }
                    }}
                    required
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Anmerkung (optional)
                  </label>
                  <textarea
                    value={myVacationNote}
                    onChange={(e) => setMyVacationNote(e.target.value)}
                    rows={3}
                    placeholder="Zusätzliche Anmerkung…"
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] resize-none"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMyVacationModalOpen(false);
                      setMyVacationStart("");
                      setMyVacationEnd("");
                      setMyVacationNote("");
                    }}
                    className="flex-1 px-4 py-2.5 rounded-lg font-medium text-muted-foreground hover:bg-accent"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={myVacationSubmitting}
                    className="flex-1 px-4 py-2.5 rounded-lg font-bold bg-[#1a3826] text-white hover:bg-[#142d1f] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {myVacationSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Wird gesendet…
                      </>
                    ) : (
                      "Eintragen"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* STATS: Mobile cards + Desktop table */}
        {activeTab === "STATS" && (
          <div className="bg-card rounded-xl md:rounded-2xl shadow-sm border border-border overflow-hidden">
            {/* Mobile: Card layout */}
            <div className="md:hidden divide-y divide-border">
              {statsForTable.map((u) => (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {canLinkToAdminUserEdit ? (
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="h-10 w-10 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-sm font-bold shrink-0 hover:ring-2 hover:ring-[#1a3826] hover:ring-offset-1 transition-all"
                      >
                        {(u.name || "K").charAt(0)}
                      </Link>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-sm font-bold shrink-0">
                        {(u.name || "K").charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {canLinkToAdminUserEdit ? (
                        <Link href={`/admin/users/${u.id}`} className="font-bold text-foreground truncate block hover:underline hover:text-[#1a3826]">
                          {u.name}
                        </Link>
                      ) : (
                        <div className="font-bold text-foreground truncate">{u.name}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground uppercase">{u.department}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {u.restaurantNames.map((r, i) => (
                      <span key={i} className="text-[10px] bg-muted px-2 py-1 rounded border border-border">
                        {r}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-sm font-bold">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Vortrag</div>
                      <div>{u.carriedOver ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Gesamt</div>
                      <div>{u.total}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-green-600 uppercase">Verbr.</div>
                      <div className="text-green-600">{u.used}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-orange-500 uppercase">Rest</div>
                      <div className="text-orange-500">{u.remaining}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEmployeePdf(u)}
                    className="w-full min-h-[44px] bg-[#1a3826] hover:bg-[#142e1e] text-white rounded-xl font-bold text-xs uppercase inline-flex items-center justify-center gap-2 touch-manipulation"
                  >
                    <FileText size={14} /> PDF-Bericht
                  </button>
                </div>
              ))}
            </div>
            {/* Desktop: Table */}
            <div className="hidden md:block">
              <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-muted/80 border-b border-border text-[10px] font-black text-muted-foreground uppercase">
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  {enableVacationDnD ? <span className="w-[34px] shrink-0" aria-hidden /> : null}
                  <span>Mitarbeiter</span>
                </div>
                <div className="col-span-3">Restaurants</div>
                <div className="col-span-4 grid grid-cols-4 text-center">
                  <span>Vortrag</span>
                  <span>Gesamt</span>
                  <span>Verbraucht</span>
                  <span>Resturlaub</span>
                </div>
                <div className="col-span-2 text-right">Bericht</div>
              </div>
              <DndContext
                sensors={reorderSensors}
                collisionDetection={closestCenter}
                onDragEnd={enableVacationDnD ? handleVacationDragEnd : () => {}}
              >
                <SortableContext
                  items={statsForTable.map((u) => u.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="divide-y divide-border">
                    {statsForTable.map((u) => (
                      <SortableVacationDesktopRow
                        key={u.id}
                        user={u}
                        canReorder={enableVacationDnD}
                        canLinkToAdminUserEdit={canLinkToAdminUserEdit}
                        onOpenPdf={openEmployeePdf}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        )}

        {/* REQUESTS: Mobile cards + Desktop table */}
        {activeTab === "REQUESTS" && (
          <div className="bg-card rounded-xl md:rounded-2xl shadow-sm border border-border overflow-hidden">
            {/* Mobile: Card layout */}
            <div className="md:hidden divide-y divide-border">
              {filteredRequests.map((req) => (
                <div
                  key={req.id}
                  data-vacation-request-id={req.id}
                  className={`p-4 ${req.status === "CANCELLED" ? "bg-muted/50 opacity-75" : ""}`}
                >
                  {canLinkToAdminUserEdit ? (
                    <Link href={`/admin/users/${req.user.id}`} className="font-bold text-foreground hover:underline hover:text-[#1a3826]">
                      {req.user.name}
                    </Link>
                  ) : (
                    <div className="font-bold text-foreground">{req.user.name}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5">{req.user.email}</div>
                  <div className="text-sm font-semibold text-[#1a3826] mt-1">
                    {req.restaurantName ?? req.user.mainRestaurant}
                  </div>
                  <div className="text-sm font-mono text-muted-foreground mt-1">
                    {formatDate(req.start)} ➜ {formatDate(req.end)} · {req.days} Tage
                  </div>
                  <span
                    className={`inline-block mt-2 px-2 py-1 rounded text-[10px] font-bold border ${
                      req.status === "APPROVED"
                        ? "bg-green-50 text-green-600 border-green-100"
                        : req.status === "CANCEL_PENDING"
                        ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                        : req.status === "REJECTED"
                        ? "bg-red-50 text-red-600 border-red-100"
                        : "bg-blue-50 text-blue-600 border-blue-100"
                    }`}
                  >
                    {req.status === "CANCEL_PENDING" ? "STORNIERUNG BEANTRAGT" : statusLabel(req.status)}
                  </span>
                  <div className="flex flex-col gap-2 mt-3">
                    {req.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleStatus(req.id, "APPROVED")}
                          className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-colors touch-manipulation"
                        >
                          <Check size={18} /> Genehmigen
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleStatus(req.id, "RETURNED")}
                            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-xl text-xs font-bold transition-colors touch-manipulation"
                          >
                            <RotateCcw size={16} /> Zurück
                          </button>
                          <button
                            onClick={() => handleStatus(req.id, "REJECTED")}
                            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition-colors touch-manipulation"
                          >
                            <X size={16} /> Ablehnen
                          </button>
                        </div>
                      </>
                    )}
                    {req.status === "REJECTED" && (
                      <button
                        onClick={() => handleStatus(req.id, "PENDING")}
                        className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-muted hover:bg-accent text-foreground rounded-xl text-sm font-bold transition-colors touch-manipulation"
                      >
                        <RotateCcw size={18} /> Vrati na čekanju
                      </button>
                    )}
                    {req.status === "CANCEL_PENDING" && (
                      <>
                        <button
                          onClick={() => handleStatus(req.id, "CANCELLED")}
                          className="min-h-[44px] w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-black uppercase hover:bg-red-700 touch-manipulation"
                        >
                          <Trash2 size={18} /> Stornierung genehmigen
                        </button>
                        <button
                          onClick={() => handleStatus(req.id, "APPROVED")}
                          className="min-h-[44px] w-full flex items-center justify-center gap-2 px-4 py-3 bg-muted hover:bg-accent text-foreground rounded-xl text-xs font-bold touch-manipulation"
                        >
                          <RotateCcw size={16} /> Zurück (beibehalten)
                        </button>
                      </>
                    )}
                    {req.status === "CANCELLED" && (
                      <span className="text-xs font-bold text-muted-foreground py-2 block">PONIŠTENO</span>
                    )}
                    {req.status === "APPROVED" && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteApproved(req.id)}
                        className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-sm font-bold border border-red-200 touch-manipulation"
                      >
                        <Trash2 size={18} /> Löschen (Tage zurück)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted/80 text-muted-foreground font-bold text-xs uppercase">
                  <tr>
                    <th className="p-4 pl-6">Mitarbeiter</th>
                    <th className="p-4">Restaurant</th>
                    <th className="p-4">Zeitraum</th>
                    <th className="p-4 text-center">Tage</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right pr-6">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRequests.map((req) => (
                    <tr
                      key={req.id}
                      data-vacation-request-id={req.id}
                      className={`transition-colors ${
                        req.status === "CANCELLED" ? "bg-muted/50 opacity-75" : "hover:bg-accent/50"
                      }`}
                    >
                      <td className="p-4 pl-6">
                        {canLinkToAdminUserEdit ? (
                          <Link href={`/admin/users/${req.user.id}`} className="font-bold text-sm text-foreground hover:underline hover:text-[#1a3826]">
                            {req.user.name}
                          </Link>
                        ) : (
                          <div className="font-bold text-sm text-foreground">{req.user.name}</div>
                        )}
                        <div className="text-[10px] text-muted-foreground">{req.user.email}</div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-semibold text-[#1a3826]">
                          {req.restaurantName ?? req.user.mainRestaurant}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-mono text-muted-foreground">
                        {formatDate(req.start)} <span className="text-muted-foreground/70">➜</span> {formatDate(req.end)}
                      </td>
                      <td className="p-4 text-center font-bold text-foreground">{req.days}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-bold border ${
                            req.status === "APPROVED"
                              ? "bg-green-50 text-green-600 border-green-100"
                              : req.status === "CANCEL_PENDING"
                              ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                              : req.status === "REJECTED"
                              ? "bg-red-50 text-red-600 border-red-100"
                              : "bg-blue-50 text-blue-600 border-blue-100"
                          }`}
                        >
                          {req.status === "CANCEL_PENDING"
                            ? "STORNIERUNG BEANTRAGT"
                            : statusLabel(req.status)}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {req.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleStatus(req.id, "APPROVED")}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-green-50 hover:bg-green-100 text-green-600 rounded-lg text-xs font-bold transition-colors"
                              >
                                <Check size={14} /> Genehmigen
                              </button>
                              <button
                                onClick={() => handleStatus(req.id, "RETURNED")}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-xs font-bold transition-colors"
                              >
                                <RotateCcw size={14} /> Zurück
                              </button>
                              <button
                                onClick={() => handleStatus(req.id, "REJECTED")}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-colors"
                              >
                                <X size={14} /> Ablehnen
                              </button>
                            </>
                          )}
                          {req.status === "REJECTED" && (
                            <button
                              onClick={() => handleStatus(req.id, "PENDING")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-muted hover:bg-accent text-foreground rounded-lg text-xs font-bold transition-colors"
                            >
                              <RotateCcw size={14} /> Vrati na čekanju
                            </button>
                          )}
                          {req.status === "CANCEL_PENDING" && (
                            <>
                              <button
                                onClick={() => handleStatus(req.id, "CANCELLED")}
                                className="flex items-center gap-2 px-3 py-1.5 min-h-[44px] bg-red-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-red-700 shadow-md active:scale-95"
                              >
                                <Trash2 size={14} /> Stornierung genehmigen
                              </button>
                              <button
                                onClick={() => handleStatus(req.id, "APPROVED")}
                                className="flex items-center gap-2 px-3 py-1.5 min-h-[44px] bg-muted hover:bg-accent text-foreground rounded-lg text-[10px] font-bold uppercase"
                              >
                                <RotateCcw size={14} /> Zurück (Genehmigung beibehalten)
                              </button>
                            </>
                          )}
                          {req.status === "CANCELLED" && (
                            <span className="text-[10px] font-bold text-muted-foreground">PONIŠTENO</span>
                          )}
                          {req.status === "APPROVED" && (
                            <button
                              type="button"
                              onClick={() => void handleDeleteApproved(req.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold border border-red-200 transition-colors"
                              title="Genehmigten Urlaub löschen – Tage werden gutgeschrieben"
                            >
                              <Trash2 size={14} /> Löschen
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BLOCKED: globalni praznici (iz Admin) + gesperrte Tage (Standort) */}
        {activeTab === "BLOCKED" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
              <label htmlFor="blocked-tab-month" className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                Monat filtern
              </label>
              <select
                id="blocked-tab-month"
                value={blockedListMonth === "all" ? "all" : String(blockedListMonth)}
                onChange={(e) => {
                  const v = e.target.value;
                  setBlockedListMonth(v === "all" ? "all" : parseInt(v, 10));
                }}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium min-w-[180px]"
              >
                <option value="all">Alle Monate</option>
                {BLOCKED_TAB_MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                Gilt für Feiertage und gesperrte Tage ({selectedYear}).
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Globalni praznici – iz Admin panela, samo za pregled (ZELENO) */}
            <div className="lg:col-span-2 bg-card p-6 rounded-2xl shadow-sm border border-border">
              <h3 className="font-bold text-card-foreground mb-4 flex items-center gap-2">
                <Calendar className="text-[#1a3826] dark:text-[#FFC72C]" size={20} /> Feiertage ({selectedYear}) – aus Admin
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Diese Feiertage werden zentral im Admin-Panel unter „Feiertage“ verwaltet und gelten für alle Module.
              </p>
              <div className="flex flex-wrap gap-2">
                {holidaysForBlockedTab.map((h, i) => {
                  return (
                    <div
                      key={`${h.d}-${h.m}-${i}`}
                      className="bg-muted/50 dark:bg-muted/30 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
                    >
                      {h.d}.{h.m}.{selectedYear}
                    </div>
                  );
                })}
                {holidaysForBlockedTab.length === 0 && (
                  <span className="text-sm text-muted-foreground italic">
                    {globalHolidays.length === 0
                      ? "Keine Feiertage für dieses Jahr (Admin-Panel prüfen)."
                      : "Keine Feiertage in diesem Monat (Filter anpassen)."}
                  </span>
                )}
              </div>
            </div>

            {/* Gesperrte Tage (Standort) – BlockedDay, dodavanje/brisanje */}
            <div className="bg-card p-6 rounded-2xl shadow-sm border border-border h-fit">
              <h3 className="font-bold text-card-foreground mb-4 flex items-center gap-2">
                <Calendar className="text-[#1a3826] dark:text-[#FFC72C]" size={20} /> Neuer gesperrter Tag
              </h3>
              <div className="space-y-4">
                <input
                  type="date"
                  className="w-full border border-border p-3 rounded-xl outline-none text-sm font-bold text-foreground bg-card"
                  value={newBlockedDate}
                  onChange={(e) => setNewBlockedDate(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="z. B. Betriebsurlaub"
                  className="w-full border border-border p-3 rounded-xl outline-none text-sm font-bold text-foreground bg-card"
                  value={newBlockedReason}
                  onChange={(e) => setNewBlockedReason(e.target.value)}
                />
                <button
                  onClick={handleAddBlocked}
                  className="w-full bg-[#1a3826] dark:bg-[#FFC72C] dark:text-[#1a3826] hover:opacity-90 text-white py-3 rounded-xl font-bold uppercase text-xs shadow-md active:scale-95"
                >
                  Hinzufügen
                </button>
              </div>
              <h3 className="font-bold text-card-foreground mt-6 mb-2 uppercase tracking-tighter text-sm">
                Gesperrte Tage (Standort) {selectedYear}
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {blockedDayGroupsForTab.map((g) => (
                  <div
                    key={g.key}
                    className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-800 group gap-2"
                  >
                    <div className="text-sm font-semibold text-red-800 dark:text-red-200 truncate min-w-0">
                      {g.reason ?? "—"}
                      {g.ids.length > 1 && (
                        <span className="ml-2 text-[10px] font-bold text-red-600/80">({g.ids.length} Standorte)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-red-600 dark:text-red-300 font-mono">
                        {formatDate(g.date)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleRemoveBlockedGroup(g.ids)}
                        className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        title="Löschen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {blockedDayGroupsForTab.length === 0 && (
                  <p className="text-xs text-muted-foreground italic py-2">
                    {blockedDays.filter((d) => new Date(d.date).getFullYear() === selectedYear).length === 0
                      ? "Keine weiteren gesperrten Tage."
                      : "Keine gesperrten Tage in diesem Monat (Filter anpassen)."}
                  </p>
                )}
              </div>
            </div>
            </div>
          </div>
        )}
        {/* Bivši BLOCKED tab uklonjen – gesperrte Tage se sada u Admin panelu verwalten. */}
        {/* BLOCKED tab uklonjen – gesperrte Tage i Feiertage se sada u /admin/holidays konfigurieren. */}
      </div>
    </div>
  );
}
