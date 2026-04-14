import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { openPdfInSameTab } from "@/lib/pdfUtils";
import { formatRestaurantLabel } from "@/lib/formatRestaurantLabel";
import type { AdminTrainingProgramRow, PublicTrainingProgram } from "@/app/actions/trainingActions";
import { drawMcdPdfHeader, drawMcdPdfHeaderContinuation, MCD_GREEN, MCD_GOLD } from "@/lib/mcdPdfHeader";

/* ─────────────────────────────────────────────────────────────────── */
/* Types                                                               */
/* ─────────────────────────────────────────────────────────────────── */

export type TrainingPdfParticipant = {
  lineNo: string;
  displayName: string;
  badgeCode: string | null;
  courseComment: string | null;
  resultPercent: number | null;
  assessedAt: string | null;
  assessedByName: string | null;
};

export type TrainingPdfProgram = {
  title: string;
  description: string | null;
  topics: string | null;
  prerequisites: string | null;
  scheduleMeta: string | null;
  restaurantLabel: string;
  sessions: Array<{
    title: string | null;
    startsAt: string;
    endsAt: string | null;
    location: string | null;
    notes: string | null;
    participants: TrainingPdfParticipant[];
  }>;
};

/* ─────────────────────────────────────────────────────────────────── */
/* Constants                                                           */
/* ─────────────────────────────────────────────────────────────────── */

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Colour palette
const C_INK: [number, number, number] = [15, 23, 42];
const C_MUTED: [number, number, number] = [100, 116, 139];
const C_BORDER: [number, number, number] = [226, 232, 240];
const C_SURFACE: [number, number, number] = [248, 250, 252];
const C_WHITE: [number, number, number] = [255, 255, 255];
const C_GOLD_LIGHT: [number, number, number] = [255, 250, 230];
const C_GREEN_LIGHT: [number, number, number] = [240, 253, 244];

/* ─────────────────────────────────────────────────────────────────── */
/* Date helpers                                                        */
/* ─────────────────────────────────────────────────────────────────── */

function fDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
}

function fDateShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-AT", { dateStyle: "short", timeStyle: "short" });
}

function formatZeitraum(startsAt: string, endsAt: string | null): string {
  const date = fDate(startsAt);
  const start = fTime(startsAt);
  if (!endsAt) return `${date}, ${start} Uhr`;
  const e = new Date(endsAt);
  const s = new Date(startsAt);
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  if (sameDay) return `${date}, ${start}–${fTime(endsAt)} Uhr`;
  return `${date} ${start} – ${fDate(endsAt)} ${fTime(endsAt)} Uhr`;
}

/* ─────────────────────────────────────────────────────────────────── */
/* Payload builders                                                    */
/* ─────────────────────────────────────────────────────────────────── */

function adminParticipantName(p: AdminTrainingProgramRow["sessions"][0]["participants"][0]): string {
  return (
    p.userName?.trim() ||
    [p.firstName, p.lastName].filter(Boolean).join(" ") ||
    p.userEmail ||
    "—"
  );
}

export function adminProgramToPdfPayload(program: AdminTrainingProgramRow): TrainingPdfProgram {
  const restaurantLabel =
    program.restaurants.length > 0
      ? program.restaurants.map((r) => formatRestaurantLabel(r)).filter(Boolean).join(", ")
      : "";
  return {
    title: program.title,
    description: program.description,
    topics: program.topics,
    prerequisites: program.prerequisites,
    scheduleMeta: program.scheduleMeta,
    restaurantLabel: restaurantLabel || "—",
    sessions: program.sessions.map((s) => ({
      title: s.title,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      location: s.location,
      notes: s.notes,
      participants: s.participants.map((p, idx) => ({
        lineNo: String(p.displayOrder > 0 ? p.displayOrder : idx + 1).padStart(2, "0"),
        displayName: adminParticipantName(p),
        badgeCode: p.badgeCode,
        courseComment: p.courseComment,
        resultPercent: p.resultPercent,
        assessedAt: p.assessedAt,
        assessedByName: p.assessedByName,
      })),
    })),
  };
}

