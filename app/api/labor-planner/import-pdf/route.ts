import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { saveLaborData } from "@/app/actions/laborActions";
import { GOD_MODE_ROLES } from "@/lib/permissions";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const MONTH_NAMES_DE = [
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
];

function normalizeText(s: string) {
  return String(s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function extractStoreCode(text: string): string | null {
  // Tipično: "STORE 39"
  const m = text.match(/STORE\s*([0-9A-Za-z]+)/i);
  return m?.[1] ? String(m[1]).trim() : null;
}

function extractMonthYear(text: string): { month: number | null; year: number | null } {
  const yearMatch = text.match(/\b(202[5-9]|2030)\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  let month: number | null = null;
  for (let i = 0; i < MONTH_NAMES_DE.length; i++) {
    const name = MONTH_NAMES_DE[i];
    if (new RegExp(`\\b${name}\\b`, "i").test(text)) {
      month = i + 1;
      break;
    }
  }
  return { month, year };
}

function parseMaybeNumberToken(token: string): string {
  const t = token.replace(/€/g, "").replace(/\s/g, "").trim();
  // Keep as-is; client-side parseDE/pdf expects commas for decimals.
  return t;
}

function extractKoeff(text: string): string | null {
  // "Koeffizient Brutto/Netto 1,118" (ili 1.118)
  const m =
    text.match(/Koeffizient\s*Brutto\/Netto[^0-9]*([0-9][0-9.,]*)/i) ||
    text.match(/Koeffizient\s*Brutto[^0-9]*([0-9][0-9.,]*)/i);
  return m?.[1] ? String(m[1]).trim() : null;
}

function extractLabeledNumber(text: string, labelRe: RegExp): string | null {
  const m = text.match(labelRe);
  return m?.[1] ? String(m[1]).trim() : null;
}

function normalizeMonthNumber(maybe: number | null) {
  if (!maybe) return null;
  if (maybe < 1 || maybe > 12) return null;
  return maybe;
}

function parseLaborDaysFromText(text: string): {
  rows: Array<{
    bruttoUmsatz?: string;
    nettoUmsatz?: string;
    geplanteProduktivitaetPct?: string;
    produktiveStd?: string;
    sfStd?: string;
    hmStd?: string;
    nzEuro?: string;
    extraStd?: string;
  }>;
} {
  // Day rows appear like:
  // "1. So" followed by numeric cells (Brutto Umsatz, Netto Umsatz, Gepl. Prod. %, Produktive Std., SF, HM, NZ, Extra)
  // Text extraction order can vary, so we take the first 8 numeric tokens after each day label segment.

  const outRows: Array<any> = [];
  for (let i = 1; i <= 31; i++) outRows.push({});

  const dayRe = /(\d{1,2})\.\s*(Mo|Di|Mi|Do|Fr|Sa|So)(\s*\*)?/g;
  const matches = Array.from(text.matchAll(dayRe));

  const numberRe = /[-]?\d[\d.,]*/g;

  for (let mi = 0; mi < matches.length; mi++) {
    const match = matches[mi];
    const dayNum = Number(match[1]);
    if (!dayNum || dayNum < 1 || dayNum > 31) continue;

    const start = match.index ?? 0;
    const end = matches[mi + 1]?.index ?? text.length;
    const segment = text.slice(start, end);

    // Remove the day label itself to reduce chance of capturing day number.
    const segmentWithoutDay = segment.replace(dayRe, "");
    const nums = Array.from(segmentWithoutDay.matchAll(numberRe))
      .map((m) => parseMaybeNumberToken(m[0]))
      // Ne koristimo `.filter(Boolean)` jer bi "0" bilo uklonjeno i pomjerilo kolone.
      .filter((n) => n !== "");

    if (nums.length < 1) continue;

    // Expect first 8 numeric tokens correspond to columns.
    const [
      bruttoUmsatz,
      nettoUmsatz,
      geplanteProduktivitaetPct,
      produktiveStd,
      sfStd,
      hmStd,
      nzEuro,
      extraStd,
    ] = nums.slice(0, 8);

    outRows[dayNum - 1] = {
      bruttoUmsatz,
      nettoUmsatz,
      geplanteProduktivitaetPct: geplanteProduktivitaetPct ? geplanteProduktivitaetPct.replace("%", "") : undefined,
      produktiveStd,
      sfStd,
      hmStd,
      nzEuro,
      extraStd,
    };
  }

  return { rows: outRows };
}

async function userHasRestaurantAccess(restaurantId: string) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return false;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!user) return false;

  if (GOD_MODE_ROLES.has(String(user.role))) return true;

  const rel = await prisma.restaurantUser.findFirst({
    where: { userId: user.id, restaurantId },
    select: { id: true },
  });
  return !!rel;
}

export async function POST(req: Request) {
  const formData = await req.formData();

  const fallbackStoreCodeRaw = String(formData.get("storeCode") ?? "").trim();
  const fallbackYear = Number(formData.get("year") ?? "");
  const fallbackMonth = Number(formData.get("month") ?? "");

  const files = formData.getAll("files").filter(Boolean) as File[];
  if (!files.length) {
    return NextResponse.json({ success: false, error: "Keine Dateien." }, { status: 400 });
  }
  if (!fallbackStoreCodeRaw || !fallbackYear || !fallbackMonth) {
    return NextResponse.json(
      { success: false, error: "storeCode/year/month fehlen." },
      { status: 400 }
    );
  }

  const restaurantByCode = async (code: string) => {
    if (!code) return null;
    return prisma.restaurant.findUnique({ where: { code } });
  };

  const imported: Array<{ fileName: string; restaurantId: string | null; month: number | null; year: number | null; ok: boolean; error?: string }> = [];

  for (const file of files) {
    const fileName = file.name;
    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);

      const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
      let fullText = "";
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const strings = content.items.map((it: any) => it?.str).filter(Boolean);
        fullText += strings.join(" ") + "\n";
      }

      const text = normalizeText(fullText);

      const detectedStoreCode = extractStoreCode(text);
      const detectedMY = extractMonthYear(text);
      const storeCode = detectedStoreCode ?? fallbackStoreCodeRaw;
      const month = normalizeMonthNumber(detectedMY.month ?? fallbackMonth);
      const year = detectedMY.year ?? fallbackYear;

      if (!storeCode || !month || !year) {
        imported.push({ fileName, restaurantId: null, month: null, year: null, ok: false, error: "STORE/MONAT/Jahr nicht erkannt." });
        continue;
      }

      const restaurant = await restaurantByCode(String(storeCode));
      if (!restaurant) {
        imported.push({ fileName, restaurantId: null, month, year, ok: false, error: "Restaurant code nicht gefunden." });
        continue;
      }

      const canAccess = await userHasRestaurantAccess(restaurant.id);
      if (!canAccess) {
        imported.push({ fileName, restaurantId: restaurant.id, month, year, ok: false, error: "Kein Zugriff auf diesen Standort." });
        continue;
      }

      const koeff = extractKoeff(text);
      const avgWage = extractLabeledNumber(text, /Stundensatz\s*\(€\)[^0-9]*([0-9][0-9.,]*)/i);
      const vacationStd = extractLabeledNumber(text, /Urlaub\s*\(h\)[^0-9]*([0-9][0-9.,]*)/i);
      const sickStd = extractLabeledNumber(text, /Krankheit\s*\(h\)[^0-9]*([0-9][0-9.,]*)/i);
      const foerderung = extractLabeledNumber(text, /Förderung\s*\(€\)[^0-9]*([0-9][0-9.,]*)/i);
      const budgetUmsatz = extractLabeledNumber(text, /Budget\s*Umsatz[^0-9]*([0-9][0-9.,]*)/i);
      const budgetCL = extractLabeledNumber(text, /Budget\s*CL[^0-9]*€[^0-9]*([0-9][0-9.,]*)/i) || extractLabeledNumber(text, /Budget\s*CL\s*€[^0-9]*([0-9][0-9.,]*)/i);
      const budgetCLPct = extractLabeledNumber(text, /Budget\s*CL[^%]*%[^0-9]*([0-9][0-9.,]*)/i);

      const { rows } = parseLaborDaysFromText(text);

      // Ensure month/year correctness; rows are always 31.
      const payload = {
        inputs: {
          avgWage: avgWage ?? "",
          vacationStd: vacationStd ?? "",
          sickStd: sickStd ?? "",
          extraUnprodStd: "",
          koefficientBruttoNetto: koeff ?? "1,118",
          foerderung: foerderung ?? "",
          budgetUmsatz: budgetUmsatz ?? "",
          budgetCL: budgetCL ?? "",
          budgetCLPct: budgetCLPct ?? "",
        },
        rows,
      };

      const result = await saveLaborData(restaurant.id, month, year, payload as any);
      if (!result.success) {
        imported.push({ fileName, restaurantId: restaurant.id, month, year, ok: false, error: result.error });
        continue;
      }

      imported.push({ fileName, restaurantId: restaurant.id, month, year, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      imported.push({ fileName, restaurantId: null, month: fallbackMonth, year: fallbackYear, ok: false, error: msg });
    }
  }

  const okCount = imported.filter((r) => r.ok).length;
  const firstOk = imported.find((r) => r.ok);
  return NextResponse.json({
    success: true,
    importedCount: okCount,
    restaurantId: firstOk?.restaurantId ?? null,
    results: imported,
  });
}

