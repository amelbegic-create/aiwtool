/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo } from "react";
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

interface BlockedDay {
  id: string;
  date: string;
  reason: string | null;
}

interface UserStat {
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

interface RequestWithUser {
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
  if (s === "APPROVED") return "ODOBRENO";
  if (s === "REJECTED") return "ODBIJENO";
  if (s === "PENDING") return "NA ČEKANJU";
  if (s === "RETURNED") return "VRAĆENO";
  if (s === "CANCEL_PENDING") return "ČEKA PONIŠTENJE";
  if (s === "CANCELLED") return "PONIŠTENO";
  return s;
}

// ===============================
// Jedinstveni header za sve PDF exporte (redizajn: godina ogromna žuta, naziv restorana velik, naslov siv)
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
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("AIW Services", 14, y);
  y += 10;

  if (opts.restaurantName) {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text(opts.restaurantName, 14, y);
    y += 8;
  }

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.text(typeof opts.title === "string" ? opts.title : "", 14, y);
  y += 6;

  if (opts.year != null) {
    const yearStr = String(opts.year);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    const textW = doc.getTextWidth(yearStr);
    const padding = 8;
    const boxW = textW + padding * 2;
    const boxH = 20;
    const boxX = pageW - 14 - boxW;
    const boxY = (headerHeight - boxH) / 2;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, "F");
    doc.setTextColor(26, 56, 38);
    doc.text(yearStr, boxX + boxW / 2, boxY + boxH / 2 + 3, { align: "center" });
  }

  if (opts.subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.setFont("helvetica", "normal");
    doc.text(opts.subtitle, 14, headerHeight - 4);
  }
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
  const [activeTab, setActiveTab] = useState<TabType>("STATS");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingGlobal, setLoadingGlobal] = useState(false);
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
      APPROVED: "Odobriti ovaj zahtjev?",
      REJECTED: "Odbiti ovaj zahtjev?",
      RETURNED: "Vratiti zahtjev radniku na doradu?",
      CANCELLED: "Odobriti poništenje godišnjeg odmora? Ovo će osloboditi dane radniku.",
      PENDING: "Vratiti zahtjev u status „Na čekanju”?",
    };
    if (confirm(messages[status])) {
      await updateVacationStatus(id, status);
      toast.success(
        status === "APPROVED"
          ? "Zahtjev odobren."
          : status === "REJECTED"
            ? "Zahtjev odbijen."
            : status === "CANCELLED"
              ? "Poništenje odobreno."
              : "Status ažuriran."
      );
      router.refresh();
    }
  };

  const handleAddBlocked = async () => {
    if (!newBlockedDate) return alert("Odaberite datum");
    await addBlockedDay(newBlockedDate, newBlockedReason || "Praznik");
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
      title: "Status godišnjih odmora",
      subtitle: `Generirano: ${formatDate(new Date().toISOString())}`,
      restaurantName: user.restaurantNames?.[0] ?? undefined,
      year: selectedYear,
    });

    // Card: zaposlenik
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Zaposlenik: ${user.name || "N/A"}`, 14, 45);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Email: ${user.email || "N/A"}`, 14, 52);
    doc.text(`Odjel: ${user.department || "N/A"}`, 14, 58);

    // KPI boxovi – smanjeni, svi brojevi crni, centrirani
    const startY = 66;
    const boxW = 48;
    const boxH = 18;
    const boxGap = 5;

    const boxCenterX = (x: number) => x + boxW / 2;

    // Ukupno – siva pozadina, crni broj
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, startY, boxW, boxH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text("UKUPNO DANA", boxCenterX(14), startY + 5.5, { align: "center" });
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(String(user.total), boxCenterX(14), startY + 13, { align: "center" });

    // Iskorišteno – žuta (#FFC72C), crni broj
    doc.setFillColor(255, 199, 44);
    doc.setDrawColor(230, 180, 40);
    doc.roundedRect(14 + boxW + boxGap, startY, boxW, boxH, 2, 2, "FD");
    doc.setFontSize(7);
    doc.setTextColor(26, 56, 38);
    doc.text("ISKORIŠTENO", boxCenterX(14 + boxW + boxGap), startY + 5.5, { align: "center" });
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(String(user.used), boxCenterX(14 + boxW + boxGap), startY + 13, { align: "center" });

    // Preostalo – zelena (#1a3826), crni broj
    doc.setFillColor(26, 56, 38);
    doc.setDrawColor(26, 56, 38);
    doc.roundedRect(14 + (boxW + boxGap) * 2, startY, boxW, boxH, 2, 2, "FD");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text("PREOSTALO", boxCenterX(14 + (boxW + boxGap) * 2), startY + 5.5, { align: "center" });
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(String(user.remaining), boxCenterX(14 + (boxW + boxGap) * 2), startY + 13, { align: "center" });

    const tableBody = userRequests.map((req) => [
      `${formatDate(req.start)} - ${formatDate(req.end)}`,
      req.days,
      statusLabel(req.status),
    ]);

    // Clean tabela: bez “teškog grida”
    autoTable(doc, {
      startY: startY + 26,
      head: [["Period", "Dana", "Status"]],
      body: tableBody,
      theme: "plain",
      styles: {
        fontSize: 10,
        cellPadding: 4,
        textColor: [15, 23, 42],
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [26, 56, 38],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
      },
      bodyStyles: { lineWidth: 0.1, lineColor: [0, 0, 0] },
      columnStyles: {
        0: { halign: "left", cellWidth: 110 },
        1: { halign: "center", cellWidth: 20 },
        2: { halign: "center", cellWidth: 50 },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });

    const safeName = (user.name || "Korisnik").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "_");
    doc.save(`Izvjestaj_${safeName}_${selectedYear}.pdf`);
  };

  // =====================================================================
  // 2. TABLIČNI PDF — clean, bez boja, linije samo za redove s korisnicima
  // =====================================================================
  const exportTablePDF = (overrideStats?: UserStat[]) => {
    const statsToUse = overrideStats || filteredStats;

    const doc = new jsPDF();
    drawPdfHeader(doc, {
      title: "Status godišnjih odmora",
      subtitle: reportRestaurantLabel || undefined,
      restaurantName: reportRestaurantLabel,
      year: selectedYear,
      headerHeight: 38,
    });

    const restaurantDisplay = (names: string[]) =>
      names.length > 2 ? "Svi restorani" : names.join(", ");

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
      head: [["Ime i prezime", "Odjel", "Restorani", "Preneseno", "Ukupno", "Iskorišteno", "Preostalo"]],
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

    doc.save(`Tabela_Godisnjih_${selectedYear}.pdf`);
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
      title: "Globalni plan i raspored",
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
          title: "Globalni plan i raspored",
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
    doc.text("Crvena linija = praznik unutar godišnjeg.", 15, legendY);

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

    doc.save(filename ?? `Globalni_Plan_${selectedYear}.pdf`);
  };

  const handleGlobalExport = async () => {
    setLoadingGlobal(true);
    try {
      const globalData = await getGlobalVacationStats(selectedYear);
      exportTimelinePDF(globalData.usersStats, globalData.allRequests as any);
    } catch {
      alert("Greška pri dohvatu globalnih podataka.");
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
      alert("Greška pri dohvatu podataka za export po odjelima.");
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
      alert("Odaberite barem jedan odjel.");
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
      alert("Odaberite datum od i datum do.");
      return;
    }
    if (new Date(end) < new Date(start)) {
      alert("Datum do mora biti nakon datuma od.");
      return;
    }
    setMyVacationSubmitting(true);
    try {
      await createVacationRequest({
        start,
        end,
        note: myVacationNote.trim() || undefined,
      });
      toast.success("Zahtjev za godišnji poslan i odobren.");
      setMyVacationModalOpen(false);
      setMyVacationStart("");
      setMyVacationEnd("");
      setMyVacationNote("");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Greška pri registraciji godišnjeg.");
    } finally {
      setMyVacationSubmitting(false);
    }
  };

  const years = [2025, 2026, 2027, 2028, 2029, 2030];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter mb-2">
              ADMIN <span className="text-[#FFC72C]">GODIŠNJI</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Upravljanje odsustvima (<span className="font-bold text-slate-800">{selectedYear}.</span> godina)
            </p>
            <div className="mt-3 flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto max-w-full">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => router.push(`/tools/vacations?year=${y}`)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    selectedYear === y
                      ? "bg-[#1a3826] text-white shadow-md"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
              <button
                onClick={() => setActiveTab("STATS")}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "STATS" ? "bg-[#FFC72C] text-[#1a3826]" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                STATISTIKA
              </button>

              <button
                onClick={() => setActiveTab("REQUESTS")}
                className={`relative px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "REQUESTS" ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                ZAHTJEVI
                {hasPendingRequests && (
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("BLOCKED")}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "BLOCKED" ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                PRAZNICI
              </button>
            </div>

            {canRegisterOwnVacation && (
              <button
                type="button"
                onClick={() => setMyVacationModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm border border-emerald-700/30 transition-all"
              >
                <CalendarPlus size={16} />
                Registruj Moj Godišnji
              </button>
            )}
          </div>
        </div>

        {/* TOOLBAR */}
        {activeTab !== "BLOCKED" && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder="Traži radnika (ime, odjel, restoran)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-sm font-bold text-slate-700 w-full md:w-80"
              />
            </div>

            {activeTab === "STATS" && (
              <div className="flex gap-2">
                <button
                  onClick={() => exportTablePDF()}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  <FileSpreadsheet size={16} /> TABELA (CLEAN)
                </button>

                <button
                  onClick={() => exportTimelinePDF()}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FFC72C] hover:bg-[#e0af25] rounded-lg text-xs font-black text-[#1a3826] transition-all"
                >
                  <FileBarChart size={16} /> PLAN (TRENUTNI)
                </button>

                <button
                  onClick={handleGlobalExport}
                  disabled={loadingGlobal}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a3826] text-white rounded-lg text-xs font-black transition-all hover:bg-[#142e1e] disabled:opacity-70"
                >
                  <Globe size={16} /> {loadingGlobal ? "UČITAVANJE..." : "GLOBALNI EXPORT"}
                </button>

                <button
                  onClick={handleOpenDeptExportModal}
                  disabled={loadingDeptExport}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg text-xs font-black transition-all hover:bg-slate-800 disabled:opacity-70"
                >
                  <FileBarChart size={16} />
                  {loadingDeptExport ? "UČITAVANJE..." : "EXPORT PO ODJELIMA"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal: Export po odjelima */}
        {deptExportModalOpen && deptExportData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Export po odjelima</h3>
              <p className="text-sm text-slate-500 mb-4">
                Odaberite odjele za godišnji plan ({selectedYear}). Preuzet će se PDF samo s tim odjelima.
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {uniqueDeptNames.map((name) => (
                  <label
                    key={name}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDeptNamesForExport.includes(name)}
                      onChange={() => toggleDeptForExport(name)}
                      className="h-4 w-4 rounded border-gray-300 text-[#1a3826] focus:ring-[#1a3826]"
                    />
                    <span className="text-sm font-medium text-slate-800">{name}</span>
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
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium text-slate-600 hover:bg-gray-100"
                >
                  Odustani
                </button>
                <button
                  type="button"
                  onClick={handleDeptExportPDF}
                  disabled={selectedDeptNamesForExport.length === 0}
                  className="flex-1 px-4 py-2.5 rounded-lg font-bold bg-[#1a3826] text-white hover:bg-[#142d1f] disabled:opacity-50"
                >
                  Preuzmi PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Registruj Moj Godišnji (self-service za admine) */}
        {myVacationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Registruj Moj Godišnji</h3>
              <p className="text-sm text-slate-500 mb-4">
                Unesite period godišnjeg odmora. Zahtjev će biti automatski odobren (samo za administratore).
              </p>
              <form onSubmit={handleSubmitMyVacation} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Datum od
                  </label>
                  <input
                    type="date"
                    value={myVacationStart}
                    onChange={(e) => setMyVacationStart(e.target.value)}
                    required
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Datum do
                  </label>
                  <input
                    type="date"
                    value={myVacationEnd}
                    onChange={(e) => setMyVacationEnd(e.target.value)}
                    required
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Napomena (opcionalno)
                  </label>
                  <textarea
                    value={myVacationNote}
                    onChange={(e) => setMyVacationNote(e.target.value)}
                    rows={3}
                    placeholder="Dodatna napomena..."
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] resize-none"
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
                    className="flex-1 px-4 py-2.5 rounded-lg font-medium text-slate-600 hover:bg-gray-100"
                  >
                    Odustani
                  </button>
                  <button
                    type="submit"
                    disabled={myVacationSubmitting}
                    className="flex-1 px-4 py-2.5 rounded-lg font-bold bg-[#1a3826] text-white hover:bg-[#142d1f] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {myVacationSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Šaljem…
                      </>
                    ) : (
                      "Registruj"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* STATS TABLE */}
        {activeTab === "STATS" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase">
              <div className="col-span-3">Zaposlenik</div>
              <div className="col-span-3">Restorani</div>
              <div className="col-span-4 grid grid-cols-4 text-center">
                <span>Preneseno</span>
                <span>Ukupno</span>
                <span>Iskorišteno</span>
                <span>Preostalo</span>
              </div>
              <div className="col-span-2 text-right">Izvještaj</div>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredStats.map((u) => (
                <div
                  key={u.id}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
                >
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-xs font-bold">
                      {(u.name || "K").charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-800">{u.name}</div>
                      <div className="text-[10px] text-slate-400 uppercase">{u.department}</div>
                    </div>
                  </div>

                  <div className="col-span-3 flex flex-wrap gap-1">
                    {u.restaurantNames.map((r, i) => (
                      <span
                        key={i}
                        className="text-[9px] bg-slate-100 px-2 py-1 rounded border border-slate-200"
                      >
                        {r}
                      </span>
                    ))}
                  </div>

                  <div className="col-span-4 grid grid-cols-4 text-center font-bold text-sm">
                    <span className="text-slate-500">{u.carriedOver ?? 0}</span>
                    <span className="text-slate-400">{u.total}</span>
                    <span className="text-green-600">{u.used}</span>
                    <span className="text-orange-500">{u.remaining}</span>
                  </div>

                  <div className="col-span-2 text-right">
                    <button
                      onClick={() => exportIndividualReport(u)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-2 text-[10px] font-bold uppercase"
                    >
                      <FileText size={14} /> PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REQUESTS TABLE */}
        {activeTab === "REQUESTS" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                <tr>
                  <th className="p-4 pl-6">Radnik</th>
                  <th className="p-4">Restoran</th>
                  <th className="p-4">Period</th>
                  <th className="p-4 text-center">Dana</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right pr-6">Akcija</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className={`transition-colors ${
                      req.status === "CANCELLED" ? "bg-gray-50 opacity-75" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="p-4 pl-6">
                      <div className="font-bold text-sm text-slate-800">{req.user.name}</div>
                      <div className="text-[10px] text-slate-400">{req.user.email}</div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-semibold text-[#1a3826]">
                        {req.restaurantName ?? req.user.mainRestaurant}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-mono text-slate-600">
                      {formatDate(req.start)} <span className="text-slate-300">➜</span> {formatDate(req.end)}
                    </td>
                    <td className="p-4 text-center font-bold text-slate-700">{req.days}</td>
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
                          ? "TRAŽI PONIŠTENJE"
                          : statusLabel(req.status)}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        {req.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => handleStatus(req.id, "APPROVED")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg text-xs font-bold transition-colors"
                            >
                              <Check size={14} /> Odobri
                            </button>
                            <button
                              onClick={() => handleStatus(req.id, "RETURNED")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-xs font-bold transition-colors"
                            >
                              <RotateCcw size={14} /> Vrati
                            </button>
                            <button
                              onClick={() => handleStatus(req.id, "REJECTED")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-colors"
                            >
                              <X size={14} /> Odbij
                            </button>
                          </>
                        )}
                        {req.status === "REJECTED" && (
                          <button
                            onClick={() => handleStatus(req.id, "PENDING")}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                          >
                            <RotateCcw size={14} /> Vrati na čekanju
                          </button>
                        )}
                        {req.status === "CANCEL_PENDING" && (
                          <>
                            <button
                              onClick={() => handleStatus(req.id, "CANCELLED")}
                              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-red-700 shadow-md active:scale-95"
                            >
                              <Trash2 size={14} /> Odobri poništenje
                            </button>
                            <button
                              onClick={() => handleStatus(req.id, "APPROVED")}
                              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase"
                            >
                              <RotateCcw size={14} /> Vrati (zadrži odobrenje)
                            </button>
                          </>
                        )}
                        {req.status === "CANCELLED" && (
                          <span className="text-[10px] font-bold text-slate-400">PONIŠTENO</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* BLOCKED DAYS */}
        {activeTab === "BLOCKED" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="text-[#1a3826]" size={20} /> Novi Praznik
              </h3>
              <div className="space-y-4">
                <input
                  type="date"
                  className="w-full border border-slate-200 p-3 rounded-xl outline-none text-sm font-bold text-slate-700"
                  value={newBlockedDate}
                  onChange={(e) => setNewBlockedDate(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Naziv Praznika"
                  className="w-full border border-slate-200 p-3 rounded-xl outline-none text-sm font-bold text-slate-700"
                  value={newBlockedReason}
                  onChange={(e) => setNewBlockedReason(e.target.value)}
                />
                <button
                  onClick={handleAddBlocked}
                  className="w-full bg-[#1a3826] hover:bg-[#142e1e] text-white py-3 rounded-xl font-bold uppercase text-xs shadow-md active:scale-95"
                >
                  Dodaj
                </button>
              </div>
            </div>

            <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 uppercase tracking-tighter">
                Kalendar Neradnih Dana ({selectedYear})
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
                          if (confirm("Obrisati?")) {
                            await removeBlockedDay(d.id);
                            toast.success("Praznik uklonjen.");
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
                  <div className="col-span-full text-center py-10 text-slate-400 italic">
                    Nema definisanih praznika.
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
