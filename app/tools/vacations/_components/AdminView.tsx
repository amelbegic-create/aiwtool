/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateVacationStatus,
  addBlockedDay,
  removeBlockedDay,
  getGlobalVacationStats,
  createVacationRequest,
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
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";

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
  /** Prikaži dugme "Registruj Moj Godišnji" (samo za SYSTEM_ARCHITECT, SUPER_ADMIN, ADMIN) */
  canRegisterOwnVacation?: boolean;
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
  reportRestaurantLabel?: string
) {
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
  doc.save(`Tabelle_Urlaub_${year}.pdf`);
}

export function exportIndividualReportWithData(
  user: UserStat,
  allRequests: RequestWithUser[],
  year: number
) {
  const doc = new jsPDF();
  const userRequests = allRequests.filter((r) => r.user.id === user.id);
  drawPdfHeader(doc, {
    title: "Urlaubsübersicht",
    subtitle: `Erstellt: ${formatDate(new Date().toISOString())}`,
    restaurantName: user.restaurantNames?.[0] ?? undefined,
    year,
  });
  const margin = 14;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Mitarbeiter: ${user.name || "N/A"}`, margin, 45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`E-Mail: ${user.email || "N/A"}`, margin, 52);
  doc.text(`Abteilung: ${user.department || "N/A"}`, margin, 58);

  const startY = 66;
  const boxW = 32;
  const boxH = 12;
  const boxGap = 3;
  const pageW = doc.internal.pageSize.getWidth();
  const boxesTotalWidth = boxW * 3 + boxGap * 2;
  const boxStartX = (pageW - boxesTotalWidth) / 2;
  const boxCenterX = (x: number) => x + boxW / 2;
  const greenBg = [26, 56, 38] as [number, number, number];

  doc.setFillColor(...greenBg);
  doc.setDrawColor(...greenBg);
  doc.roundedRect(boxStartX, startY, boxW, boxH, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(255, 255, 255);
  doc.text("GESAMT", boxCenterX(boxStartX), startY + 3.5, { align: "center" });
  doc.setFontSize(10);
  doc.text(String(user.total), boxCenterX(boxStartX), startY + 9, { align: "center" });

  doc.setFillColor(...greenBg);
  doc.setDrawColor(...greenBg);
  doc.roundedRect(boxStartX + boxW + boxGap, startY, boxW, boxH, 1.5, 1.5, "FD");
  doc.setFontSize(5.5);
  doc.setTextColor(255, 255, 255);
  doc.text("VERBRAUCHT", boxCenterX(boxStartX + boxW + boxGap), startY + 3.5, { align: "center" });
  doc.setFontSize(10);
  doc.text(String(user.used), boxCenterX(boxStartX + boxW + boxGap), startY + 9, { align: "center" });

  doc.setFillColor(...greenBg);
  doc.setDrawColor(...greenBg);
  doc.roundedRect(boxStartX + (boxW + boxGap) * 2, startY, boxW, boxH, 1.5, 1.5, "FD");
  doc.setFontSize(5.5);
  doc.setTextColor(255, 255, 255);
  doc.text("RESTURLAUB", boxCenterX(boxStartX + (boxW + boxGap) * 2), startY + 3.5, { align: "center" });
  doc.setFontSize(10);
  doc.text(String(user.remaining), boxCenterX(boxStartX + (boxW + boxGap) * 2), startY + 9, { align: "center" });

  const tableBody = userRequests.map((req) => [
    formatDate(req.start),
    formatDate(req.end),
    req.days,
    statusLabel(req.status),
  ]);
  const tableWidth = pageW - margin * 2;
  autoTable(doc, {
    startY: startY + 22,
    head: [["Von", "Bis", "Tage", "Status"]],
    body: tableBody,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 5, textColor: [15, 23, 42], lineWidth: 0.1, lineColor: [0, 0, 0], halign: "center" },
    headStyles: {
      fillColor: [26, 56, 38],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
    },
    bodyStyles: { lineWidth: 0.1, lineColor: [0, 0, 0], halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: tableWidth * 0.28 },
      1: { halign: "center", cellWidth: tableWidth * 0.28 },
      2: { halign: "center", cellWidth: tableWidth * 0.14 },
      3: { halign: "center", cellWidth: tableWidth * 0.30 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
  });
  const safeName = (user.name || "Benutzer").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "_");
  doc.save(`Bericht_${safeName}_${year}.pdf`);
}

export function exportTimelinePDFWithData(
  stats: UserStat[],
  requests: RequestWithUser[],
  blockedDays: BlockedDay[],
  year: number,
  reportRestaurantLabel?: string,
  filename?: string
) {
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
  const months = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
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
      blockedDays.forEach((blocked) => {
        const bDate = new Date(blocked.date);
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
  doc.save(filename ?? `Uebersichtsplan_${year}.pdf`);
}

export default function AdminView({
  allRequests,
  blockedDays,
  usersStats,
  selectedYear,
  reportRestaurantLabel,
  canRegisterOwnVacation = false,
}: AdminViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabType>("STATS");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  const handleYearChange = (y: number) => {
    if (y === selectedYear) return;
    startTransition(() => {
      router.push(`/tools/vacations?year=${y}`);
    });
  };
  const [deptExportModalOpen, setDeptExportModalOpen] = useState(false);
  const [deptExportData, setDeptExportData] = useState<{
    usersStats: UserStat[];
    allRequests: RequestWithUser[];
  } | null>(null);
  const [loadingDeptExport, setLoadingDeptExport] = useState(false);
  const [selectedDeptNamesForExport, setSelectedDeptNamesForExport] = useState<string[]>([]);

  // State za praznike
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");

  // Modal: Registruj Moj Godišnji (self-service za admine)
  const [myVacationModalOpen, setMyVacationModalOpen] = useState(false);
  const [myVacationStart, setMyVacationStart] = useState("");
  const [myVacationEnd, setMyVacationEnd] = useState("");
  const [myVacationNote, setMyVacationNote] = useState("");
  const [myVacationSubmitting, setMyVacationSubmitting] = useState(false);

  // Provjera ima li zahtjeva na čekanju (za crvenu notifikaciju)
  const hasPendingRequests = useMemo(() => {
    return allRequests.some((r) => r.status === "PENDING" || r.status === "CANCEL_PENDING");
  }, [allRequests]);

  // --- FILTERI ---
  const filteredStats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return usersStats.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const dep = (u.department || "").toLowerCase();
      const rest = (u.restaurantNames || []).join(" ").toLowerCase();
      return !q || name.includes(q) || dep.includes(q) || rest.includes(q);
    });
  }, [usersStats, searchQuery]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRequests.filter((req) => {
      const name = (req.user.name || "").toLowerCase();
      const rest = (req.user.mainRestaurant || "").toLowerCase();
      return !q || name.includes(q) || rest.includes(q);
    });
  }, [allRequests, searchQuery]);

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
    if (confirm(messages[status])) {
      await updateVacationStatus(id, status);
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

  const handleAddBlocked = async () => {
    if (!newBlockedDate) return alert("Bitte Datum wählen.");
    await addBlockedDay(newBlockedDate, newBlockedReason || "Feiertag");
    setNewBlockedDate("");
    setNewBlockedReason("");
  };

  // =====================================================================
  // 1. POJEDINAČNI IZVJEŠTAJ (ZA JEDNOG RADNIKA) — CLEAN + boja po odjelu
  // =====================================================================
  const exportIndividualReport = (user: UserStat) => {
    const doc = new jsPDF();
    const userRequests = allRequests.filter((r) => r.user.id === user.id);

    drawPdfHeader(doc, {
      title: "Urlaubsübersicht",
      subtitle: `Erstellt: ${formatDate(new Date().toISOString())}`,
      restaurantName: user.restaurantNames?.[0] ?? undefined,
      year: selectedYear,
    });

    const margin = 14;
    const pageW = doc.internal.pageSize.getWidth();
    const tableWidth = pageW - margin * 2;
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Mitarbeiter: ${user.name || "N/A"}`, margin, 45);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`E-Mail: ${user.email || "N/A"}`, margin, 52);
    doc.text(`Abteilung: ${user.department || "N/A"}`, margin, 58);

    const startY = 66;
    const boxW = 32;
    const boxH = 12;
    const boxGap = 3;
    const boxCenterX = (x: number) => x + boxW / 2;
    const greenBg = [26, 56, 38] as [number, number, number];

    doc.setFillColor(...greenBg);
    doc.setDrawColor(...greenBg);
    doc.roundedRect(margin, startY, boxW, boxH, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(255, 255, 255);
    doc.text("GESAMT", boxCenterX(margin), startY + 3.5, { align: "center" });
    doc.setFontSize(10);
    doc.text(String(user.total), boxCenterX(margin), startY + 9, { align: "center" });

    doc.setFillColor(...greenBg);
    doc.setDrawColor(...greenBg);
    doc.roundedRect(margin + boxW + boxGap, startY, boxW, boxH, 1.5, 1.5, "FD");
    doc.setFontSize(5.5);
    doc.setTextColor(255, 255, 255);
    doc.text("VERBRAUCHT", boxCenterX(margin + boxW + boxGap), startY + 3.5, { align: "center" });
    doc.setFontSize(10);
    doc.text(String(user.used), boxCenterX(margin + boxW + boxGap), startY + 9, { align: "center" });

    doc.setFillColor(...greenBg);
    doc.setDrawColor(...greenBg);
    doc.roundedRect(margin + (boxW + boxGap) * 2, startY, boxW, boxH, 1.5, 1.5, "FD");
    doc.setFontSize(5.5);
    doc.setTextColor(255, 255, 255);
    doc.text("RESTURLAUB", boxCenterX(margin + (boxW + boxGap) * 2), startY + 3.5, { align: "center" });
    doc.setFontSize(10);
    doc.text(String(user.remaining), boxCenterX(margin + (boxW + boxGap) * 2), startY + 9, { align: "center" });

    const tableBody = userRequests.map((req) => [
      formatDate(req.start),
      formatDate(req.end),
      req.days,
      statusLabel(req.status),
    ]);

    // Clean tabela: bez “teškog grida”
    autoTable(doc, {
      startY: startY + 22,
      head: [["Von", "Bis", "Tage", "Status"]],
      body: tableBody,
      theme: "plain",
      styles: {
        fontSize: 10,
        cellPadding: 5,
        textColor: [15, 23, 42],
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
        halign: "center",
      },
      headStyles: {
        fillColor: [26, 56, 38],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
      },
      bodyStyles: { lineWidth: 0.1, lineColor: [0, 0, 0], halign: "center" },
      columnStyles: {
        0: { halign: "center", cellWidth: tableWidth * 0.28 },
        1: { halign: "center", cellWidth: tableWidth * 0.28 },
        2: { halign: "center", cellWidth: tableWidth * 0.14 },
        3: { halign: "center", cellWidth: tableWidth * 0.30 },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    const safeName = (user.name || "Benutzer").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "_");
    doc.save(`Bericht_${safeName}_${selectedYear}.pdf`);
  };

  // =====================================================================
  // 2. TABLIČNI PDF — clean, bez boja, linije samo za redove s korisnicima
  // =====================================================================
  const exportTablePDF = (overrideStats?: UserStat[]) => {
    const statsToUse = overrideStats || filteredStats;

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

    doc.save(`Tabelle_Urlaub_${selectedYear}.pdf`);
  };

  // =====================================================================
  // 3. VIZUALNI TIMELINE — CLEAN + boje po odjelu
  // =====================================================================
  const exportTimelinePDF = (
    overrideStats?: UserStat[],
    overrideRequests?: RequestWithUser[],
    filename?: string
  ) => {
    const statsToUse = overrideStats || filteredStats;
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
    const months = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

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

        // praznici unutar bara: tanka crvena linija
        blockedDays.forEach((blocked) => {
          const bDate = new Date(blocked.date);
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

    doc.save(filename ?? `Uebersichtsplan_${selectedYear}.pdf`);
  };

  const handleGlobalExport = async () => {
    setLoadingGlobal(true);
    try {
      const globalData = await getGlobalVacationStats(selectedYear);
      exportTimelinePDF(globalData.usersStats, globalData.allRequests as any);
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
    const filteredStats = deptExportData.usersStats.filter((u) =>
      deptSet.has(u.department?.trim() || "N/A")
    );
    const filteredUserIds = new Set(filteredStats.map((u) => u.id));
    const filteredRequests = deptExportData.allRequests.filter((r) =>
      filteredUserIds.has(r.user.id)
    );
    const safeNames = selectedDeptNamesForExport.map((n) => n.replace(/\s+/g, "_"));
    exportTimelinePDF(
      filteredStats,
      filteredRequests as any,
      `Plan_${selectedYear}_${safeNames.join("_")}.pdf`
    );
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
                onClick={() => setActiveTab("BLOCKED")}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg text-xs font-bold transition-all touch-manipulation ${
                  activeTab === "BLOCKED" ? "bg-[#1a3826] text-white" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                FEIERTAGE
              </button>
            </div>

            {canRegisterOwnVacation && (
              <button
                type="button"
                onClick={() => setMyVacationModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-[#1a3826] text-white hover:bg-[#142e1e] shadow-sm transition-all"
              >
                <CalendarPlus size={16} />
                Meinen Urlaub eintragen
              </button>
            )}
          </div>
        </div>

        {/* TOOLBAR */}
        {activeTab !== "BLOCKED" && (
          <div className="bg-card p-4 rounded-2xl shadow-sm border border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Search size={16} className="text-muted-foreground" />
              <input
                type="text"
                placeholder="Mitarbeiter suchen (Name, Abteilung, Restaurant)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-sm font-bold text-foreground w-full md:w-80 placeholder:text-muted-foreground"
              />
            </div>

            {activeTab === "STATS" && (
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/tools/vacations/view/table?year=${selectedYear}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-lg text-xs font-black transition-all hover:bg-[#142e1e]"
                >
                  <FileSpreadsheet size={16} /> TABELLE
                </button>

                <button
                  onClick={() => exportTimelinePDF()}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-lg text-xs font-black transition-all hover:bg-[#142e1e]"
                >
                  <FileBarChart size={16} /> PLAN (AKTUELL)
                </button>

                <button
                  onClick={handleGlobalExport}
                  disabled={loadingGlobal}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-lg text-xs font-black transition-all hover:bg-[#142e1e] disabled:opacity-70"
                >
                  <Globe size={16} /> {loadingGlobal ? "LADEN…" : "GLOBALER EXPORT"}
                </button>

                <button
                  onClick={handleOpenDeptExportModal}
                  disabled={loadingDeptExport}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-lg text-xs font-black transition-all hover:bg-[#142e1e] disabled:opacity-70"
                >
                  <FileBarChart size={16} />
                  {loadingDeptExport ? "LADEN…" : "EXPORT NACH ABTEILUNGEN"}
                </button>
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

        {/* Modal: Registruj Moj Godišnji (self-service za admine) */}
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
                    onChange={(e) => setMyVacationStart(e.target.value)}
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
                    onChange={(e) => setMyVacationEnd(e.target.value)}
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
              {filteredStats.map((u) => (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {(u.name || "K").charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-foreground truncate">{u.name}</div>
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
                    onClick={() => router.push(`/tools/vacations/report/${u.id}?year=${selectedYear}`)}
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
                <div className="col-span-3">Mitarbeiter</div>
                <div className="col-span-3">Restaurants</div>
                <div className="col-span-4 grid grid-cols-4 text-center">
                  <span>Vortrag</span>
                  <span>Gesamt</span>
                  <span>Verbraucht</span>
                  <span>Resturlaub</span>
                </div>
                <div className="col-span-2 text-right">Bericht</div>
              </div>
              <div className="divide-y divide-border">
                {filteredStats.map((u) => (
                  <div
                    key={u.id}
                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-accent/50 transition-colors"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-xs font-bold">
                        {(u.name || "K").charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-foreground">{u.name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{u.department}</div>
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
                        onClick={() => router.push(`/tools/vacations/report/${u.id}?year=${selectedYear}`)}
                        className="bg-[#1a3826] hover:bg-[#142e1e] text-white px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-2 text-[10px] font-bold uppercase min-h-[44px]"
                      >
                        <FileText size={14} /> PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
                  className={`p-4 ${req.status === "CANCELLED" ? "bg-muted/50 opacity-75" : ""}`}
                >
                  <div className="font-bold text-foreground">{req.user.name}</div>
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
                      className={`transition-colors ${
                        req.status === "CANCELLED" ? "bg-muted/50 opacity-75" : "hover:bg-accent/50"
                      }`}
                    >
                      <td className="p-4 pl-6">
                        <div className="font-bold text-sm text-foreground">{req.user.name}</div>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BLOCKED DAYS */}
        {activeTab === "BLOCKED" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card p-6 rounded-2xl shadow-sm border border-border h-fit">
              <h3 className="font-bold text-card-foreground mb-4 flex items-center gap-2">
                <Calendar className="text-[#1a3826]" size={20} /> Neuer Feiertag
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
                  placeholder="Bezeichnung des Feiertags"
                  className="w-full border border-border p-3 rounded-xl outline-none text-sm font-bold text-foreground bg-card"
                  value={newBlockedReason}
                  onChange={(e) => setNewBlockedReason(e.target.value)}
                />
                <button
                  onClick={handleAddBlocked}
                  className="w-full bg-[#1a3826] hover:bg-[#142e1e] text-white py-3 rounded-xl font-bold uppercase text-xs shadow-md active:scale-95"
                >
                  Hinzufügen
                </button>
              </div>
            </div>

            <div className="md:col-span-2 bg-card p-6 rounded-2xl shadow-sm border border-border">
              <h3 className="font-bold text-card-foreground mb-4 uppercase tracking-tighter">
                Kalender der Feiertage ({selectedYear})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {blockedDays
                  .filter((d) => new Date(d.date).getFullYear() === selectedYear)
                  .map((d) => (
                    <div
                      key={d.id}
                      className="flex justify-between items-center p-4 bg-red-50 border border-red-100 rounded-xl group"
                    >
                      <div>
                        <div className="font-bold text-red-900 text-sm">{d.reason}</div>
                        <div className="text-xs text-red-500 font-mono mt-1">{formatDate(d.date)}</div>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm("Löschen?")) {
                            await removeBlockedDay(d.id);
                            toast.success("Feiertag entfernt.");
                            router.refresh();
                          }
                        }}
                        className="text-red-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                {blockedDays.filter((d) => new Date(d.date).getFullYear() === selectedYear).length === 0 && (
                  <div className="col-span-full text-center py-10 text-muted-foreground italic">
                    Keine Feiertage definiert.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
