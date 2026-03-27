/**
 * Dijeljene tipovi i pomoćne funkcije za CL (Labor Planner) lock.
 * Mora biti izvan "use server" datoteke jer klijent importa defaultClState,
 * a Next.js zahtijeva da su sve exportane funkcije u server action modulima async.
 */
import { GOD_MODE_ROLES } from "@/lib/permissions";

/**
 * Privremeni feature-flag: CL lock UI/flow je isključen.
 * Kad nađeš bolje rješenje, samo prebaci na true i vrati UI.
 */
export const CL_LOCK_ENABLED = false;

export interface LaborDayInput {
  bruttoUmsatz?: string;
  nettoUmsatz?: string;
  geplanteProduktivitaetPct?: string;
  produktiveStd?: string;
  sfStd?: string;
  hmStd?: string;
  nzEuro?: string;
  extraStd?: string;
  /** @deprecated use bruttoUmsatz */
  umsatz?: string;
  /** @deprecated use geplanteProduktivitaetPct / produktiveStd */
  prod?: string;
  /** @deprecated use nzEuro */
  nz?: string;
  /** @deprecated use extraStd */
  extra?: string;
  [key: string]: string | undefined;
}

export interface LaborInputs {
  avgWage?: string;
  vacationStd?: string;
  sickStd?: string;
  extraUnprodStd?: string;
  koefficientBruttoNetto?: string;
  foerderung?: string;
  taxAustria?: string;
  budgetUmsatz?: string;
  budgetCL?: string;
  budgetCLPct?: string;
}

export interface LaborPlanPayload {
  inputs?: LaborInputs;
  rows?: LaborDayInput[];
  /** Tagesnotizen pro Kalendertag (1–31) im gewählten Monat, je Restaurant im LaborReport. */
  dayComments?: Record<string, string>;
}

export type LaborAuthContext = { userId: string; role: string };

export type LaborClClientState = {
  reportId: string | null;
  clLocked: boolean;
  clLockedAt: string | null;
  clLockedByUserId: string | null;
  clUnlockRequestedAt: string | null;
  clUnlockRequestedByUserId: string | null;
  clUnlockRequestNote: string | null;
  clEditGrantUserId: string | null;
  clEditGrantUntil: string | null;
  hasPendingUnlockRequest: boolean;
  canEdit: boolean;
  canApproveUnlock: boolean;
  /** Nadređeni / God-mode: opozvati aktivnu privremenu freigabe */
  canRevokeClEdit: boolean;
  /** Nadređeni (ima podređene u restoranu) ili God-mode: ponovo dodijeliti uređivanje bez čekanja zahtjeva */
  canGrantClEdit: boolean;
  /** God-mode: may save/delete while locked without grant */
  canBypassClLock: boolean;
};

export function canBypassClLock(role: string): boolean {
  return GOD_MODE_ROLES.has(String(role));
}

export function defaultClState(): LaborClClientState {
  return {
    reportId: null,
    clLocked: false,
    clLockedAt: null,
    clLockedByUserId: null,
    clUnlockRequestedAt: null,
    clUnlockRequestedByUserId: null,
    clUnlockRequestNote: null,
    clEditGrantUserId: null,
    clEditGrantUntil: null,
    hasPendingUnlockRequest: false,
    canEdit: true,
    canApproveUnlock: false,
    canRevokeClEdit: false,
    canGrantClEdit: false,
    canBypassClLock: false,
  };
}

export type LaborDataApiResult = {
  data: LaborPlanPayload;
  cl: LaborClClientState;
};