export function publicProgramsToPdfPayload(programs: PublicTrainingProgram[]): TrainingPdfProgram[] {
  return programs.map((p) => {
    const restaurantLabel =
      p.restaurants.length > 0
        ? p.restaurants.map((r) => formatRestaurantLabel(r)).filter(Boolean).join(", ")
        : "";
    return {
      title: p.title,
      description: p.description,
      topics: p.topics,
      prerequisites: p.prerequisites,
      scheduleMeta: p.scheduleMeta,
      restaurantLabel: restaurantLabel || "—",
      sessions: p.sessions.map((s) => ({
        title: s.title,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        location: s.location,
        notes: s.notes,
        participants: s.participants.map((part) => ({
          lineNo: part.lineNo,
          displayName: part.displayName,
          badgeCode: part.badgeCode,
          courseComment: part.courseComment,
          resultPercent: part.resultPercent,
          assessedAt: part.assessedAt,
          assessedByName: part.assessedByName,
        })),
      })),
    };
  });
}

/* ─────────────────────────────────────────────────────────────────── */
/* Drawing primitives                                                  */
/* ─────────────────────────────────────────────────────────────────── */

function ensureSpace(doc: jsPDF, y: number, need: number, page: { n: number; total?: number }): number {
  if (y + need > PAGE_H - 18) {
    doc.addPage();
    page.n += 1;
    const yNew = drawMcdPdfHeaderContinuation(doc, "Training");
    return yNew;
  }
  return y;
}

/** Draw footer on current page: "Seite X  ·  Erstellt dd.mm.yyyy" */
function drawFooter(doc: jsPDF, pageNum: number, totalPages: number, dateStr: string): void {
  const footerY = PAGE_H - 8;
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, footerY - 3, PAGE_W - MARGIN, footerY - 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C_MUTED);
  doc.text(`Seite ${pageNum} von ${totalPages}`, MARGIN, footerY);
  doc.text(`Erstellt: ${dateStr}`, PAGE_W - MARGIN, footerY, { align: "right" });
  doc.text("aiw services · Trainingsplan", PAGE_W / 2, footerY, { align: "center" });
}

function wrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  fontSize: number,
  color: [number, number, number] = C_INK,
  style: "normal" | "bold" | "italic" = "normal"
): number {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", style);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, maxW) as string[];
  doc.text(lines, x, y);
  return y + lines.length * (fontSize * 0.42 + 0.6);
}

/* Small label above a section */
function sectionLabel(doc: jsPDF, x: number, y: number, label: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...C_MUTED);
  doc.text(label.toUpperCase(), x, y);
  return y + 3.5;
}

/* Rounded pill/badge drawn inline in PDF */
function drawPill(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fill: [number, number, number],
  textColor: [number, number, number]
): number {
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  const tw = doc.getTextWidth(text);
  const pH = 4.5;
  const pW = tw + 5;
  doc.setFillColor(...fill);
  doc.roundedRect(x, y - pH + 1, pW, pH, 1.2, 1.2, "F");
  doc.setTextColor(...textColor);
  doc.text(text, x + 2.5, y - 0.2);
  return pW + 2;
}

/* ─────────────────────────────────────────────────────────────────── */
/* Program header card                                                 */
/* ─────────────────────────────────────────────────────────────────── */

