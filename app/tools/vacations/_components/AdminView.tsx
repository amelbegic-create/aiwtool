/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo } from "react";
import {
  updateVacationStatus,
  addBlockedDay,
  removeBlockedDay,
  getGlobalVacationStats,
} from "@/app/actions/vacationActions";
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

// Približan naziv boje na bosanskom (za legendu)
function rgbToColorName(rgb: RGB): string {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 40) {
    if (max < 100) return "Siva";
    return "Svijetlo siva";
  }
  if (r === max && r > 180 && g < 100 && b < 100) return "Crvena";
  if (g === max && g > 180 && r < 100 && b < 100) return "Zelena";
  if (b === max && b > 180 && r < 100 && g < 100) return "Plava";
  if (r === max && b > g && r > 150) return "Ljubičasta";
  if (r === max && g > b && r > 180) return "Narančasta";
  if (r > 200 && g < 150 && b < 150) return "Roze";
  if (g > r && g > b && b > r) return "Teal";
  if (g === max) return "Zelena";
  if (b === max) return "Plava";
  if (r === max) return "Crvena";
  return "Siva";
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
// ✅ NOVO: Jedinstveni header za sve PDF exporte
// ===============================
function drawPdfHeader(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(26, 56, 38);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 30, "F");

  doc.setTextColor(255, 199, 44);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("AIW Services", 14, 12);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(title, 14, 22);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(255, 199, 44);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, 14, 28);
  }
}

// Potpis na kraju dokumenta (za print)
function drawSignatureLine(doc: jsPDF, y: number, label: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(label, 14, y);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  const lineW = 60;
  doc.line(14, y + 4, 14 + lineW, y + 4);
}

