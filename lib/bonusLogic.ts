// Pure bonus calculation logic ported 1:1 from 25-01-2026-15-35_PORTABLE.html
// Formulas and data flow are intentionally kept identical to the original JS.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type BonusGoal = { name: string; w: number };

export type BonusPillar = {
  name: string;
  weight: number;
  enabled?: boolean;
  goals: BonusGoal[];
};

export type BonusPillars = {
  fin: BonusPillar;
  ops: BonusPillar;
  ind: BonusPillar;
};

export type BonusFactors = {
  tenure: number;
  size: number;
  office: number;
};

export type BonusFulfill = {
  fin: number[];
  ops: number[];
  ind: number[];
};

export type BonusSettings = {
  baseMonths: number;
  capPct: number;
  factorMode: "multiply" | "average";
  capFactor: boolean;
};

export type BonusEmployee = {
  id: string;
  name: string;
  dept: string;
  salary: number;
  baseMonths?: number;
  factors: BonusFactors;
  fulfill: BonusFulfill;
  firstName?: string;
  lastName?: string;
  [key: string]: any;
};

export const BONUS_YEARS = [2025, 2026, 2027, 2028, 2029, 2030] as const;

export type BonusUIState = {
  tab: "employee" | "goals" | "overview" | "results";
  empView: "stammdaten" | "daten";
  goalsDept: string;
  goalsMode: "dept" | "emp";
  goalsEmpId: string | null;
  selectedEmpId: string | null;
  /** Godina za koji se vodi bonus (2025–2030). */
  selectedYear?: number;
  ovQuery?: string;
  [key: string]: any;
};

export type BonusPillarsByDept = {
  RL: BonusPillars;
  AL: BonusPillars;
  Office: BonusPillars;
  [key: string]: BonusPillars;
};

export type BonusEmpOverrides = Record<string, BonusPillars>;

export type BonusState = {
  settings: BonusSettings;
  pillarsByDept: BonusPillarsByDept;
  empGoalOverrides: BonusEmpOverrides;
  employees: BonusEmployee[];
  ui: BonusUIState;
};

// --- Helpers (ported exactly) ---

export function uid(): string {
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}

