"use client";

import Link from "next/link";
import { Kanit } from "next/font/google";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  GraduationCap,
  MapPin,
  Users,
  X,
  Calendar,
  ChevronRight,
  LogOut,
  FileDown,
  Clock,
  Award,
  BookOpen,
} from "lucide-react";
import type { PublicTrainingProgram } from "@/app/actions/trainingActions";
import { openTrainingSchedulePdfFromPublic } from "@/lib/trainingPdf";
import { formatRestaurantLabel } from "@/lib/formatRestaurantLabel";
import { INACTIVITY_LOGOUT_MS } from "@/lib/constants/sessionIdle";
import { cn } from "@/lib/utils";

const GREEN = "#1a3826";
const GOLD  = "#FFC72C";

const brandFont = Kanit({ subsets: ["latin"], weight: ["600", "800", "900"] });

const IDLE_THROTTLE_MS  = 1000;
const GUEST_IDLE_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove", "keydown", "click", "scroll", "touchstart",
];

function throttleActivity<T extends (...args: unknown[]) => void>(
  fn: T, limitMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limitMs) { lastCall = now; fn(...args); }
  };
}

const deFull = new Intl.DateTimeFormat("de-AT", {
  weekday: "long", day: "2-digit", month: "long", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});

const DE_MONTHS_SHORT = [
  "Jan","Feb","Mär","Apr","Mai","Jun",
  "Jul","Aug","Sep","Okt","Nov","Dez",
];

function pad(n: number) { return String(n).padStart(2, "0"); }

/** ISO-8601 calendar week number */
function isoWeek(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayOfWeek = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function cleanSessionTitle(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const letters = (s.match(/[A-Za-zÀ-ž]/g) ?? []).length;
  const punct   = (s.match(/[,.;:_]/g) ?? []).length;
  if (letters < 3 && punct >= 2) return null;
  if (punct > Math.max(6, letters)) return null;
  return s;
}

function participantLine(p: { lineNo: string; displayName: string; badgeCode: string | null }) {
  const base = `${p.lineNo}. ${p.displayName}`;
  if (!p.badgeCode?.trim()) return base;
  return `${base} (#${p.badgeCode.trim().replace(/^#/, "")})`;
}

function topicsPreview(topics: string | null, description: string | null, maxLen = 120): string {
  const raw = (topics ?? "").trim() || (description ?? "").trim();
  if (!raw) return "";
  return raw.length <= maxLen ? raw : raw.slice(0, maxLen).trimEnd() + "…";
}

function sortedSessionsAsc(program: PublicTrainingProgram) {
  return [...program.sessions].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );
}

function uniqueParticipantsSorted(program: PublicTrainingProgram) {
  const byId = new Map<string, PublicTrainingProgram["sessions"][number]["participants"][number]>();
  for (const sess of program.sessions)
    for (const p of sess.participants)
      if (!byId.has(p.id)) byId.set(p.id, p);
  return Array.from(byId.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "de", { sensitivity: "base" })
  );
}

/* ══════════════════════════════ COMPACT CARD ══════════════════════════════ */