export default function AdminView({
  allRequests,
  blockedDays,
  usersStats,
  selectedYear,
  reportRestaurantLabel,
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("STATS");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  // State za praznike
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");

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
    status: "APPROVED" | "REJECTED" | "RETURNED" | "CANCELLED"
  ) => {
    const messages: any = {
      APPROVED: "Odobriti ovaj zahtjev?",
      REJECTED: "Odbiti ovaj zahtjev?",
      RETURNED: "Vratiti zahtjev radniku na doradu?",
      CANCELLED: "Odobriti poništenje godišnjeg odmora? Ovo će osloboditi dane radniku.",
    };
    if (confirm(messages[status])) {
      await updateVacationStatus(id, status);
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

    const depRGB = resolveDeptRGB(user);

    drawPdfHeader(
      doc,
      "IZVJEŠTAJ O GODIŠNJEM ODMORU",
      `Godina: ${selectedYear} • Generirano: ${formatDate(new Date().toISOString())}`
    );

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

    // KPI boxovi
    const startY = 66;
    const boxW = 60;
    const boxH = 22;

    // Ukupno
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, startY, boxW, boxH, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("UKUPNO DANA", 18, startY + 7);
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(String(user.total), 18, startY + 17);

    // Iskorišteno
    doc.roundedRect(14 + boxW + 6, startY, boxW, boxH, 3, 3, "FD");
    doc.setFontSize(8);
    doc.setTextColor(22, 163, 74);
    doc.text("ISKORIŠTENO", 18 + boxW + 6, startY + 7);
    doc.setFontSize(16);
    doc.setTextColor(21, 128, 61);
    doc.text(String(user.used), 18 + boxW + 6, startY + 17);

    // Preostalo (odjel boja)
    doc.setFillColor(depRGB[0], depRGB[1], depRGB[2]);
    doc.setDrawColor(depRGB[0], depRGB[1], depRGB[2]);
    doc.roundedRect(14 + (boxW + 6) * 2, startY, boxW, boxH, 3, 3, "FD");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("PREOSTALO", 18 + (boxW + 6) * 2, startY + 7);
    doc.setFontSize(16);
    doc.text(String(user.remaining), 18 + (boxW + 6) * 2, startY + 17);

    const tableBody = userRequests.map((req) => [
      `${formatDate(req.start)} - ${formatDate(req.end)}`,
      req.days,
      statusLabel(req.status),
    ]);

    // Clean tabela: bez “teškog grida”
    autoTable(doc, {
      startY: startY + 32,
      head: [["Period", "Dana", "Status"]],
      body: tableBody,
      theme: "plain",
      styles: {
        fontSize: 10,
        cellPadding: 3,
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [26, 56, 38],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 110 },
        1: { halign: "center", cellWidth: 20 },
        2: { halign: "center", cellWidth: 50 },
      },
      didDrawCell: (data) => {
        // Lagana linija ispod svakog reda (clean)
        if (data.section === "body") {
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
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
    const headerSubtitle = reportRestaurantLabel
      ? `Godina: ${selectedYear} • ${reportRestaurantLabel}`
      : `Godina: ${selectedYear}`;
    drawPdfHeader(doc, `STATUS GODIŠNJIH ODMORA`, headerSubtitle);

    const restaurantDisplay = (names: string[]) =>
      names.length > 2 ? "Svi restorani" : names.join(", ");

    const data = statsToUse.map((u) => [
      u.name || "N/A",
      (u.department || "N/A").toString(),
      restaurantDisplay(u.restaurantNames),
      u.total,
      u.used,
      u.remaining,
    ]);

    autoTable(doc, {
      startY: 38,
      head: [["Ime i prezime", "Odjel", "Restorani", "Ukupno", "Iskorišteno", "Preostalo"]],
      body: data,
      theme: "plain",
      styles: {
        fontSize: 9.5,
        cellPadding: 4,
        textColor: [15, 23, 42],
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: false,
        textColor: [15, 23, 42],
        fontStyle: "bold",
        halign: "center",
        lineWidth: 0.2,
        lineColor: [226, 232, 240],
        fontSize: 8,
      },
      bodyStyles: {
        fillColor: false,
        textColor: [15, 23, 42],
        lineWidth: 0.2,
        lineColor: [226, 232, 240],
      },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold", cellWidth: 45 },
        1: { halign: "center", cellWidth: 22 },
        2: { halign: "left", cellWidth: 50 },
        3: { halign: "center", cellWidth: 20 },
        4: { halign: "center", cellWidth: 24 },
        5: { halign: "center", cellWidth: 20 },
      },
      didDrawCell: (draw) => {
        // Linija ispod samo za redove s podacima (head i body)
        if (draw.section === "head" || draw.section === "body") {
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          const xLeft = draw.table.settings.margin.left;
          const xRight = 210 - draw.table.settings.margin.right;
          doc.line(xLeft, draw.cell.y + draw.cell.height, xRight, draw.cell.y + draw.cell.height);
        }
      },
      margin: { left: 14, right: 14 },
    });

    const tableEndY = (doc as any).lastAutoTable?.finalY ?? 38;
    const sigY = Math.max(tableEndY + 20, 270);
    drawSignatureLine(doc, sigY, "Potpis nadređene osobe:");

    doc.save(`Tabela_Godisnjih_${selectedYear}.pdf`);
  };

  // =====================================================================
  // 3. VIZUALNI TIMELINE — CLEAN + boje po odjelu
  // =====================================================================
  const exportTimelinePDF = (overrideStats?: UserStat[], overrideRequests?: RequestWithUser[]) => {
    const statsToUse = overrideStats || filteredStats;
    const requestsToUse = overrideRequests || allRequests;

    const doc = new jsPDF("l", "mm", "a3");
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    const marginLeft = 62;
    const marginRight = 14;
    const marginTop = 40;
    const marginBottom = 18;

    const gridWidth = width - marginLeft - marginRight;
    const monthWidth = gridWidth / 12;
    const rowHeight = 9; // malo kompaktnije i “clean”

    drawPdfHeader(doc, `GLOBALNI PLAN I RASPORED`, `Godina: ${selectedYear}`);

    const months = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

    // header za mjesece
    doc.setFillColor(248, 250, 252);
    doc.rect(marginLeft, marginTop - 10, gridWidth, 10, "F");
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    months.forEach((m, i) => {
      const x = marginLeft + i * monthWidth;
      doc.text(m, x + monthWidth / 2, marginTop - 4, { align: "center" });
    });
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.35);
    doc.line(marginLeft, marginTop, width - marginRight, marginTop);

    let currentY = marginTop;

    const drawRowSeparator = (y: number) => {
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.35);
      doc.line(10, y, width - 10, y);
    };

    statsToUse.forEach((user, index) => {
      if (currentY > height - marginBottom) {
        doc.addPage();
        drawPdfHeader(doc, `GLOBALNI PLAN I RASPORED`, `Godina: ${selectedYear}`);

        // ponovi mjesec header na novoj stranici
        doc.setFillColor(248, 250, 252);
        doc.rect(marginLeft, marginTop - 10, gridWidth, 10, "F");
        doc.setTextColor(51, 65, 85);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);

        months.forEach((m, i) => {
          const x = marginLeft + i * monthWidth;
          doc.text(m, x + monthWidth / 2, marginTop - 4, { align: "center" });
        });

        currentY = marginTop;
      }

      // ime (bez zebra pozadine — prazno ispod korisnika)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(user.name || "N/A", 12, currentY + 6);

      // linije samo za ovaj red: horizontalna ispod + vertikalne za ovu visinu reda (čiste, oštre)
      drawRowSeparator(currentY + rowHeight);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.35);
      for (let i = 0; i <= 12; i++) {
        const x = marginLeft + i * monthWidth;
        doc.line(x, currentY, x, currentY + rowHeight);
      }
      doc.line(width - marginRight, currentY, width - marginRight, currentY + rowHeight);

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

    // Linije samo do zadnjeg reda: vertikalna lijeva granica (stupac imena)
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.35);
    doc.line(marginLeft, marginTop - 10, marginLeft, currentY);

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
    doc.text("Boja – Odjel koji je. Crvena linija = praznik unutar godišnjeg.", 15, legendY);

    legendY += 10;
    const boxW = 5;
    const boxH = 3.5;
    const gap = 2;
    const itemGap = 28;
    let legendX = 15;
    deptLegendItems.forEach((item) => {
      const colorName = rgbToColorName(item.rgb);
      const label = `${colorName} – ${item.name}`;
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

    const sigY = legendY + 12;
    if (sigY < height - marginBottom) {
      drawSignatureLine(doc, sigY, "Potpis odgovorne osobe:");
    } else {
      doc.addPage();
      drawPdfHeader(doc, `GLOBALNI PLAN I RASPORED`, `Godina: ${selectedYear}`);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text("Boja – Odjel koji je. Crvena linija = praznik unutar godišnjeg.", 15, 40);
      drawSignatureLine(doc, 54, "Potpis odgovorne osobe:");
    }

    doc.save(`Globalni_Plan_${selectedYear}.pdf`);
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex justify-between items-end border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter mb-2">
              ADMIN <span className="text-[#FFC72C]">GODIŠNJI</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium">Upravljanje odsustvima ({selectedYear})</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button
              onClick={() => setActiveTab("STATS")}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "STATS" ? "bg-[#1a3826] text-white" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              STATISTIKA
            </button>

            {/* DUGME ZAHTJEVI SA NOTIFIKACIJOM */}
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
              </div>
            )}
          </div>
        )}

        {/* STATS TABLE */}
        {activeTab === "STATS" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase">
              <div className="col-span-3">Zaposlenik</div>
              <div className="col-span-3">Restorani</div>
              <div className="col-span-4 grid grid-cols-3 text-center">
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

                  <div className="col-span-4 grid grid-cols-3 text-center font-bold text-sm">
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
                      <div className="text-[10px] text-slate-400 uppercase">{req.user.mainRestaurant}</div>
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
                          : req.status === "CANCELLED"
                          ? "PONIŠTENO"
                          : req.status === "RETURNED"
                          ? "VRAĆENO"
                          : req.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex justify-end gap-2">
                        {req.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => handleStatus(req.id, "APPROVED")}
                              className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded transition-colors"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => handleStatus(req.id, "RETURNED")}
                              className="p-2 bg-orange-50 hover:bg-orange-100 text-orange-500 rounded transition-colors"
                            >
                              <RotateCcw size={16} />
                            </button>
                            <button
                              onClick={() => handleStatus(req.id, "REJECTED")}
                              className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                        {req.status === "CANCEL_PENDING" && (
                          <button
                            onClick={() => handleStatus(req.id, "CANCELLED")}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-red-700 shadow-md active:scale-95"
                          >
                            <Trash2 size={14} /> ODOBRI PONIŠTENJE
                          </button>
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
                        onClick={() => {
                          if (confirm("Obrisati?")) removeBlockedDay(d.id);
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