export function num(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

export function pct01(p: any): number {
  return clamp(num(p, 100) / 100, 0, 1.2);
}

export function deptKey(d: string): string {
  return d === "Finanz/Lohnbuchhaltung" ? "Office" : d;
}

export function splitName(raw: any): { first: string; last: string } {
  const s = String(raw || "").trim();
  if (!s) return { first: "", last: "" };
  if (s.includes(",")) {
    const parts = s.split(",");
    return { last: (parts[0] || "").trim(), first: parts.slice(1).join(",").trim() };
  }
  const toks = s.split(/\s+/).filter(Boolean);
  if (toks.length === 1) return { first: toks[0], last: "" };

  const hasLower = (w: string) => /[a-zäöüß]/.test(w);
  const isAllCapsWord = (w: string) => /^[A-ZÄÖÜß\-]+$/.test(w);

  // If name starts with ALLCAPS token(s) and then a token with lowercase -> treat as "LAST First..."
  if (isAllCapsWord(toks[0]) && toks[1] && hasLower(toks[1])) {
    let i = 0;
    const lastParts: string[] = [];
    while (i < toks.length && isAllCapsWord(toks[i])) {
      lastParts.push(toks[i]);
      i++;
    }
    return { last: lastParts.join(" "), first: toks.slice(i).join(" ") };
  }
  // Default: "First ... Last"
  return { first: toks.slice(0, -1).join(" "), last: toks[toks.length - 1] };
}

export function displayName(emp: any): string {
  const titleCase = (s: string) => {
    return String(s || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => {
        const lw = w.toLowerCase();
        return lw.charAt(0).toUpperCase() + lw.slice(1);
      })
      .join(" ");
  };

  // Preferred: explicit fields (Excel / getrennte Felder)
  const ln0 =
    emp && (emp.lastName || emp.last || emp.nachname) ? String(emp.lastName || emp.last || emp.nachname).trim() : "";
  const fn0 =
    emp && (emp.firstName || emp.first || emp.vorname)
      ? String(emp.firstName || emp.first || emp.vorname).trim()
      : "";
  if (ln0 || fn0) {
    const ln = ln0 ? ln0.toUpperCase() : "";
    const fn = fn0 ? titleCase(fn0) : "";
    return (ln + (ln && fn ? " " : "") + fn).trim();
  }

  // Fallback: parse emp.name (unterstützt sowohl "Vorname Nachname" als auch "NACHNAME Vorname" und "Nachname, Vorname")
  const raw = emp && emp.name ? String(emp.name).trim() : "";
  if (!raw) return "";

  const sp = splitName(raw);
  const ln = (sp.last || "").trim().toUpperCase();
  const fn = titleCase((sp.first || "").trim());

  if (ln && fn) return ln + " " + fn;
  return ln || fn || raw;
}

export function defaultPillars(): BonusPillars {
  return {
    fin: {
      name: "Finanz",
      weight: 0.5,
      enabled: true,
      goals: [
        { name: "Umsatz", w: 40 },
        { name: "Kostenquote", w: 30 },
        { name: "Gewinn", w: 30 },
      ],
    },
    ops: {
      name: "Operation",
      weight: 0.3,
      enabled: true,
      goals: [
        { name: "Personalfluktuation", w: 20 },
        { name: "Krankheitsquote", w: 15 },
        { name: "Audit / Qualität", w: 25 },
        { name: "Gästezufriedenheit", w: 40 },
      ],
    },
    ind: {
      name: "Individuell",
      weight: 0.2,
      enabled: true,
      goals: [
        { name: "Führung", w: 40 },
        { name: "Projekte", w: 30 },
        { name: "Entwicklung", w: 30 },
      ],
    },
  };
}

export function defaultState(): BonusState {
  const pillarsByDept: BonusPillarsByDept = {
    RL: defaultPillars(),
    AL: defaultPillars(),
    Office: {
      fin: { name: "Finanz", weight: 0.5, enabled: true, goals: [{ name: "Office Ziel 1", w: 100 }] },
      ops: { name: "Operation", weight: 0.3, enabled: true, goals: [{ name: "Office Ziel 2 (optional)", w: 100 }] },
      ind: { name: "Individuell", weight: 0.2, enabled: true, goals: [{ name: "Individuell", w: 100 }] },
    },
  };

  return {
    settings: { baseMonths: 3, capPct: 120, factorMode: "multiply", capFactor: true },
    pillarsByDept,
    empGoalOverrides: {},
    // Zaposlenici se sada pune iz baze (prisma.user) preko syncEmployeesWithUsers.
    employees: [],
    ui: {
      tab: "employee",
      empView: "stammdaten",
      goalsDept: "RL",
      goalsMode: "dept",
      goalsEmpId: null,
      selectedEmpId: null,
    },
  };
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function sanitizePillarsObj(pillars: any, fallback: BonusPillars): BonusPillars {
  const out: any = {};
  for (const k of ["fin", "ops", "ind"] as const) {
    const fb = (fallback as any)[k];
    const p = pillars?.[k] || fb;
    out[k] = {
      name: String(p.name ?? fb.name),
      enabled: typeof p.enabled === "boolean" ? p.enabled : fb.enabled ?? true,
      weight: clamp(num(p.weight, fb.weight), 0, 1),
      goals: (Array.isArray(p.goals) ? p.goals : fb.goals).map((g: any) => ({
        name: String(g.name ?? "Ziel"),
        w: clamp(num(g.w, 0), 0, 100),
      })),
    };
  }
  return out as BonusPillars;
}

export function syncEmpFulfill(emp: BonusEmployee, state: BonusState): void {
  const p = getPillarsForEmp(emp, state);
  for (const k of ["fin", "ops", "ind"] as const) {
    const fulf = (emp.fulfill as any)[k] as number[] | undefined;
    (emp.fulfill as any)[k] = Array.isArray(fulf) ? fulf : [];
    const arr = (emp.fulfill as any)[k] as number[];
    while (arr.length < p[k].goals.length) arr.push(100);
    if (arr.length > p[k].goals.length) (emp.fulfill as any)[k] = arr.slice(0, p[k].goals.length);
  }
}

export function syncAll(state: BonusState): void {
  for (const e of state.employees) syncEmpFulfill(e, state);
}

export function getPillarsForEmp(emp: BonusEmployee, state: BonusState): BonusPillars {
  const ov = state.empGoalOverrides?.[emp.id];
  if (ov && typeof ov === "object") {
    return ov;
  }
  return state.pillarsByDept[deptKey(emp.dept)];
}

export function setEmpOverride(empId: string, pillarsObj: BonusPillars, state: BonusState): void {
  if (!state.empGoalOverrides) (state as any).empGoalOverrides = {};
  state.empGoalOverrides[empId] = pillarsObj;
}

export function clearEmpOverride(empId: string, state: BonusState): void {
  if (state.empGoalOverrides && state.empGoalOverrides[empId]) {
    delete state.empGoalOverrides[empId];
  }
}

export function hasEmpOverride(empId: string, state: BonusState): boolean {
  return !!(state.empGoalOverrides && state.empGoalOverrides[empId]);
}

// --- Core math functions (ported as-is) ---

export function factorFor(emp: BonusEmployee, state: BonusState): number {
  if (emp.dept === "Office" || emp.dept === "Finanz/Lohnbuchhaltung")
    return clamp(emp.factors.office, 0.8, 1.2);
  const f1 = clamp(emp.factors.tenure, 0.8, 1.2);
  const f2 = clamp(emp.factors.size, 0.8, 1.2);
  let f = state.settings.factorMode === "average" ? (f1 + f2) / 2 : f1 * f2;
  if (state.settings.capFactor) f = clamp(f, 0.8, 1.2);
  return f;
}

export function pillarScore(emp: BonusEmployee, key: "fin" | "ops" | "ind", state: BonusState): number {
  const p = (getPillarsForEmp(emp, state) as any)[key] as BonusPillar;
  let sum = 0;
  for (let i = 0; i < p.goals.length; i++) {
    const w = num(p.goals[i].w, 0) / 100;
    const a = pct01((emp.fulfill as any)[key][i] ?? 100);
    sum += w * a;
  }
  return clamp(sum, 0, 1.2);
}

export type TotalScoreResult = {
  fin: number;
  ops: number;
  ind: number;
  total: number;
  eff: { fin: number; ops: number; ind: number; baseSum: number };
};

export function totalScore(emp: BonusEmployee, state: BonusState): TotalScoreResult {
  const eff = effectiveWeightsForDeptForPillars(getPillarsForEmp(emp, state));
  const fin = pillarScore(emp, "fin", state);
  const ops = pillarScore(emp, "ops", state);
  const ind = pillarScore(emp, "ind", state);

  // Redistribute pillar weights across enabled pillars
  const total = clamp(fin * eff.fin + ops * eff.ops + ind * eff.ind, 0, 1.2);
  return { fin, ops, ind, total, eff };
}

export type PayoutResult = TotalScoreResult & {
  base: number;
  factor: number;
  cap: number;
  payout: number;
  raw: number;
};

export function payout(emp: BonusEmployee, state: BonusState): PayoutResult {
  const s = totalScore(emp, state);
  const base = emp.salary * (emp.baseMonths ?? state.settings.baseMonths);
  const factor = factorFor(emp, state);
  const raw = base * s.total * factor;
  const cap = base * (state.settings.capPct / 100);
  const out = clamp(raw, 0, cap);
  return { ...s, base, factor, cap, payout: out, raw };
}

export function weightSum(pillar: BonusPillar): number {
  return pillar.goals.reduce((a, g) => a + num(g.w, 0), 0);
}

export function effectiveWeightsForPillars(pb: BonusPillars): {
  fin: number;
  ops: number;
  ind: number;
  baseSum: number;
} {
  const enabledKeys = ["fin", "ops", "ind"].filter((k) => (pb as any)[k].enabled !== false);
  const baseSum = enabledKeys.reduce((a, k) => a + ((pb as any)[k].weight || 0), 0);
  const eff: any = { fin: 0, ops: 0, ind: 0, baseSum };
  if (baseSum <= 0) {
    return eff;
  }
  for (const k of enabledKeys) {
    eff[k] = ((pb as any)[k].weight || 0) / baseSum;
  }
  return eff;
}

export function effectiveWeightsForDeptForPillars(pb: BonusPillars) {
  return effectiveWeightsForPillars(pb);
}

// --- State sanitization (ported) ---

export function sanitize(input: any): BonusState {
  const def = defaultState();
  const state: BonusState = input && typeof input === "object" ? (deepClone(input) as BonusState) : def;

  state.settings = (state as any).settings || def.settings;
  state.settings = {
    baseMonths: Math.max(0, num(state.settings.baseMonths, 3)),
    capPct: Math.max(0, num(state.settings.capPct, 120)),
    factorMode: state.settings.factorMode === "average" ? "average" : "multiply",
    capFactor: !!state.settings.capFactor,
  };

  state.pillarsByDept = (state as any).pillarsByDept || def.pillarsByDept;
  for (const dept of ["RL", "Office", "AL"]) {
    if (!state.pillarsByDept[deptKey(dept)]) {
      (state.pillarsByDept as any)[deptKey(dept)] = def.pillarsByDept[deptKey(dept)];
    }
    for (const k of ["fin", "ops", "ind"] as const) {
      const fb = (def.pillarsByDept[deptKey(dept)] as any)[k];
      const existing = (state.pillarsByDept[deptKey(dept)] as any)[k] || fb;
      const p: any = existing;
      p.name = String(p.name ?? fb.name);
      p.enabled = typeof p.enabled === "boolean" ? p.enabled : fb.enabled ?? true;
      p.weight = clamp(num(p.weight, fb.weight), 0, 1);
      p.goals = Array.isArray(p.goals) ? p.goals : fb.goals;
      p.goals = p.goals.map((g: any) => ({
        name: String(g.name ?? "Ziel"),
        w: clamp(num(g.w, 0), 0, 100),
      }));
      (state.pillarsByDept[deptKey(dept)] as any)[k] = p;
    }
  }

  // Mitarbeiter-spezifische Ziel-Overrides
  state.empGoalOverrides =
    state.empGoalOverrides && typeof state.empGoalOverrides === "object" ? state.empGoalOverrides : {};
  for (const [empId, pov] of Object.entries(state.empGoalOverrides)) {
    if (!pov || typeof pov !== "object") {
      delete state.empGoalOverrides[empId];
      continue;
    }
    // fallback uses RL defaults (will be corrected per employee in render/sync)
    const fb = def.pillarsByDept.RL;
    state.empGoalOverrides[empId] = sanitizePillarsObj(pov, fb);
  }

  state.employees = Array.isArray((state as any).employees) ? (state as any).employees : def.employees;
  state.employees = state.employees.map((e: any, i: number) => {
    const dept =
      e.dept === "RL" || e.dept === "Office" || e.dept === "Finanz/Lohnbuchhaltung" || e.dept === "AL"
        ? e.dept
        : "RL";
    return {
      id: String(e.id ?? uid()),
      name: String(e.name ?? `MA ${i + 1}`),
      dept,
      salary: Math.max(0, num(e.salary, 0)),
      baseMonths: Math.max(0, num(e.baseMonths ?? state.settings.baseMonths, state.settings.baseMonths)),
      factors: {
        tenure: clamp(num(e.factors?.tenure, 1.0), 0.8, 1.2),
        size: clamp(num(e.factors?.size, 1.0), 0.8, 1.2),
        office: clamp(num(e.factors?.office, 1.0), 0.8, 1.2),
      },
      fulfill: e.fulfill && typeof e.fulfill === "object" ? e.fulfill : { fin: [], ops: [], ind: [] },
    } as BonusEmployee;
  });

  state.ui = (state as any).ui || def.ui;
  state.ui.tab = state.ui.tab === "goals" || state.ui.tab === "results" || state.ui.tab === "overview"
    ? state.ui.tab
    : "employee";
  state.ui.empView = state.ui.empView === "daten" ? "daten" : "stammdaten";
  const yr = num(state.ui.selectedYear, def.ui.selectedYear ?? new Date().getFullYear());
  state.ui.selectedYear = yr >= 2025 && yr <= 2030 ? yr : BONUS_YEARS[0];
  state.ui.goalsDept =
    state.ui.goalsDept === "Office" ||
    state.ui.goalsDept === "Finanz/Lohnbuchhaltung" ||
    state.ui.goalsDept === "AL"
      ? state.ui.goalsDept
      : "RL";
  state.ui.goalsMode = state.ui.goalsMode === "emp" ? "emp" : "dept";
  state.ui.goalsEmpId = state.ui.goalsEmpId ?? (state.employees[0]?.id ?? null);
  state.ui.selectedEmpId = state.ui.selectedEmpId ?? (state.employees[0]?.id ?? null);

  syncAll(state);
  if (state.ui.selectedEmpId && !state.employees.some((x) => x.id === state.ui.selectedEmpId)) {
    state.ui.selectedEmpId = state.employees[0]?.id ?? null;
  }

  return state;
}