function TrainingProgramCard({
  program,
  onOpen,
}: {
  program: PublicTrainingProgram;
  onOpen: () => void;
}) {
  const sessions  = sortedSessionsAsc(program);
  const nextSess  = sessions[0];
  const restLabel = program.restaurants.map(r => formatRestaurantLabel(r)).filter(Boolean).join(", ");
  const uniq      = uniqueParticipantsSorted(program);

  const next     = nextSess ? new Date(nextSess.startsAt) : null;
  const heroDay  = next && !isNaN(next.getTime()) ? String(next.getDate())                                              : null;
  const heroWd   = next && !isNaN(next.getTime()) ? next.toLocaleDateString("de-AT", { weekday: "short" })              : null;
  const heroMon  = next && !isNaN(next.getTime()) ? DE_MONTHS_SHORT[next.getMonth()]                                    : null;
  const heroTime = next && !isNaN(next.getTime()) ? next.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" }) : null;

  const tailSessions = sessions.slice(1, 3);
  const moreSessions = Math.max(0, sessions.length - 1 - tailSessions.length);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Details: ${program.title}`}
      className="group relative w-full overflow-hidden rounded-2xl border border-[#FFC72C]/20 bg-gradient-to-br from-[#1a3826] via-[#162d1f] to-[#0b1a12] text-left shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-[#FFC72C]/55 hover:shadow-[0_16px_48px_rgba(0,0,0,0.48)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC72C] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Gold stripe */}
      <div className="h-[3px] w-full bg-gradient-to-r from-[#FFC72C]/0 via-[#FFC72C] to-[#FFC72C]/0" aria-hidden />

      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {restLabel && (
              <p className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#FFC72C]/70">
                <MapPin size={10} aria-hidden /> {restLabel}
              </p>
            )}
            <h3 className="line-clamp-2 text-base font-black uppercase leading-snug tracking-tight text-white sm:text-lg">
              {program.title}
            </h3>
            {program.scheduleMeta && (
              <span className="mt-1.5 inline-flex rounded-full border border-white/15 bg-white/8 px-2.5 py-0.5 text-[11px] font-bold text-white/70">
                {program.scheduleMeta}
              </span>
            )}
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#FFC72C] transition group-hover:border-[#FFC72C]/50 group-hover:bg-[#FFC72C] group-hover:text-[#1a3826]">
            <ChevronRight size={18} className="transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>

        {/* Next session hero */}
        {heroDay && (
          <div className="mt-3.5 flex items-stretch overflow-hidden rounded-xl border border-[#FFC72C]/30 bg-black/25">
            <div className="flex min-w-[3.75rem] shrink-0 flex-col items-center justify-center bg-[#FFC72C] px-2 py-3">
              <span className="text-[9px] font-black uppercase leading-none text-[#1a3826]/80">{heroWd}</span>
              <span className="mt-0.5 text-2xl font-black tabular-nums leading-none text-[#1a3826]">{heroDay}</span>
              <span className="mt-0.5 text-[9px] font-black uppercase leading-none text-[#1a3826]/70">{heroMon}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center py-2.5 pr-3 pl-3">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#FFC72C]/65">Nächster Termin</p>
              {heroTime && (
                <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-white">
                  <Clock size={11} className="text-[#FFC72C]" aria-hidden /> {heroTime} Uhr
                </p>
              )}
              {nextSess?.location?.trim() && (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/55">
                  <MapPin size={10} aria-hidden /> {nextSess.location.trim()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Weitere Termine */}
        {tailSessions.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            {tailSessions.map((s, i) => {
              const d = new Date(s.startsAt);
              const dateStr = !isNaN(d.getTime())
                ? `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} · ${d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}`
                : "";
              return (
                <div key={s.id} className="flex items-center gap-2 text-[11px]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFC72C]/60" aria-hidden />
                  <span className="text-white/75">{cleanSessionTitle(s.title) ?? `Termin ${i + 2}`}</span>
                  {dateStr && <span className="text-white/40">· {dateStr}</span>}
                </div>
              );
            })}
            {moreSessions > 0 && (
              <p className="pl-3.5 text-[11px] font-bold text-[#FFC72C]/70">+{moreSessions} weitere</p>
            )}
          </div>
        )}

        {/* Topics preview */}
        {(program.topics || program.description) && (
          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-white/50">
            {topicsPreview(program.topics, program.description)}
          </p>
        )}

        {/* Footer */}
        <div className="mt-3.5 flex items-center justify-between border-t border-white/10 pt-3 text-[11px]">
          <div className="flex items-center gap-3 text-white/50">
            <span className="flex items-center gap-1">
              <Calendar size={12} className="text-[#FFC72C]" aria-hidden />
              {sessions.length} Termin{sessions.length !== 1 ? "e" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} className="text-[#FFC72C]" aria-hidden />
              {uniq.length} TN
            </span>
          </div>
          <span className="flex items-center gap-1 font-black text-[#FFC72C] transition group-hover:gap-1.5">
            Details <ChevronRight size={13} />
          </span>
        </div>
      </div>
    </button>
  );
}

/* ══════════════════════════════ DETAIL MODAL ══════════════════════════════ */

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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!mounted || !open || !program) return null;

  const sessions         = sortedSessionsAsc(program);
  const uniq             = uniqueParticipantsSorted(program);
  const restLine         = program.restaurants.map(r => formatRestaurantLabel(r)).filter(Boolean).join(", ");
  const totalSessions    = sessions.length;
  const totalParticipants = program.sessions.reduce((n, s) => n + s.participants.length, 0);
  const assessed         = program.sessions.flatMap(s => s.participants).filter(p => p.resultPercent !== null).length;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4 md:p-6">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Schließen"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-modal-title"
        lang="de"
        translate="no"
        className="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl shadow-[0_32px_80px_rgba(0,0,0,0.55)] sm:rounded-3xl"
        style={{ maxHeight: "min(94dvh, 920px)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER: dark green */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#1a3826] via-[#1f4730] to-[#0b1a12] px-5 pt-5 pb-4 sm:px-8 sm:pt-7 sm:pb-5">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-[#FFC72C] to-transparent" aria-hidden />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FFC72C]/75">
                Schulungsprogramm
              </p>
              <h2
                id="training-modal-title"
                className="mt-1.5 text-2xl font-black uppercase leading-tight tracking-tight text-white sm:text-3xl"
              >
                {program.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {program.scheduleMeta && (
                  <span className="inline-flex rounded-full border border-[#FFC72C]/35 bg-[#FFC72C]/15 px-3 py-1 text-xs font-bold text-[#FFC72C]">
                    {program.scheduleMeta}
                  </span>
                )}
                {restLine && (
                  <span className="flex items-center gap-1.5 text-xs text-white/65">
                    <MapPin size={12} className="text-[#FFC72C]" aria-hidden /> {restLine}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl border border-white/15 bg-white/10 p-2.5 text-white transition hover:bg-[#FFC72C] hover:text-[#1a3826]"
              aria-label="Schließen"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* KPI strip */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: Calendar, label: "Termine",        val: totalSessions },
              { icon: Users,    label: "Einschreibungen", val: totalParticipants },
              { icon: Award,    label: "Bewertet",        val: assessed },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="rounded-xl border border-[#FFC72C]/20 bg-black/30 px-3 py-2.5 text-center">
                <Icon size={15} className="mx-auto text-[#FFC72C]" />
                <p className="mt-1 text-xl font-black tabular-nums text-white">{val}</p>
                <p className="text-[9px] font-bold uppercase tracking-wide text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── BODY: WHITE */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5 sm:px-8 sm:py-6">

          {/* Topics / description */}
          {(program.topics || program.description) && (
            <section className="mb-5">
              <h3 className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#1a3826]">
                <BookOpen size={13} className="text-[#1a3826]" /> Inhalte / Themen
              </h3>
              <p className="whitespace-pre-wrap rounded-xl border border-[#1a3826]/10 bg-[#f5f7f5] px-4 py-3 text-sm leading-relaxed text-gray-800">
                {(program.topics ?? program.description ?? "").trim()}
              </p>
            </section>
          )}

          {/* Prerequisites */}
          {program.prerequisites?.trim() && (
            <section className="mb-5 rounded-xl border border-[#FFC72C]/40 bg-[#FFC72C]/10 px-4 py-3">
              <h3 className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#1a3826]">
                Voraussetzungen
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {program.prerequisites.trim()}
              </p>
            </section>
          )}

          {/* Sessions */}
          <h3 className="mb-3 flex items-center gap-2 border-b border-[#1a3826]/10 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#1a3826]">
            <Calendar size={13} className="text-[#1a3826]" /> Termine ({totalSessions})
          </h3>

          <ul className="space-y-4">
            {sessions.map((sess, idx) => {
              const start    = new Date(sess.startsAt);
              const end      = sess.endsAt ? new Date(sess.endsAt) : null;
              const valid    = !isNaN(start.getTime());
              const title    = cleanSessionTitle(sess.title) ?? `Termin ${idx + 1}`;

              return (
                <li
                  key={sess.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  {/* Session header row */}
                  <div className="flex items-stretch">
                    {/* Date tile */}
                    {valid && (
                      <div className="flex min-w-[4rem] shrink-0 flex-col items-center justify-center bg-[#1a3826] px-2 py-3.5">
                        <span className="text-[9px] font-black uppercase leading-none text-[#FFC72C]/80">
                          {start.toLocaleDateString("de-AT", { weekday: "short" })}
                        </span>
                        <span className="mt-0.5 text-2xl font-black tabular-nums leading-none text-white">
                          {start.getDate()}
                        </span>
                        <span className="mt-0.5 text-[9px] font-black uppercase leading-none text-white/60">
                          {DE_MONTHS_SHORT[start.getMonth()]}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1 px-4 py-3">
                      <p className="font-black uppercase tracking-tight text-[#1a3826]">{title}</p>
                      {valid && (
                        <>
                          <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-[#1a3826]">
                            <Clock size={13} className="text-[#FFC72C]" />
                            {start.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })} Uhr
                            {end && !isNaN(end.getTime()) && (
                              <span className="font-normal text-gray-500">
                                {" – "}{end.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })} Uhr
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">{deFull.format(start)}</p>
                        </>
                      )}
                      {sess.location?.trim() && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-600">
                          <MapPin size={13} className="shrink-0 text-[#1a3826]" /> {sess.location.trim()}
                        </p>
                      )}
                      {sess.notes?.trim() && (
                        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                          {sess.notes.trim()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Participants */}
                  {sess.participants.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                      <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                        <Users size={11} /> Teilnehmer ({sess.participants.length})
                      </p>
                      <ol className="space-y-2">
                        {sess.participants.map((p) => (
                          <li
                            key={p.id}
                            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                          >
                            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                              <span className="font-semibold text-gray-900">{participantLine(p)}</span>
                              {p.resultPercent !== null && p.resultPercent !== undefined && (
                                <span className="shrink-0 rounded-full bg-[#FFC72C] px-2.5 py-0.5 text-xs font-black text-[#1a3826]">
                                  {p.resultPercent}%
                                </span>
                              )}
                            </div>
                            {/* Full comment – always shown */}
                            {p.courseComment?.trim() && (
                              <div className="border-t border-gray-100 bg-[#fffbee] px-3 py-2">
                                <p className="text-[10px] font-black uppercase tracking-wide text-[#1a3826]/60">Kommentar</p>
                                <p className="mt-0.5 text-sm leading-relaxed text-gray-700">
                                  {p.courseComment.trim()}
                                </p>
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* All participants chips */}
          {uniq.length > 0 && (
            <section className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#1a3826]">
                Alle Teilnehmer ({uniq.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {uniq.map(p => (
                  <span
                    key={p.id}
                    className="rounded-full border border-[#1a3826]/25 bg-[#1a3826]/8 px-3 py-1 text-xs font-bold text-[#1a3826]"
                  >
                    {p.displayName}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── FOOTER */}
        <div className="flex shrink-0 items-center gap-3 border-t border-gray-200 bg-white px-5 py-3 sm:px-8">
          <button
            type="button"
            onClick={() => openTrainingSchedulePdfFromPublic([program])}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-[#1a3826] bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[#1a3826] transition hover:bg-[#1a3826] hover:text-[#FFC72C]"
          >
            <FileDown size={16} /> PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-[#1a3826] py-2.5 text-xs font-black uppercase tracking-wide text-[#FFC72C] transition hover:opacity-90"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════ FILTER TYPES ══════════════════════════════ */

type ActiveFilters = {
  year:  string | null;   // "2026"
  month: string | null;   // "2026-04"
  week:  number | null;   // ISO KW
};

function buildOptions(programs: PublicTrainingProgram[]) {
  const years  = new Set<string>();
  const months = new Set<string>();
  const weeks  = new Set<number>();
  for (const p of programs)
    for (const s of p.sessions) {
      const d = new Date(s.startsAt);
      if (isNaN(d.getTime())) continue;
      years.add(String(d.getFullYear()));
      months.add(`${d.getFullYear()}-${pad(d.getMonth()+1)}`);
      weeks.add(isoWeek(d));
    }
  return {
    years:  Array.from(years).sort(),
    months: Array.from(months).sort(),
    weeks:  Array.from(weeks).sort((a, b) => a - b),
  };
}

function filterPrograms(programs: PublicTrainingProgram[], f: ActiveFilters) {
  return programs.filter(p =>
    p.sessions.some(s => {
      const d = new Date(s.startsAt);
      if (isNaN(d.getTime())) return false;
      if (f.year  && String(d.getFullYear()) !== f.year)  return false;
      if (f.month && `${d.getFullYear()}-${pad(d.getMonth()+1)}` !== f.month) return false;
      if (f.week  && isoWeek(d) !== f.week) return false;
      return true;
    })
  );
}

/* ══════════════════════════════ FILTER BAR ══════════════════════════════ */

const filterSelectClass =
  "h-9 min-w-[7rem] max-w-[11rem] shrink-0 cursor-pointer rounded-lg border border-white/20 bg-black/30 px-2.5 pr-7 text-xs font-bold text-white outline-none transition focus:border-[#FFC72C] focus:ring-1 focus:ring-[#FFC72C] [&>option]:bg-[#1a3826] [&>option]:text-white";

function FilterBar({
  programs,
  filters,
  onFilters,
  onPdf,
  count,
}: {
  programs: PublicTrainingProgram[];
  filters: ActiveFilters;
  onFilters: (f: ActiveFilters) => void;
  onPdf: () => void;
  count: number;
}) {
  const opts = useMemo(() => buildOptions(programs), [programs]);

  const visibleMonths = filters.year
    ? opts.months.filter(m => m.startsWith(filters.year!))
    : opts.months;

  const visibleWeeks = useMemo(() => {
    if (!filters.month) return opts.weeks;
    const wSet = new Set<number>();
    for (const p of programs)
      for (const s of p.sessions) {
        const d = new Date(s.startsAt);
        if (isNaN(d.getTime())) continue;
        if (`${d.getFullYear()}-${pad(d.getMonth()+1)}` === filters.month)
          wSet.add(isoWeek(d));
      }
    return Array.from(wSet).sort((a, b) => a - b);
  }, [programs, filters.month, opts.weeks]);

  /** Sync invalid week when month/year narrows options */
  useEffect(() => {
    if (filters.week === null) return;
    if (!visibleWeeks.includes(filters.week)) {
      onFilters({ ...filters, week: null });
    }
  }, [filters, visibleWeeks, onFilters]);

  function setYear(y: string | null) {
    onFilters({ year: y, month: null, week: null });
  }
  function setMonth(m: string | null) {
    onFilters({ ...filters, month: m, week: null });
  }
  function setWeek(w: number | null) {
    onFilters({ ...filters, week: w });
  }

  const hasFilter = Boolean(filters.year || filters.month || filters.week);

  return (
    <div className="mb-5 rounded-xl border border-[#FFC72C]/20 bg-gradient-to-r from-[#1a3826] to-[#0f2218] px-3 py-2.5 print:hidden sm:px-4">
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-[#FFC72C]/80">
          Filter
        </span>

        <label className="flex shrink-0 items-center gap-1.5">
          <span className="sr-only">Jahr</span>
          <span className="hidden text-[9px] font-black uppercase text-white/40 sm:inline">Jahr</span>
          <select
            aria-label="Jahr filtern"
            className={filterSelectClass}
            value={filters.year ?? ""}
            onChange={e => setYear(e.target.value === "" ? null : e.target.value)}
          >
            <option value="">Alle</option>
            {opts.years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>

        <label className="flex shrink-0 items-center gap-1.5">
          <span className="sr-only">Monat</span>
          <span className="hidden text-[9px] font-black uppercase text-white/40 sm:inline">Monat</span>
          <select
            aria-label="Monat filtern"
            className={filterSelectClass}
            value={filters.month ?? ""}
            onChange={e => setMonth(e.target.value === "" ? null : e.target.value)}
          >
            <option value="">Alle</option>
            {visibleMonths.map(ym => {
              const [y, m] = ym.split("-");
              const idx = parseInt(m ?? "1", 10) - 1;
              return (
                <option key={ym} value={ym}>
                  {DE_MONTHS_SHORT[idx]} {y}
                </option>
              );
            })}
          </select>
        </label>

        <label className="flex shrink-0 items-center gap-1.5">
          <span className="sr-only">Kalenderwoche</span>
          <span className="hidden text-[9px] font-black uppercase text-white/40 sm:inline">KW</span>
          <select
            aria-label="Kalenderwoche filtern"
            className={cn(filterSelectClass, "min-w-[5.5rem] max-w-[8rem]")}
            value={filters.week === null ? "" : String(filters.week)}
            onChange={e => {
              const v = e.target.value;
              setWeek(v === "" ? null : parseInt(v, 10));
            }}
          >
            <option value="">Alle</option>
            {visibleWeeks.map(w => (
              <option key={w} value={w}>KW {w}</option>
            ))}
          </select>
        </label>

        <span className="hidden h-5 w-px shrink-0 bg-white/15 sm:block" aria-hidden />

        {hasFilter && (
          <button
            type="button"
            onClick={() => onFilters({ year: null, month: null, week: null })}
            className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-white/60 transition hover:border-[#FFC72C]/40 hover:text-[#FFC72C]"
          >
            Reset
          </button>
        )}

        <button
          type="button"
          onClick={onPdf}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#FFC72C]/40 bg-[#FFC72C]/12 px-2.5 py-1.5 text-[10px] font-black uppercase text-[#FFC72C] transition hover:bg-[#FFC72C] hover:text-[#1a3826]"
        >
          <FileDown size={12} /> PDF
        </button>

        <span className="ml-auto shrink-0 whitespace-nowrap pl-1 text-[10px] font-bold text-white/40">
          {count} Treffer
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════ MAIN EXPORT ══════════════════════════════ */

type Props = {
  isLoggedIn: boolean;
  canManageTraining?: boolean;
  initialLocked: boolean;
  initialPrograms: PublicTrainingProgram[];
};

export default function TrainingPublicClient({
  isLoggedIn,
  canManageTraining = false,
  initialLocked,
  initialPrograms,
}: Props) {
  const router   = useRouter();
  const [pwd, setPwd]               = useState("");
  const [err, setErr]               = useState<string | null>(null);
  const [pending, setPending]       = useState(false);
  const [modalProgram, setModalProgram] = useState<PublicTrainingProgram | null>(null);
  const [filters, setFilters]       = useState<ActiveFilters>({ year: null, month: null, week: null });

  const showGate      = !isLoggedIn && initialLocked;
  const guestUnlocked = !isLoggedIn && !showGate;

  const filteredPrograms = useMemo(
    () => filterPrograms(initialPrograms, filters),
    [initialPrograms, filters]
  );

  const closeModal = useCallback(() => setModalProgram(null), []);

  /* Gast inactivity logout */
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
    for (const ev of GUEST_IDLE_EVENTS) window.addEventListener(ev, throttled as EventListener, { passive: true });
    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of GUEST_IDLE_EVENTS) window.removeEventListener(ev, throttled as EventListener);
    };
  }, [guestUnlocked, router]);

  async function submitGuest(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      const res  = await fetch("/api/training/guest-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setErr(data.error ?? "Zugang verweigert."); return; }
      router.refresh();
    } catch { setErr("Netzwerkfehler."); }
    finally   { setPending(false); }
  }

  const logoutGuest = useCallback(async () => {
    await fetch("/api/training/guest-logout", { method: "POST", credentials: "same-origin" });
    router.refresh();
  }, [router]);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground" lang="de" translate="no">

      {/* Guest-only header */}
      {!isLoggedIn && (
        <header className="w-full border-b border-white/10 bg-[#1a3826] text-white shadow-md">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className={`flex items-baseline gap-x-2 ${brandFont.className}`}>
                <span className="text-2xl font-black uppercase tracking-tighter text-white">AIW</span>
                <span className="text-sm font-extrabold uppercase tracking-[0.1em] text-[#FFC72C]">Services</span>
              </div>
              {!showGate && (
                <button
                  type="button"
                  onClick={() => void logoutGuest()}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-black uppercase text-white transition hover:bg-white/20"
                >
                  <LogOut size={16} /> Abmelden
                </button>
              )}
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter sm:text-5xl">
              <span className="text-white">SCHUL</span><span className="text-[#FFC72C]">UNGEN</span>
            </h1>
            <p className="mt-2 text-sm text-white/65">
              Termine und Teilnehmerübersicht. Klicken Sie auf eine Karte für alle Details.
            </p>
          </div>
        </header>
      )}

      <main className={isLoggedIn ? "px-4 py-6 sm:p-6 md:p-10" : "mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10"}>
        <div className={isLoggedIn ? "mx-auto max-w-[1600px] space-y-6" : "space-y-6"}>

          {/* Logged-in header */}
          {isLoggedIn && (
            <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between print:hidden">
              <div>
                <h1 className="text-4xl font-black uppercase tracking-tighter text-[#1a3826] dark:text-white">
                  SCHUL<span className="text-[#FFC72C]">UNGEN</span>
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Termine und Teilnehmerübersicht – Klick öffnet alle Details.
                </p>
              </div>
              {canManageTraining && (
                <Link
                  href="/admin/training"
                  className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-black uppercase text-muted-foreground shadow-sm transition hover:bg-accent md:self-auto"
                >
                  <GraduationCap size={15} /> Verwalten
                </Link>
              )}
            </div>
          )}

          {/* Gate / empty / content */}
          {showGate ? (
            <form
              onSubmit={submitGuest}
              className="mx-auto max-w-md space-y-5 rounded-2xl border border-[#FFC72C]/20 bg-[#1a3826]/8 p-6 sm:p-8"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFC72C]">
                <GraduationCap size={28} className="text-[#1a3826]" />
              </div>
              <div>
                <label
                  htmlFor="training-guest-pw"
                  className="mb-1.5 block text-xs font-black uppercase tracking-wide text-foreground/70"
                >
                  Zugangscode
                </label>
                <input
                  id="training-guest-pw"
                  type="password"
                  autoComplete="off"
                  value={pwd}
                  onChange={e => setPwd(e.target.value)}
                  className="w-full rounded-xl border-2 border-border bg-background px-4 py-3.5 text-base font-medium outline-none transition focus:border-[#1a3826] focus:ring-2 focus:ring-[#FFC72C]/40"
                  placeholder="Passwort eingeben"
                />
              </div>
              {err && <p className="text-sm font-semibold text-red-600" role="alert">{err}</p>}
              <button
                type="submit"
                disabled={pending || !pwd.trim()}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#1a3826] px-5 py-3.5 text-sm font-black uppercase tracking-widest text-[#FFC72C] shadow-md transition hover:opacity-95 disabled:opacity-40"
              >
                {pending ? "…" : "Anzeigen"}
              </button>
            </form>

          ) : initialPrograms.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-[#FFC72C]/20 bg-[#1a3826]/5 px-6 py-20 text-center">
              <GraduationCap className="mx-auto mb-4 h-12 w-12 text-[#1a3826]/30 dark:text-[#FFC72C]/30" />
              <p className="font-semibold text-foreground">Keine Schulungstermine vorhanden.</p>
              <p className="mt-1 text-sm text-muted-foreground">Sobald Programme angelegt sind, erscheinen sie hier.</p>
            </div>

          ) : (
            <>
              <FilterBar
                programs={initialPrograms}
                filters={filters}
                onFilters={setFilters}
                onPdf={() => openTrainingSchedulePdfFromPublic(filteredPrograms)}
                count={filteredPrograms.length}
              />

              {filteredPrograms.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-[#FFC72C]/20 py-12 text-center">
                  <Calendar className="mx-auto mb-3 h-10 w-10 text-[#FFC72C]/30" />
                  <p className="font-semibold text-foreground">Keine Schulungen für diesen Zeitraum.</p>
                  <button
                    type="button"
                    onClick={() => setFilters({ year: null, month: null, week: null })}
                    className="mt-3 text-xs font-black text-[#FFC72C] hover:underline"
                  >
                    Filter zurücksetzen
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPrograms.map(p => (
                    <TrainingProgramCard key={p.id} program={p} onOpen={() => setModalProgram(p)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <TrainingDetailModal program={modalProgram} open={modalProgram !== null} onClose={closeModal} />
    </div>
  );
}