function drawProgramCard(
  doc: jsPDF,
  prog: TrainingPdfProgram,
  y: number,
  page: { n: number }
): number {
  const totalParticipants = prog.sessions.reduce((n, s) => n + s.participants.length, 0);
  const totalSessions = prog.sessions.length;

  // Set font to match size used in body text so line-count estimates are accurate
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const hasTopics = Boolean(prog.topics?.trim());
  const hasPrereqs = Boolean(prog.prerequisites?.trim());
  const hasDesc = Boolean(prog.description?.trim() && !hasTopics);

  const topicsLines = hasTopics
    ? (doc.splitTextToSize(prog.topics!.trim(), CONTENT_W - 10) as string[]).length
    : 0;
  const prereqLines = hasPrereqs
    ? (doc.splitTextToSize(prog.prerequisites!.trim(), CONTENT_W - 16) as string[]).length
    : 0;
  const descLines = hasDesc
    ? (doc.splitTextToSize(prog.description!.trim(), CONTENT_W - 10) as string[]).length
    : 0;
  const titleLineCount = (doc.splitTextToSize(prog.title, CONTENT_W - 48) as string[]).length;

  const cardH =
    4 + // gold stripe
    6 + titleLineCount * 6 + // title
    7 + // restaurant label + pill row
    (prog.scheduleMeta?.trim() ? 5 : 0) +
    (hasTopics ? 6 + topicsLines * 4.2 : 0) +
    (hasPrereqs ? 8 + prereqLines * 4.2 : 0) +
    (hasDesc ? 4 + descLines * 4.2 : 0) +
    6; // bottom padding

  y = ensureSpace(doc, y, cardH + 4, page);

  // Shadow simulation (offset slightly lighter rect)
  doc.setFillColor(235, 238, 244);
  doc.roundedRect(MARGIN + 0.6, y + 0.6, CONTENT_W, cardH, 3, 3, "F");

  // Card background
  doc.setFillColor(...C_WHITE);
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.25);
  doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 3, 3, "FD");

  // Gold top stripe (4mm)
  doc.setFillColor(...MCD_GOLD);
  doc.roundedRect(MARGIN, y, CONTENT_W, 4, 3, 3, "F");
  // Overwrite bottom corners of stripe (make it a flat bottom)
  doc.rect(MARGIN, y + 2, CONTENT_W, 2, "F");

  let cy = y + 10;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...MCD_GREEN);
  const titleLines = doc.splitTextToSize(prog.title, CONTENT_W - 48) as string[];
  doc.text(titleLines, MARGIN + 5, cy);
  cy += titleLines.length * 6;

  // Stats on the right (sessions + participants)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C_MUTED);
  const statsX = MARGIN + CONTENT_W - 4;
  doc.text(`${totalSessions} Termin${totalSessions !== 1 ? "e" : ""}`, statsX, y + 9, { align: "right" });
  doc.text(`${totalParticipants} Teilnehmer`, statsX, y + 14, { align: "right" });

  // Restaurant pills
  if (prog.restaurantLabel && prog.restaurantLabel !== "—") {
    cy = sectionLabel(doc, MARGIN + 5, cy, "Restaurant");
    const parts = prog.restaurantLabel.split(",").map((s) => s.trim()).filter(Boolean);
    let px = MARGIN + 5;
    for (const part of parts) {
      const pw = drawPill(doc, part, px, cy, [240, 253, 244], MCD_GREEN);
      px += pw;
    }
    cy += 6;
  }

  // ScheduleMeta
  if (prog.scheduleMeta?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C_MUTED);
    doc.text(prog.scheduleMeta.trim(), MARGIN + 5, cy);
    cy += 5;
  }

  // Topics
  if (hasTopics) {
    cy += 1;
    cy = sectionLabel(doc, MARGIN + 5, cy, "Inhalte / Themen");
    cy = wrappedText(doc, prog.topics!.trim(), MARGIN + 5, cy, CONTENT_W - 10, 8, C_INK);
    cy += 2;
  }

  // Prerequisites — with a subtle yellow tinted box
  if (hasPrereqs) {
    cy += 1;
    const prereqText = prog.prerequisites!.trim();
    const pLines = doc.splitTextToSize(prereqText, CONTENT_W - 16) as string[];
    const boxH = pLines.length * 3.8 + 8;
    doc.setFillColor(...C_GOLD_LIGHT);
    doc.setDrawColor(253, 230, 138);
    doc.setLineWidth(0.2);
    doc.roundedRect(MARGIN + 5, cy - 1, CONTENT_W - 10, boxH, 2, 2, "FD");
    // Gold left accent
    doc.setFillColor(...MCD_GOLD);
    doc.rect(MARGIN + 5, cy - 1, 2, boxH, "F");
    cy = sectionLabel(doc, MARGIN + 10, cy + 1, "Voraussetzungen");
    cy = wrappedText(doc, prereqText, MARGIN + 10, cy, CONTENT_W - 18, 8, [92, 60, 0]);
    cy += 4;
  }

  // Description fallback (only shown when no topics)
  if (hasDesc) {
    cy += 1;
    cy = sectionLabel(doc, MARGIN + 5, cy, "Beschreibung");
    cy = wrappedText(doc, prog.description!.trim(), MARGIN + 5, cy, CONTENT_W - 10, 8, C_MUTED);
    cy += 2;
  }

  return y + cardH + 6;
}

