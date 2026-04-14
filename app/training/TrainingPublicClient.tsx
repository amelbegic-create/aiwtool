"use client";

import Link from "next/link";
import { Kanit } from "next/font/google";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  GraduationCap,
  MapPin,
  Users,
  X,
  Calendar,
  ChevronRight,
  Sparkles,
  LogOut,
  FileDown,
} from "lucide-react";
import type { PublicTrainingProgram } from "@/app/actions/trainingActions";
import { openTrainingSchedulePdfFromPublic } from "@/lib/trainingPdf";
import { formatRestaurantLabel } from "@/lib/formatRestaurantLabel";
import { INACTIVITY_LOGOUT_MS } from "@/lib/constants/sessionIdle";
import { cn } from "@/lib/utils";

const GREEN = "#1a3826";
const GOLD = "#FFC72C";

const brandFont = Kanit({ subsets: ["latin"], weight: ["600", "800", "900"] });

const IDLE_THROTTLE_MS = 1000;
const GUEST_IDLE_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
];

function throttleActivity<T extends (...args: unknown[]) => void>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limitMs) {
      lastCall = now;
      fn(...args);
    }
  };
}

const deDateTime = new Intl.DateTimeFormat("de-AT", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatTerminLine(startsAt: string, endsAt: string | null): string {
  const s = new Date(startsAt);
  if (Number.isNaN(s.getTime())) return startsAt;
  const pad = (n: number) => String(n).padStart(2, "0");
  const ddmmyy = (d: Date) =>
    `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;
  if (!endsAt) return `Termin: ${ddmmyy(s)}`;
  const e = new Date(endsAt);
  if (Number.isNaN(e.getTime())) return `Termin: ${ddmmyy(s)}`;
  if (
    s.getDate() === e.getDate() &&
    s.getMonth() === e.getMonth() &&
    s.getFullYear() === e.getFullYear()
  ) {
    return `Termin: ${ddmmyy(s)}`;
  }
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    const yy = String(s.getFullYear()).slice(-2);
    return `Termin: ${s.getDate()}./${pad(e.getDate())}.${pad(s.getMonth() + 1)}.${yy}`;
  }
  return `Termin: ${ddmmyy(s)} – ${ddmmyy(e)}`;
}

function formatRange(startsAt: string, endsAt: string | null): string {
  const s = new Date(startsAt);
  if (Number.isNaN(s.getTime())) return startsAt;
  const startStr = deDateTime.format(s);
  if (!endsAt) return startStr;
  const e = new Date(endsAt);
  if (Number.isNaN(e.getTime())) return startStr;
  return `${startStr} – ${deDateTime.format(e)}`;
}

function participantLine(p: {
  lineNo: string;
  displayName: string;
  badgeCode: string | null;
}): string {
  const base = `${p.lineNo}. ${p.displayName}`;
  if (!p.badgeCode?.trim()) return base;
  const code = p.badgeCode.trim().replace(/^\#/, "");
  return `${base} (#${code})`;
}

function cleanSessionTitle(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  // Filter out obvious garbage like ", asc,.a s,.cas,c"
  const letters = (s.match(/[A-Za-zÀ-ž]/g) ?? []).length;
  const punct = (s.match(/[,.;:_]/g) ?? []).length;
  if (letters < 3 && punct >= 2) return null;
  if (punct > Math.max(6, letters)) return null;
  return s;
}

/** split: helle Fläche. onGold: gelbes Band. onGreen: wie TopNavbar (weiß + Gold auf #1a3826). */
function BrandTrainingTitle({
  className,
  variant = "split",
  as: HeadingTag = "h1",
}: {
  className?: string;
  variant?: "split" | "onGold" | "onGreen";
  /** Angemeldete Seite: h2, da die globale Navbar bereits h1 (AIW) nutzt. */
  as?: "h1" | "h2";
}) {
  const H = HeadingTag;
  if (variant === "onGold") {
    return (
      <H
        className={cn(
          "font-black uppercase tracking-tighter",
          "text-3xl sm:text-4xl md:text-5xl",
          className
        )}
        style={{ color: GREEN }}
      >
        TRAINING
      </H>
    );
  }
  if (variant === "onGreen") {
    return (
      <H
        className={cn(
          "font-black uppercase tracking-tighter",
          "text-3xl sm:text-4xl md:text-5xl",
          className
        )}
      >
        <span className="text-white">TRAIN</span>
        <span style={{ color: GOLD }}>ING</span>
      </H>
    );
  }
  return (
    <H
      className={cn(
        "font-black uppercase tracking-tighter",
        "text-3xl sm:text-4xl md:text-5xl",
        className
      )}
    >
      <span style={{ color: GREEN }}>TRAIN</span>
      <span style={{ color: GOLD }}>ING</span>
    </H>
  );
}

function nextSessionSummary(program: PublicTrainingProgram): { label: string; sub?: string } | null {
  const sessions = program.sessions;
  if (sessions.length === 0) return null;
  const sorted = [...sessions].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const next = sorted[0]!;
  return {
    label: formatTerminLine(next.startsAt, next.endsAt),
    sub: formatRange(next.startsAt, next.endsAt),
  };
}

function totalParticipants(program: PublicTrainingProgram): number {
  return program.sessions.reduce((n, s) => n + s.participants.length, 0);
}

/** Eindeutige Teilnehmer über alle Termine (gleiche Person nicht doppelt). */
function uniqueParticipantsSorted(program: PublicTrainingProgram) {
  const byId = new Map<
    string,
    PublicTrainingProgram["sessions"][number]["participants"][number]
  >();
  for (const sess of program.sessions) {
    for (const p of sess.participants) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "de", { sensitivity: "base" })
  );
}

function ProgramYellowCard({
  program,
  onOpen,
}: {
  program: PublicTrainingProgram;
  onOpen: () => void;
}) {
  const restLabel = program.restaurants.length
    ? program.restaurants.map((r) => formatRestaurantLabel(r)).filter(Boolean).join(", ")
    : "";
  const next = nextSessionSummary(program);
  const uniqParticipants = uniqueParticipantsSorted(program);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-[#FFC72C]/60 bg-[#FFC72C]/20 text-left shadow-sm transition hover:shadow-md"
    >
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-[#1a3826]">{program.title}</p>
            {restLabel && (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[#1a3826]/80">
                <MapPin size={12} aria-hidden />
                <span className="truncate">{restLabel}</span>
              </p>
            )}
            {next && (
              <div className="mt-2">
                <p className="text-sm font-semibold text-[#1a3826]">{next.label}</p>
                {next.sub && (
                  <p className="mt-0.5 text-xs text-[#1a3826]/75">{next.sub}</p>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-black text-[#1a3826]">
              <Users size={12} className="mr-1 inline" aria-hidden />
              {totalParticipants(program)}
            </span>
            {program.scheduleMeta && (
              <span className="max-w-[220px] truncate rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold text-[#1a3826]">
                {program.scheduleMeta}
              </span>
            )}
          </div>
        </div>

        {(program.topics || program.description) && (
          <p className="text-xs leading-relaxed text-[#1a3826]/75">
            {topicsPreview(program.topics, program.description, 220)}
          </p>
        )}

        {program.prerequisites?.trim() && (
          <div className="rounded-xl bg-white/60 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#1a3826]/70">
              Voraussetzungen
            </p>
            <p className="mt-1 text-xs text-[#1a3826]/80">{program.prerequisites.trim()}</p>
          </div>
        )}

        {program.sessions.length > 0 && (
          <div className="rounded-xl bg-white/60 p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#1a3826]/70">
              Termine & Teilnehmer
            </p>
            <div className="mt-2 space-y-2">
              {program.sessions.map((s, idx) => (
                <div key={s.id} className="rounded-lg border border-[#FFC72C]/40 bg-white/70 p-2.5">
                  <p className="text-xs font-bold text-[#1a3826]">
                    {cleanSessionTitle(s.title) ?? `Termin ${idx + 1}`} · {formatTerminLine(s.startsAt, s.endsAt)}
                  </p>
                  {s.location?.trim() && (
                    <p className="mt-0.5 text-[11px] text-[#1a3826]/70">Ort: {s.location.trim()}</p>
                  )}
                  {s.notes?.trim() && (
                    <p className="mt-0.5 text-[11px] text-[#1a3826]/70">{s.notes.trim()}</p>
                  )}
                  {s.participants.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.participants.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-full bg-[#1a3826] px-3 py-1 text-[11px] font-bold text-[#FFC72C]"
                        >
                          {p.displayName}
                          {p.resultPercent !== null && p.resultPercent !== undefined ? ` · ${p.resultPercent}%` : ""}
                          {p.courseComment?.trim() ? ` · ${p.courseComment.trim()}` : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {uniqParticipants.length === 0 && (
          <p className="text-xs italic text-[#1a3826]/60">Keine Teilnehmer eingetragen.</p>
        )}
      </div>
    </button>
  );
}

function topicsPreview(topics: string | null, description: string | null, maxLen = 140): string {
  const raw = (topics ?? "").trim() || (description ?? "").trim();
  if (!raw) return "";
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen).trimEnd() + "…";
}

type Props = {
  isLoggedIn: boolean;
  /** Admin: Link zur Schulungsverwaltung im Modul-Header */
  canManageTraining?: boolean;
  initialLocked: boolean;
  initialPrograms: PublicTrainingProgram[];
};

function TrainingDetailModal({
  program,
  open,
  onClose,
}: {
  program: PublicTrainingProgram | null;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open || !program) return null;

  const restLine = program.restaurants.length > 0
    ? program.restaurants.map((r) => formatRestaurantLabel(r)).filter(Boolean).join(", ")
    : "";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-modal-title"
        lang="de"
        translate="no"
        className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* McDonald's-style: gelber Balken, grüne Schrift */}
        <div
          className="flex shrink-0 items-start justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5"
          style={{ backgroundColor: GOLD }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80" style={{ color: GREEN }}>
              Schulungsprogramm
            </p>
            <h2
              id="training-modal-title"
              className="mt-1 text-xl font-black uppercase leading-tight tracking-tight sm:text-2xl"
              style={{ color: GREEN }}
            >
              {program.title}
            </h2>
            {program.scheduleMeta && (
              <p className="mt-2 text-sm font-bold opacity-90" style={{ color: GREEN }}>
                {program.scheduleMeta}
              </p>
            )}
            {restLine && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-bold opacity-90" style={{ color: GREEN }}>
                <MapPin size={14} className="shrink-0" aria-hidden />
                {restLine}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 transition hover:bg-black/10"
            style={{ color: GREEN }}
            aria-label="Schließen"
          >
            <X size={22} strokeWidth={2.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {program.topics && (
            <section className="mb-5">
              <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                Inhalte / Themen
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{program.topics}</p>
            </section>
          )}
          {program.prerequisites && (
            <section className="mb-5 rounded-xl border border-border bg-muted/40 p-4">
              <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                Voraussetzungen
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{program.prerequisites}</p>
            </section>
          )}
          {program.description && !program.topics && (
            <p className="mb-5 text-sm text-muted-foreground whitespace-pre-wrap">{program.description}</p>
          )}

          <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <Calendar size={14} className="shrink-0" aria-hidden />
            Termine
          </h3>
          <ul className="space-y-4">
            {program.sessions.map((sess) => (
              <li
                key={sess.id}
                className="rounded-xl border border-border/80 bg-gradient-to-br from-muted/30 to-transparent p-4 dark:from-muted/20"
              >
                <p className="font-bold text-foreground">
                  {cleanSessionTitle(sess.title) ?? program.title}
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: "#c2410c" }}>
                  {formatTerminLine(sess.startsAt, sess.endsAt)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatRange(sess.startsAt, sess.endsAt)}</p>
                {sess.location && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin size={14} className="shrink-0 text-[#1a3826] dark:text-[#FFC72C]" aria-hidden />
                    {sess.location}
                  </p>
                )}
                {sess.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{sess.notes}</p>
                )}
                {sess.participants.length > 0 && (
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                      <Users size={12} aria-hidden />
                      Teilnehmer
                    </p>
                    <ol className="list-none space-y-2 pl-0 text-sm font-medium">
                      {sess.participants.map((p) => (
                        <li key={p.id} className="text-foreground">
                          <div>{participantLine(p)}</div>
                          {(p.courseComment?.trim() ||
                            (p.resultPercent !== null && p.resultPercent !== undefined)) && (
                            <p className="mt-1 pl-3 text-xs font-normal leading-snug text-muted-foreground">
                              {p.resultPercent !== null && p.resultPercent !== undefined && (
                                <span className="font-semibold text-[#1a3826] dark:text-[#FFC72C]">
                                  {p.resultPercent}%{" "}
                                </span>
                              )}
                              {p.courseComment?.trim() ?? ""}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 flex flex-col gap-2 border-t border-border bg-muted/20 px-4 py-3 sm:flex-row sm:px-6">
          <button
            type="button"
            onClick={() => openTrainingSchedulePdfFromPublic([program])}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1a3826]/25 bg-white py-3 text-sm font-black uppercase tracking-wide text-[#1a3826] transition hover:bg-[#1a3826]/5 dark:border-[#FFC72C]/40 dark:bg-transparent dark:text-[#FFC72C] sm:w-auto sm:min-w-[140px] sm:flex-1"
          >
            <FileDown size={18} aria-hidden />
            PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl py-3 text-sm font-black uppercase tracking-wide text-[#FFC72C] transition hover:opacity-95 sm:flex-[2]"
            style={{ backgroundColor: GREEN }}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ProgramPreviewCard({
  program,
  onOpen,
}: {
  program: PublicTrainingProgram;
  onOpen: () => void;
}) {
  const next = nextSessionSummary(program);
  const participants = totalParticipants(program);
  const preview = topicsPreview(program.topics, program.description);
  const uniqueList = uniqueParticipantsSorted(program);
  const restLabel = program.restaurants.length > 0
    ? program.restaurants.map((r) => formatRestaurantLabel(r)).filter(Boolean).join(", ")
    : "";

  const onKeyCard = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={onKeyCard}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border-0 bg-card text-left shadow-xl ring-1 ring-[#1a3826]/10 transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-2xl hover:ring-[#1a3826]/25",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC72C] focus-visible:ring-offset-2",
        "dark:ring-[#FFC72C]/15 dark:hover:ring-[#FFC72C]/30"
      )}
    >
      <div
        className="h-2 w-full shrink-0 bg-gradient-to-r from-[#FFC72C] via-[#ffe066] to-[#FFC72C]"
        aria-hidden
      />
      <div className="flex flex-1 flex-col bg-gradient-to-b from-[#1a3826]/[0.04] to-transparent p-5 sm:p-6 dark:from-[#FFC72C]/[0.05]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-black uppercase leading-snug tracking-tight text-[#1a3826] dark:text-[#FFC72C] sm:text-xl">
            {program.title}
          </h2>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1a3826]/10 text-[#1a3826] transition group-hover:bg-[#1a3826] group-hover:text-[#FFC72C] dark:bg-[#FFC72C]/10 dark:text-[#FFC72C] dark:group-hover:bg-[#FFC72C] dark:group-hover:text-[#1a3826]">
            <ChevronRight size={20} className="transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>

        {restLabel && (
          <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#1a3826]/10 px-3 py-1 text-[11px] font-bold text-[#1a3826] dark:bg-[#FFC72C]/15 dark:text-[#FFC72C]">
            <MapPin size={12} className="shrink-0 opacity-80" aria-hidden />
            <span className="truncate">{restLabel}</span>
          </p>
        )}

        {program.scheduleMeta && (
          <p className="mt-3 inline-flex max-w-full items-center rounded-full bg-muted px-3 py-1 text-xs font-bold text-foreground">
            {program.scheduleMeta}
          </p>
        )}

        {preview && (
          <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{preview}</p>
        )}

        <div className="mt-4 rounded-xl border border-[#1a3826]/15 bg-[#1a3826]/5 p-3 dark:border-[#FFC72C]/20 dark:bg-[#FFC72C]/5">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#1a3826] dark:text-[#FFC72C]">
            <Users size={12} className="shrink-0" aria-hidden />
            Teilnehmer ({uniqueList.length})
          </p>
          {uniqueList.length === 0 ? (
            <p className="text-xs text-muted-foreground">Noch niemand eingetragen.</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto pr-1 text-sm font-medium leading-snug text-foreground [scrollbar-width:thin]">
              {uniqueList.map((p) => (
                <li key={p.id} className="border-b border-border/40 pb-1 last:border-0 last:pb-0">
                  {participantLine(p)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4 text-xs font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a3826]/5 px-2.5 py-1.5 dark:bg-[#FFC72C]/10">
            <Calendar size={14} className="text-[#1a3826] dark:text-[#FFC72C]" aria-hidden />
            {program.sessions.length} Termin(e)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a3826]/5 px-2.5 py-1.5 dark:bg-[#FFC72C]/10">
            <Users size={14} className="text-[#1a3826] dark:text-[#FFC72C]" aria-hidden />
            {participants} Einträge
          </span>
        </div>

        {next && (
          <div className="mt-4 rounded-xl border border-[#FFC72C]/40 bg-[#FFC72C]/15 px-3 py-2.5 dark:bg-[#FFC72C]/10">
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: GREEN }}>
              Nächster Termin
            </p>
            <p className="mt-0.5 text-sm font-bold" style={{ color: GREEN }}>
              {next.label}
            </p>
            {next.sub && (
              <p className="text-[11px] text-muted-foreground opacity-90">{next.sub}</p>
            )}
          </div>
        )}

        <span className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#1a3826] opacity-70 transition group-hover:opacity-100 dark:text-[#FFC72C]">
          <Sparkles size={12} aria-hidden />
          Details anzeigen
        </span>
      </div>
    </div>
  );
}

// (participant-centric card removed – we render one yellow card per training program now)

export default function TrainingPublicClient({
  isLoggedIn,
  canManageTraining = false,
  initialLocked,
  initialPrograms,
}: Props) {
  const router = useRouter();
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [modalProgram, setModalProgram] = useState<PublicTrainingProgram | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const showGate = !isLoggedIn && initialLocked;
  const guestUnlocked = !isLoggedIn && !showGate;

  /** Unique sorted months (YYYY-MM) derived from all sessions */
  const availableMonths = (() => {
    const set = new Set<string>();
    for (const p of initialPrograms) {
      for (const s of p.sessions) {
        const d = new Date(s.startsAt);
        if (!isNaN(d.getTime())) {
          set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }
      }
    }
    return Array.from(set).sort();
  })();

  const DE_MONTHS = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];

  function monthLabel(ym: string): string {
    const [y, m] = ym.split("-");
    const mIdx = parseInt(m ?? "1", 10) - 1;
    return `${DE_MONTHS[mIdx] ?? m} ${y}`;
  }

  const filteredPrograms =
    selectedMonth === null
      ? initialPrograms
      : initialPrograms.filter((p) =>
          p.sessions.some((s) => {
            const d = new Date(s.startsAt);
            if (isNaN(d.getTime())) return false;
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            return ym === selectedMonth;
          })
        );

  const closeModal = useCallback(() => setModalProgram(null), []);

  const logoutGuest = useCallback(async () => {
    await fetch("/api/training/guest-logout", { method: "POST", credentials: "same-origin" });
    router.refresh();
  }, [router]);

  /** Gast-Zugang: gleiche Inaktivitätszeit wie eingeloggte Session (Cookie wird gelöscht). */
  useEffect(() => {
    if (!guestUnlocked) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = async () => {
      await fetch("/api/training/guest-logout", { method: "POST", credentials: "same-origin" });
      router.refresh();
    };
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void fire(), INACTIVITY_LOGOUT_MS);
    };
    const throttled = throttleActivity(reset, IDLE_THROTTLE_MS);
    reset();
    for (const ev of GUEST_IDLE_EVENTS) {
      window.addEventListener(ev, throttled as EventListener, { passive: true });
    }
    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of GUEST_IDLE_EVENTS) {
        window.removeEventListener(ev, throttled as EventListener);
      }
    };
  }, [guestUnlocked, router]);

  async function submitGuest(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      const res = await fetch("/api/training/guest-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "Zugang verweigert.");
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setErr("Netzwerkfehler.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-background font-sans text-foreground"
      lang="de"
      translate="no"
    >
      {/* Gast: grüner Balken wie TopNavbar (ohne Kategorien). Angemeldet: kein zweiter Header – reicht globale Leiste. */}
      {!isLoggedIn && (
        <header className="w-full border-b border-white/10 bg-[#1a3826] text-white shadow-md">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${brandFont.className}`}>
                <span className="text-2xl font-black uppercase tracking-tighter text-white md:text-3xl">AIW</span>
                <span className="text-sm font-extrabold uppercase tracking-[0.1em] text-[#FFC72C] md:text-base">
                  Services
                </span>
              </div>
              {!showGate && (
                <button
                  type="button"
                  onClick={() => void logoutGuest()}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-white/20"
                >
                  <LogOut size={16} aria-hidden />
                  Abmelden
                </button>
              )}
            </div>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-2 ring-[#FFC72C]/30 sm:h-16 sm:w-16"
                  style={{ color: GOLD }}
                >
                  <GraduationCap size={30} className="sm:h-8 sm:w-8" aria-hidden />
                </span>
                <div className="min-w-0">
                  <BrandTrainingTitle variant="onGreen" />
                  <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-emerald-100/90 sm:text-base">
                    Termine und Teilnehmerübersicht – nur Lesen. Klicken Sie auf eine Karte für alle Details.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      <main
        className={
          isLoggedIn
            ? "px-4 py-5 sm:p-6 md:p-10"
            : "mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
        }
      >
        <div
          className={
            isLoggedIn ? "mx-auto max-w-[1600px] space-y-8" : "mx-auto max-w-6xl"
          }
        >
          {isLoggedIn && (
            <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between print:hidden">
              <div>
                <h1 className="mb-2 text-4xl font-black uppercase tracking-tighter text-[#1a3826] dark:text-[#FFC72C]">
                  SCHUL<span className="text-[#FFC72C]">UNGEN</span>
                </h1>
                <p className="text-sm font-medium text-muted-foreground">
                  Termine und Teilnehmerübersicht – Klick öffnet alle Details.
                </p>
              </div>
              {canManageTraining && (
                <Link
                  href="/admin/training"
                  className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-black uppercase tracking-wide text-muted-foreground shadow-sm transition hover:bg-accent hover:text-foreground md:self-auto"
                >
                  <GraduationCap size={15} aria-hidden />
                  Verwalten
                </Link>
              )}
            </div>
          )}

        <div
          className={
            isLoggedIn
              ? ""
              : showGate
                ? ""
                : "rounded-2xl border border-border/60 bg-muted/20 p-6 sm:p-8 dark:bg-muted/10"
          }
        >
              {showGate ? (
                <form
                  onSubmit={submitGuest}
                  className="mx-auto max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
                >
                  <div>
                    <label
                      htmlFor="training-guest-pw"
                      className="mb-1.5 block text-xs font-black uppercase tracking-wide text-muted-foreground"
                    >
                      Passwort
                    </label>
                    <input
                      id="training-guest-pw"
                      type="password"
                      autoComplete="off"
                      value={pwd}
                      onChange={(e) => setPwd(e.target.value)}
                      className="w-full rounded-xl border-2 border-border bg-background px-4 py-3.5 text-base font-medium outline-none transition focus:border-[#1a3826] focus:ring-2 focus:ring-[#FFC72C]/40 dark:focus:border-[#FFC72C]"
                      placeholder="Passwort eingeben"
                    />
                  </div>
                  {err && (
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400" role="alert">
                      {err}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={pending || !pwd.trim()}
                    className="inline-flex w-full items-center justify-center rounded-xl px-5 py-3.5 text-sm font-black uppercase tracking-widest text-[#FFC72C] shadow-md transition hover:opacity-95 disabled:opacity-40"
                    style={{ backgroundColor: GREEN }}
                  >
                    {pending ? "…" : "Anzeigen"}
                  </button>
                </form>
              ) : initialPrograms.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-border/80 bg-muted/25 px-6 py-20 text-center">
                  <GraduationCap
                    className="mx-auto mb-5 h-14 w-14 text-[#1a3826]/25 dark:text-[#FFC72C]/30"
                    aria-hidden
                  />
                  <p className="text-base font-semibold text-foreground">
                    Derzeit sind keine Schulungstermine eingetragen.
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Sobald Programme angelegt sind, erscheinen sie hier als Karten.
                  </p>
                </div>
              ) : (
                <>
                  {/* Month filter pills + PDF */}
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
                    {availableMonths.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedMonth(null)}
                          className={`rounded-full px-3.5 py-1.5 text-xs font-black uppercase tracking-wide transition ${
                            selectedMonth === null
                              ? "bg-[#1a3826] text-[#FFC72C] shadow-sm"
                              : "border border-border bg-card text-muted-foreground hover:border-[#1a3826]/40 hover:text-[#1a3826] dark:hover:text-[#FFC72C]"
                          }`}
                        >
                          Alle
                        </button>
                        {availableMonths.map((ym) => (
                          <button
                            key={ym}
                            type="button"
                            onClick={() => setSelectedMonth(ym === selectedMonth ? null : ym)}
                            className={`rounded-full px-3.5 py-1.5 text-xs font-black uppercase tracking-wide transition ${
                              selectedMonth === ym
                                ? "bg-[#FFC72C] text-[#1a3826] shadow-sm"
                                : "border border-border bg-card text-muted-foreground hover:border-[#FFC72C]/60 hover:bg-[#FFC72C]/10 hover:text-[#1a3826] dark:hover:text-[#FFC72C]"
                            }`}
                          >
                            {monthLabel(ym)}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => openTrainingSchedulePdfFromPublic(filteredPrograms)}
                      className="ml-auto inline-flex items-center gap-2 rounded-xl border border-[#1a3826]/20 bg-card px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[#1a3826] shadow-sm transition hover:bg-[#1a3826]/5 dark:border-[#FFC72C]/30 dark:text-[#FFC72C] dark:hover:bg-[#FFC72C]/10"
                    >
                      <FileDown size={16} aria-hidden />
                      PDF
                    </button>
                  </div>

                  {filteredPrograms.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-border/60 py-12 text-center">
                      <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-muted-foreground">
                        Kein Training in {selectedMonth ? monthLabel(selectedMonth) : "diesem Zeitraum"}.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {filteredPrograms.map((p) => (
                        <ProgramYellowCard key={p.id} program={p} onOpen={() => setModalProgram(p)} />
                      ))}
                    </div>
                  )}
                </>
              )}
        </div>
        </div>
      </main>

      <TrainingDetailModal program={modalProgram} open={modalProgram !== null} onClose={closeModal} />
    </div>
  );
}
