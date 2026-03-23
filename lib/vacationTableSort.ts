import { Role } from "@prisma/client";

/** Niži broj = više u tablici Admin Urlaub (admin uloge su već izuzete iz liste). */
const ROLE_RANK: Record<string, number> = {
  [Role.MANAGER]: 0,
  [Role.MANAGEMENT]: 1,
  [Role.MITARBEITER]: 2,
};

export type VacationTableSortableUser = {
  role?: string | null;
  name?: string | null;
  /** Iz RestaurantUser za aktivni restoran; 0 = automatski (hijerarhija + ime) */
  vacationListOrder?: number | null;
};

export function vacationTableRoleRank(role: string | null | undefined): number {
  if (!role) return 99;
  return ROLE_RANK[role] ?? 98;
}

function roleThenNameCmp<T extends VacationTableSortableUser>(a: T, b: T): number {
  const ra = vacationTableRoleRank(a.role ?? null);
  const rb = vacationTableRoleRank(b.role ?? null);
  if (ra !== rb) return ra - rb;
  return (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase(), "de", { numeric: true });
}

/**
 * Sort: ako itko ima vacationListOrder > 0, prvo po tom polju (0 ide na kraj među „bez pozicije“),
 * inače čisto hijerarhija + ime.
 */
export function sortUserStatsForVacationTable<T extends VacationTableSortableUser>(rows: T[]): T[] {
  const hasExplicit = rows.some((r) => (r.vacationListOrder ?? 0) > 0);
  if (!hasExplicit) {
    return [...rows].sort(roleThenNameCmp);
  }
  return [...rows].sort((a, b) => {
    const oa = a.vacationListOrder ?? 0;
    const ob = b.vacationListOrder ?? 0;
    const za = oa <= 0;
    const zb = ob <= 0;
    if (za && zb) return roleThenNameCmp(a, b);
    if (za && !zb) return 1;
    if (!za && zb) return -1;
    if (oa !== ob) return oa - ob;
    return roleThenNameCmp(a, b);
  });
}