/* ─────────────────────────────────────────────────────────────────── */
/* Session block                                                       */
/* ─────────────────────────────────────────────────────────────────── */

function drawSession(
  doc: jsPDF,
  sess: TrainingPdfProgram["sessions"][0],
  idx: number,
  y: number,
  page: { n: number }
): number {
  y = ensureSpace(doc, y, 28, page);

  const xContent = MARGIN + 14;
  const contentW2 = CONTENT_W - 14;

  // Session number bubble (green circle)
  doc.setFillColor(...MCD_GREEN);
  doc.circle(MARGIN + 4.5, y + 4, 4.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C_WHITE);
  doc.text(String(idx + 1), MARGIN + 4.5, y + 5, { align: "center" });

  // Session heading row (light green surface)
  const dateStr = formatZeitraum(sess.startsAt, sess.endsAt);
  doc.setFillColor(...C_GREEN_LIGHT);
  doc.setDrawColor(209, 250, 229);
  doc.setLineWidth(0.2);
  doc.roundedRect(xContent - 2, y, contentW2 + 2, 9, 1.5, 1.5, "FD");

  // Title
  const sessionTitle = sess.title?.trim() ? sess.title.trim() : `Termin ${idx + 1}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...MCD_GREEN);
  doc.text(sessionTitle, xContent + 2, y + 5.5);

  // Date on the right
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C_MUTED);
  doc.text(dateStr, MARGIN + CONTENT_W - 2, y + 5.5, { align: "right" });

  y += 11;

  // Location (if any)
  if (sess.location?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(`Ort: ${sess.location.trim()}`, xContent, y);
    y += 4.5;
  }

  // Notes (if any)
  if (sess.notes?.trim()) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    const noteLines = doc.splitTextToSize(sess.notes.trim(), contentW2 - 4) as string[];
    doc.text(noteLines, xContent, y);
    y += noteLines.length * 3.5 + 2;
  }

  if (sess.participants.length === 0) {
    y = ensureSpace(doc, y, 8, page);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text("Keine Teilnehmer eingetragen.", xContent, y);
    return y + 8;
  }

  // Participant table
  y = ensureSpace(doc, y, 20, page);

  // Determine if any assessments exist
  const hasAssessments = sess.participants.some(
    (p) => p.resultPercent !== null || p.courseComment?.trim()
  );

  const head = hasAssessments
    ? [["#", "Name", "Ergebnis", "Kommentar / Bewertung"]]
    : [["#", "Name"]];

  const body = sess.participants.map((p) => {
    const name =
      p.badgeCode
        ? `${p.displayName}  (#${p.badgeCode.replace(/^#/, "")})`
        : p.displayName;
    const pct =
      p.resultPercent !== null && p.resultPercent !== undefined
        ? `${p.resultPercent} %`
        : "–";

    let commentCell = "";
    if (p.courseComment?.trim()) {
      commentCell = p.courseComment.trim();
      if (p.assessedByName) commentCell += `\n– ${p.assessedByName}`;
      if (p.assessedAt) commentCell += ` (${fDateShort(p.assessedAt)})`;
    }

    return hasAssessments ? [p.lineNo, name, pct, commentCell] : [p.lineNo, name];
  });

  const colStyles = hasAssessments
    ? {
        0: { cellWidth: 10, halign: "center" as const },
        1: { cellWidth: 55 },
        2: { cellWidth: 20, halign: "center" as const },
        3: { cellWidth: CONTENT_W - 14 - 10 - 55 - 20 },
      }
    : {
        0: { cellWidth: 10, halign: "center" as const },
        1: { cellWidth: CONTENT_W - 14 - 10 },
      };

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "plain",
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      textColor: C_INK,
      lineColor: C_BORDER,
      lineWidth: 0.15,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: MCD_GREEN,
      textColor: C_WHITE,
      fontStyle: "bold",
      fontSize: 7,
      halign: "left",
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    },
    bodyStyles: { halign: "left" },
    alternateRowStyles: { fillColor: C_SURFACE },
    columnStyles: colStyles,
    margin: { left: xContent - 2, right: MARGIN },
    didDrawCell: (data) => {
      // Highlight result % with a coloured badge
      if (hasAssessments && data.column.index === 2 && data.section === "body") {
        const text = data.cell.text.join("").trim();
        if (text && text !== "–") {
          const pctVal = parseInt(text);
          const fill: [number, number, number] =
            pctVal >= 80 ? [220, 252, 231] : pctVal >= 50 ? [255, 250, 230] : [254, 226, 226];
          const tc: [number, number, number] =
            pctVal >= 80 ? [22, 101, 52] : pctVal >= 50 ? [92, 60, 0] : [153, 27, 27];
          const { x, y: cy2, width: w, height: h } = data.cell;
          const pad = 1.2;
          doc.setFillColor(...fill);
          doc.roundedRect(x + pad, cy2 + pad, w - pad * 2, h - pad * 2, 1.5, 1.5, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(...tc);
          doc.text(text, x + w / 2, cy2 + h / 2 + 0.8, { align: "center" });
        }
      }
    },
  });

  const docExt = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  y = (docExt.lastAutoTable?.finalY ?? y) + 6;
  return y;
}

