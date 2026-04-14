"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  GraduationCap,
  Plus,
  Trash2,
  Pencil,
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
  FileDown,
  MapPin,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AdminTrainingParticipantRow,
  AdminTrainingProgramRow,
  TrainingTemplateOption,
  TrainingRestaurantOption,
} from "@/app/actions/trainingActions";
import {
  listTrainingProgramsAdmin,
  deleteTrainingProgram,
  saveParticipantAssessment,
} from "@/app/actions/trainingActions";
import { formatRestaurantLabel } from "@/lib/formatRestaurantLabel";
import { openTrainingSchedulePdfFromAdmin } from "@/lib/trainingPdf";
import TrainingUpsertModal from "./TrainingUpsertModal";

/* ─────────────────────────────────────────────────────────────────── */
/* Helpers                                                             */
/* ─────────────────────────────────────────────────────────────────── */

function participantLabel(p: AdminTrainingParticipantRow): string {
  return (
    p.userName?.trim() ||
    [p.firstName, p.lastName].filter(Boolean).join(" ") ||
    p.userEmail ||
    "—"
  );
}

function formatSessionDate(startsAt: string, endsAt: string | null): string {
  const s = new Date(startsAt);
  if (isNaN(s.getTime())) return startsAt;
  const dStr = s.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
  const tStr = s.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
  if (!endsAt) return `${dStr} · ${tStr}`;
  const e = new Date(endsAt);
  if (isNaN(e.getTime())) return `${dStr} · ${tStr}`;
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  if (sameDay) {
    const eStr = e.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
    return `${dStr} · ${tStr} – ${eStr}`;
  }
  const eDStr = e.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
  const eTStr = e.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
  return `${dStr} ${tStr} → ${eDStr} ${eTStr}`;
}

type AssessmentDraft = { comment: string; pctStr: string };