/* ─────────────────────────────────────────────────────────────────── */
/* Main PDF builder                                                    */
/* ─────────────────────────────────────────────────────────────────── */

function buildPdf(programs: TrainingPdfProgram[]): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const page = { n: 1 };
  const today = new Date().toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // First page header
  let y = drawMcdPdfHeader(doc, {
    documentTitle: "Schulungsplan",
    rightBadgeText: String(new Date().getFullYear()),
    headerHeight: 30,
  });

  // Subtitle row
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C_MUTED);
  const subtitle =
    programs.length === 1
      ? programs[0]!.title
      : `${programs.length} Programme`;
  doc.text(subtitle, MARGIN, y);
  y += 8;

  // Programs
  for (let pi = 0; pi < programs.length; pi++) {
    const prog = programs[pi]!;

    // Program card (title + meta + topics)
    y = drawProgramCard(doc, prog, y, page);

    // Sessions
    for (let si = 0; si < prog.sessions.length; si++) {
      y = drawSession(doc, prog.sessions[si]!, si, y, page);
    }

    // Separator between programs
    if (pi < programs.length - 1) {
      y = ensureSpace(doc, y, 12, page);
      doc.setDrawColor(...MCD_GOLD);
      doc.setLineWidth(0.6);
      doc.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
      y += 10;
    }
  }

  // Draw footers on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, totalPages, today);
  }

  return doc;
}

/* ─────────────────────────────────────────────────────────────────── */
/* Public API                                                          */
/* ─────────────────────────────────────────────────────────────────── */

export function openTrainingSchedulePdfFromPublic(programs: PublicTrainingProgram[]): void {
  openPdfInSameTab(buildPdf(publicProgramsToPdfPayload(programs)));
}

export function openTrainingSchedulePdfFromAdmin(program: AdminTrainingProgramRow): void {
  openPdfInSameTab(buildPdf([adminProgramToPdfPayload(program)]));
}