function SessionAssessmentBatch({
  session,
  onRefresh,
}: {
  session: AdminTrainingProgramRow["sessions"][0];
  onRefresh: () => Promise<void>;
}) {
  const initial = useMemo(() => {
    const m = new Map<string, AssessmentDraft>();
    for (const p of session.participants) {
      m.set(p.id, {
        comment: p.courseComment ?? "",
        pctStr:
          p.resultPercent !== null && p.resultPercent !== undefined ? String(p.resultPercent) : "",
      });
    }
    return m;
  }, [session.participants]);

  const [drafts, setDrafts] = useState<Record<string, AssessmentDraft>>(() => {
    const obj: Record<string, AssessmentDraft> = {};
    for (const [id, d] of initial.entries()) obj[id] = d;
    return obj;
  });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const obj: Record<string, AssessmentDraft> = {};
    for (const [id, d] of initial.entries()) obj[id] = d;
    setDrafts(obj);
  }, [initial]);

  function setOne(id: string, patch: Partial<AssessmentDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { comment: "", pctStr: "" }), ...patch },
    }));
  }

  function saveAll() {
    startTransition(async () => {
      for (const p of session.participants) {
        const d = drafts[p.id] ?? { comment: "", pctStr: "" };
        const nextComment = (d.comment ?? "").trim();
        const pctStr = String(d.pctStr ?? "").trim();
        let pct: number | null = null;
        if (pctStr) {
          const n = Number.parseInt(pctStr, 10);
          if (isNaN(n) || n < 0 || n > 100) {
            toast.error(`Ergebnis: 0–100 (bei ${participantLabel(p)})`);
            return;
          }
          pct = n;
        }

        const prevComment = (p.courseComment ?? "").trim();
        const prevPct = p.resultPercent ?? null;
        const changed = nextComment !== prevComment || pct !== prevPct;
        const hasAny = Boolean(nextComment) || pct !== null;
        if (!changed) continue;
        if (!hasAny) continue; // do not send empty; server rejects

        const r = await saveParticipantAssessment(p.id, {
          courseComment: nextComment || null,
          resultPercent: pct,
        });
        if (!r.ok) {
          toast.error(r.error ?? "Fehler");
          return;
        }
      }
      toast.success("Alle Bewertungen gespeichert.");
      await onRefresh();
    });
  }

  if (session.participants.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Bewertungen</p>
        <button
          type="button"
          onClick={saveAll}
          disabled={pending}
          className="rounded-lg bg-[#1a3826] px-3 py-1.5 text-[11px] font-black text-[#FFC72C] disabled:opacity-50"
        >
          {pending ? "Speichern…" : "Alle speichern"}
        </button>
      </div>

      <div className="space-y-2">
        {session.participants.map((p) => {
          const d = drafts[p.id] ?? { comment: "", pctStr: "" };
          return (
            <div
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900/30"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-xs font-bold text-slate-800 dark:text-slate-100">
                  {participantLabel(p)}
                </span>
                <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                  %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={d.pctStr}
                    onChange={(e) => setOne(p.id, { pctStr: e.target.value })}
                    className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700"
                  />
                </label>
              </div>
              <textarea
                value={d.comment}
                onChange={(e) => setOne(p.id, { comment: e.target.value })}
                rows={2}
                placeholder="Kommentar…"
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* SessionInlineCard – termin kao kartica-dugme                        */
/* ─────────────────────────────────────────────────────────────────── */

function SessionInlineCard({
  session,
  index,
  programTitle,
  onRefresh,
}: {
  session: AdminTrainingProgramRow["sessions"][0];
  index: number;
  programTitle: string;
  onRefresh: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);

  const displayTitle =
    session.title?.trim() && session.title.trim().toLowerCase() !== programTitle.trim().toLowerCase()
      ? session.title.trim()
      : `Termin ${index + 1}`;
  const dateStr = formatSessionDate(session.startsAt, session.endsAt);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition dark:border-slate-700 dark:bg-slate-800/50">
      {/* Card-button header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a3826] text-xs font-black text-[#FFC72C]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{displayTitle}</p>
          <p className="truncate text-xs text-slate-500">{dateStr}</p>
          {session.location && (
            <p className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin size={10} />
              {session.location}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            <Users size={10} className="mr-1 inline" />
            {session.participants.length}
          </span>
          {expanded ? (
            <ChevronUp size={15} className="text-slate-400" />
          ) : (
            <ChevronDown size={15} className="text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded participant list */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/80 px-4 pb-4 pt-3 dark:border-slate-700 dark:bg-slate-800/30">
          {session.participants.length === 0 ? (
            <p className="py-2 text-center text-xs italic text-slate-400">
              Keine Teilnehmer – über „Bearbeiten" hinzufügen.
            </p>
          ) : (
            <ul className="space-y-2">
              {session.participants.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 font-semibold text-slate-800 dark:text-slate-100">
                      {participantLabel(p)}
                    </span>
                    {p.badgeCode && (
                      <span className="rounded-full bg-[#FFC72C]/20 px-2 py-0.5 text-[11px] font-black text-[#1a3826]">
                        #{p.badgeCode.replace(/^#/, "")}
                      </span>
                    )}
                    {p.resultPercent !== null && (
                      <span className="rounded-full bg-[#1a3826] px-2.5 py-0.5 text-[11px] font-black text-[#FFC72C]">
                        {p.resultPercent}%
                      </span>
                    )}
                    {p.assessedAt ? (
                      <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                    ) : null}
                  </div>
                  {p.userEmail && (
                    <p className="mt-0.5 text-[11px] text-slate-400">{p.userEmail}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <SessionAssessmentBatch session={session} onRefresh={onRefresh} />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* ProgramCard                                                         */
/* ─────────────────────────────────────────────────────────────────── */

function ProgramCard({
  program,
  templates,
  restaurants,
  onEdit,
  onDeleted,
  onRefresh,
}: {
  program: AdminTrainingProgramRow;
  templates: TrainingTemplateOption[];
  restaurants: TrainingRestaurantOption[];
  onEdit: () => void;
  onDeleted: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const totalParticipants = program.sessions.reduce((n, s) => n + s.participants.length, 0);

  function remove() {
    if (!confirm(`Programm „${program.title}" mit allen Terminen löschen?`)) return;
    startTransition(async () => {
      const r = await deleteTrainingProgram(program.id);
      if (!r.ok) { toast.error(r.error ?? "Fehler"); return; }
      toast.success("Gelöscht.");
      await onDeleted();
    });
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl dark:border-slate-700/60 dark:bg-slate-900">
      {/* Gold top stripe */}
      <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-[#FFC72C] via-[#f5d547] to-[#FFC72C]" />

      {/* Header */}
      <div className="relative bg-gradient-to-b from-[#1a3826]/[0.07] to-transparent px-5 pb-4 pt-4 dark:from-[#FFC72C]/[0.07]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-lg font-black uppercase leading-tight tracking-tight text-[#1a3826] dark:text-[#FFC72C]">
            {program.title}
          </h3>
          <div className="flex items-center gap-2">
            {program.templateTitle && (
              <span className="rounded-full bg-[#FFC72C]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#1a3826]">
                {program.templateTitle}
              </span>
            )}
            {!program.isActive && (
              <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <XCircle size={10} />
                Inaktiv
              </span>
            )}
          </div>
        </div>

        {/* Restaurant pills */}
        {program.restaurants.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {program.restaurants.map((r) => (
              <span
                key={r.id}
                className="flex items-center gap-1 rounded-full bg-[#1a3826]/10 px-3 py-1 text-[11px] font-bold text-[#1a3826] dark:bg-[#FFC72C]/15 dark:text-[#FFC72C]"
              >
                <MapPin size={10} className="shrink-0" />
                {formatRestaurantLabel(r)}
              </span>
            ))}
          </div>
        )}

        {/* Description preview */}
        {(program.description || program.topics) && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {(program.description || program.topics)?.trim()}
          </p>
        )}

        {/* Stats row */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 rounded-xl border border-[#1a3826]/15 bg-white px-3 py-1.5 text-xs font-bold text-[#1a3826] shadow-sm dark:border-[#FFC72C]/20 dark:bg-slate-800 dark:text-[#FFC72C]">
            <Calendar size={13} />
            {program.sessions.length} Termin{program.sessions.length !== 1 ? "e" : ""}
          </span>
          <span className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Users size={13} />
            {totalParticipants} Teilnehmer
          </span>
        </div>
      </div>

      {/* Session cards (Termine als Kartice) */}
      {program.sessions.length > 0 && (
        <div className="space-y-2 px-5 pb-3 pt-2">
          {program.sessions.map((sess, idx) => (
            <SessionInlineCard
              key={sess.id}
              session={sess}
              index={idx}
              programTitle={program.title}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/30">
        <button
          type="button"
          onClick={() => openTrainingSchedulePdfFromAdmin(program)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <FileDown size={13} /> PDF
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1a3826] px-4 py-2 text-xs font-black text-[#FFC72C] shadow-md transition hover:opacity-90"
        >
          <Pencil size={13} /> Bearbeiten
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="flex items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          aria-label="Löschen"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Main component                                                      */
/* ─────────────────────────────────────────────────────────────────── */

export default function TrainingAdminClient({
  initialPrograms,
  templates,
  restaurants,
}: {
  initialPrograms: AdminTrainingProgramRow[];
  templates: TrainingTemplateOption[];
  restaurants: TrainingRestaurantOption[];
}) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [modalProgram, setModalProgram] = useState<AdminTrainingProgramRow | null | undefined>(
    undefined // undefined = closed, null = create new, value = edit
  );
  const [tab, setTab] = useState<"active" | "archive">("active");

  const refresh = useCallback(async () => {
    try {
      const next = await listTrainingProgramsAdmin();
      setPrograms(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Laden.");
    }
  }, []);

  const modalOpen = modalProgram !== undefined;

  const now = new Date();
  /** Aktiv: kein Termin ODER mind. ein Termin in der Zukunft */
  const activePrograms = programs.filter(
    (p) => p.sessions.length === 0 || p.sessions.some((s) => new Date(s.startsAt) >= now)
  );
  /** Archiv: alle Termine liegen in der Vergangenheit */
  const archivedPrograms = programs.filter(
    (p) => p.sessions.length > 0 && p.sessions.every((s) => new Date(s.startsAt) < now)
  );
  const visiblePrograms = tab === "active" ? activePrograms : archivedPrograms;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">

      {/* Full-width dark green header banner */}
      <header className="w-full bg-[#1a3826] px-4 pb-6 pt-4 sm:px-6 md:px-10">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-emerald-300/70 hover:text-[#FFC72C]"
        >
          <ArrowLeft size={14} /> Zurück zur Verwaltung
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-2 ring-[#FFC72C]/30">
              <GraduationCap size={30} className="text-[#FFC72C]" />
            </span>
            <div className="min-w-0">
              <h1 className="font-black uppercase tracking-tighter text-3xl sm:text-4xl md:text-5xl">
                <span className="text-white">SCHUL</span>
                <span className="text-[#FFC72C]">UNGEN</span>
              </h1>
              <p className="mt-1 text-sm font-medium text-emerald-100/80 sm:text-base">
                Trainingsprogramme verwalten – alles in einem Popup.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalProgram(null)}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#FFC72C] px-5 py-3 text-sm font-black uppercase tracking-wide text-[#1a3826] shadow-md transition hover:bg-[#FFC72C]/90 sm:self-auto"
          >
            <Plus size={18} /> Neue Schulung
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">

        {/* Aktiv / Archiv tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-1 dark:border-slate-700 dark:bg-slate-800/50 w-fit">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wide transition ${
              tab === "active"
                ? "bg-[#1a3826] text-[#FFC72C] shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <GraduationCap size={14} />
            Aktiv
            {activePrograms.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${tab === "active" ? "bg-white/20 text-[#FFC72C]" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                {activePrograms.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("archive")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wide transition ${
              tab === "archive"
                ? "bg-[#1a3826] text-[#FFC72C] shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Calendar size={14} />
            Archiv
            {archivedPrograms.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${tab === "archive" ? "bg-white/20 text-[#FFC72C]" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                {archivedPrograms.length}
              </span>
            )}
          </button>
        </div>

        {/* Programs grid */}
        {visiblePrograms.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-slate-700">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <GraduationCap size={32} className="text-slate-400" />
            </span>
            <p className="text-sm font-medium text-slate-500">
              {tab === "archive"
                ? "Noch keine archivierten Trainingsprogramme."
                : "Noch keine aktiven Trainingsprogramme."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {visiblePrograms.map((p) => (
              <ProgramCard
                key={p.id}
                program={p}
                templates={templates}
                restaurants={restaurants}
                onEdit={() => setModalProgram(p)}
                onDeleted={refresh}
                onRefresh={refresh}
              />
            ))}
          </div>
        )}
      </div>

      {/* Single unified modal */}
      {modalOpen && (
        <TrainingUpsertModal
          program={modalProgram ?? null}
          templates={templates}
          restaurants={restaurants}
          onClose={() => setModalProgram(undefined)}
          onSaved={async () => {
            setModalProgram(undefined);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
