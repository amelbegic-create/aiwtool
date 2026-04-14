"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Check,
  GraduationCap,
  Search,
  UserPlus,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import {
  createTrainingProgram,
  updateTrainingProgram,
  createTrainingSession,
  updateTrainingSession,
  deleteTrainingSession,
  addTrainingParticipant,
  removeTrainingParticipant,
  listTrainingProgramsAdmin,
  searchUsersForTraining,
  updateTrainingTemplate,
  type AdminTrainingProgramRow,
  type AdminTrainingSessionRow,
  type TrainingTemplateOption,
  type TrainingRestaurantOption,
  type TrainingUserSearchRow,
} from "@/app/actions/trainingActions";
import { formatRestaurantLabel } from "@/lib/formatRestaurantLabel";

/* ─────────────────────────────────────────────────────────────────── */
/* Types                                                               */
/* ─────────────────────────────────────────────────────────────────── */

type DraftSession = {
  key: string; // temp key for new, id for existing
  isNew: boolean;
  id?: string;
  title: string;
  starts: string;
  ends: string;
  location: string;
  notes: string;
};

type Props = {
  program?: AdminTrainingProgramRow | null;
  templates: TrainingTemplateOption[];
  restaurants: TrainingRestaurantOption[];
  onClose: () => void;
  onSaved: () => void;
};

/* ─────────────────────────────────────────────────────────────────── */
/* Helpers                                                             */
/* ─────────────────────────────────────────────────────────────────── */

function localDatetimeValue(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sessionKey(s: AdminTrainingSessionRow) {
  return s.id;
}

/* ─────────────────────────────────────────────────────────────────── */
/* TemplateCard                                                        */
/* ─────────────────────────────────────────────────────────────────── */

function TemplateCard({
  tmpl,
  selected,
  onSelect,
  onEdit,
}: {
  tmpl: TrainingTemplateOption;
  selected: boolean;
  onSelect: () => void;
  onEdit: (t: TrainingTemplateOption) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`relative flex cursor-pointer flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[#FFC72C]/50 ${
        selected
          ? "border-[#FFC72C] bg-[#FFC72C]/15 shadow-md"
          : "border-slate-200 bg-white hover:border-[#FFC72C]/60 hover:bg-[#FFC72C]/5 dark:border-slate-700 dark:bg-slate-800/50"
      }`}
    >
      {selected && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#FFC72C]">
          <Check size={11} className="text-[#1a3826]" />
        </span>
      )}
      <span className="pr-6 text-sm font-bold text-slate-800 dark:text-slate-100">{tmpl.title}</span>
      {tmpl.topics && (
        <span className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
          {tmpl.topics}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(tmpl);
        }}
        className="mt-1 flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
      >
        <Pencil size={10} />
        Bearbeiten
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* TemplateEditPanel                                                   */
/* ─────────────────────────────────────────────────────────────────── */

function TemplateEditPanel({
  tmpl,
  onClose,
}: {
  tmpl: TrainingTemplateOption;
  onClose: (updated?: TrainingTemplateOption) => void;
}) {
  const [title, setTitle] = useState(tmpl.title);
  const [topics, setTopics] = useState(tmpl.topics ?? "");
  const [prerequisites, setPrerequisites] = useState(tmpl.prerequisites ?? "");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const r = await updateTrainingTemplate(tmpl.id, { title, topics: topics || null, prerequisites: prerequisites || null });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Vorlage gespeichert.");
      onClose({ ...tmpl, title, topics: topics || null, prerequisites: prerequisites || null });
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-[#FFC72C]/40 bg-amber-50/60 p-4 dark:bg-amber-900/10">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
        Vorlage bearbeiten
      </p>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Titel</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Inhalte / Themen</label>
          <textarea
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Voraussetzungen</label>
          <textarea
            value={prerequisites}
            onChange={(e) => setPrerequisites(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="rounded-lg bg-[#1a3826] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#1a3826]/80 disabled:opacity-50"
          >
            {pending ? "Speichern…" : "Speichern"}
          </button>
          <button
            type="button"
            onClick={() => onClose()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* SessionCard (termin kao kartica-dugme)                             */
/* ─────────────────────────────────────────────────────────────────── */

function SessionDraftCard({
  sess,
  index,
  onUpdate,
  onRemove,
}: {
  sess: DraftSession;
  index: number;
  onUpdate: (key: string, patch: Partial<DraftSession>) => void;
  onRemove: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(!sess.starts);

  const dateLabel = sess.starts
    ? new Date(sess.starts).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;
  const timeLabel = sess.starts
    ? new Date(sess.starts).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
      {/* Header (kartica-dugme) */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a3826] text-xs font-black text-[#FFC72C]">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
              {`Termin ${index + 1}`}
            </p>
            {dateLabel ? (
              <p className="text-xs text-slate-500">
                {dateLabel}
                {timeLabel && ` · ${timeLabel}`}
              </p>
            ) : (
              <p className="text-xs italic text-slate-400">Datum eingeben…</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            onClick={(e) => { e.stopPropagation(); onRemove(sess.key); }}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
          >
            <Trash2 size={14} />
          </span>
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* Expanded Form */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-700">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Start *</label>
              <input
                type="datetime-local"
                value={sess.starts}
                onChange={(e) => onUpdate(sess.key, { starts: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Ende (optional)</label>
              <input
                type="datetime-local"
                value={sess.ends}
                onChange={(e) => onUpdate(sess.key, { ends: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* ParticipantSection (for existing sessions only)                    */
/* ─────────────────────────────────────────────────────────────────── */

function ParticipantSection({
  session,
  onChanged,
}: {
  session: AdminTrainingSessionRow;
  onChanged: () => Promise<void>;
}) {
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<TrainingUserSearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [quickFirst, setQuickFirst] = useState("");
  const [quickLast, setQuickLast] = useState("");
  const [quickBadge, setQuickBadge] = useState("");
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(v: string) {
    setSearchQ(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const r = await searchUsersForTraining(v);
      setResults(r);
      setSearching(false);
    }, 300);
  }

  function addUser(user: TrainingUserSearchRow) {
    startTransition(async () => {
      const r = await addTrainingParticipant({ sessionId: session.id, userId: user.id });
      if (!r.ok) toast.error(r.error);
      else {
        setSearchQ("");
        setResults([]);
        await onChanged();
      }
    });
  }

  function addQuick() {
    if (!quickFirst.trim() && !quickLast.trim()) return;
    startTransition(async () => {
      const r = await addTrainingParticipant({
        sessionId: session.id,
        firstName: quickFirst || null,
        lastName: quickLast || null,
        badgeCode: quickBadge || null,
      });
      if (!r.ok) toast.error(r.error);
      else {
        setQuickFirst("");
        setQuickLast("");
        setQuickBadge("");
        await onChanged();
      }
    });
  }

  function removeP(id: string) {
    startTransition(async () => {
      const r = await removeTrainingParticipant(id);
      if (!r.ok) toast.error(r.error);
      else await onChanged();
    });
  }

  return (
    <div className="space-y-3">
      {/* Participant list */}
      {session.participants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {session.participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs dark:border-slate-600 dark:bg-slate-700"
            >
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {p.userName ?? (`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "–")}
              </span>
              {p.badgeCode && (
                <span className="rounded-full bg-[#FFC72C]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#1a3826]">
                  #{p.badgeCode}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeP(p.id)}
                disabled={pending}
                className="text-slate-400 hover:text-red-500"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search user */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={searchQ}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Mitarbeiter suchen…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
      </div>
      {results.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => addUser(u)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <UserPlus size={11} className="shrink-0 text-slate-400" />
              <span className="font-medium">{u.name ?? u.email}</span>
              {u.email && <span className="text-slate-400">{u.email}</span>}
            </button>
          ))}
        </div>
      )}
      {searching && <p className="text-xs text-slate-400">Suche…</p>}

      {/* Quick add */}
      <div className="flex flex-wrap gap-2">
        <input
          value={quickFirst}
          onChange={(e) => setQuickFirst(e.target.value)}
          placeholder="Vorname"
          className="flex-1 min-w-[100px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
        <input
          value={quickLast}
          onChange={(e) => setQuickLast(e.target.value)}
          placeholder="Nachname"
          className="flex-1 min-w-[100px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
        <input
          value={quickBadge}
          onChange={(e) => setQuickBadge(e.target.value)}
          placeholder="#Badge"
          className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={addQuick}
          disabled={pending || (!quickFirst.trim() && !quickLast.trim())}
          className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-600 disabled:opacity-40"
        >
          <Plus size={11} /> Hinzufügen
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Main Modal                                                          */
/* ─────────────────────────────────────────────────────────────────── */

export default function TrainingUpsertModal({
  program,
  templates,
  restaurants,
  onClose,
  onSaved,
}: Props) {
  const isEdit = Boolean(program);

  // Keep a live snapshot so participant changes show immediately
  const [liveProgram, setLiveProgram] = useState<AdminTrainingProgramRow | null>(program ?? null);

  /* ── Form state ── */
  const [localTemplates, setLocalTemplates] = useState<TrainingTemplateOption[]>(templates);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(program?.templateId ?? null);
  const [editingTemplate, setEditingTemplate] = useState<TrainingTemplateOption | null>(null);
  const [customMode, setCustomMode] = useState(!program?.templateId && !isEdit ? false : !program?.templateId);

  const [title, setTitle] = useState(program?.title ?? "");
  const [description, setDescription] = useState(program?.description ?? program?.topics ?? "");
  const [prerequisites, setPrerequisites] = useState(program?.prerequisites ?? "");
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>(
    program?.restaurants.map((r) => r.id) ?? []
  );
  const [isActive, setIsActive] = useState(program?.isActive ?? true);

  /* ── Sessions draft ── */
  const [sessions, setSessions] = useState<DraftSession[]>(() =>
    (program?.sessions ?? []).map((s) => ({
      key: s.id,
      isNew: false,
      id: s.id,
      title: s.title ?? "",
      starts: localDatetimeValue(s.startsAt),
      ends: s.endsAt ? localDatetimeValue(s.endsAt) : "",
      location: s.location ?? "",
      notes: s.notes ?? "",
    }))
  );

  /* ── Participants panel ── */
  const [showParticipants, setShowParticipants] = useState(false);
  const [participantSessionId, setParticipantSessionId] = useState<string | null>(null);

  const [pending, startTransition] = useTransition();

  const refreshLiveProgram = useCallback(async () => {
    if (!program?.id) return;
    try {
      const rows = await listTrainingProgramsAdmin();
      const next = rows.find((p) => p.id === program.id) ?? null;
      setLiveProgram(next);
    } catch (e) {
      console.error("[TrainingUpsertModal] refresh program failed", e);
    }
  }, [program?.id]);

  useEffect(() => {
    setLiveProgram(program ?? null);
  }, [program]);

  /* ── Apply template ── */
  function applyTemplate(tmplId: string | null) {
    setSelectedTemplateId(tmplId);
    if (!tmplId) return;
    const tmpl = localTemplates.find((t) => t.id === tmplId);
    if (!tmpl) return;
    if (!title.trim()) setTitle(tmpl.title);
    if (!description.trim()) setDescription(tmpl.topics ?? "");
    if (!prerequisites.trim()) setPrerequisites(tmpl.prerequisites ?? "");
  }

  /* ── Toggle restaurant ── */
  function toggleRestaurant(id: string) {
    setSelectedRestaurantIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  /* ── Session drafts ── */
  let sessionCounter = 100;
  function addSession() {
    setSessions((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${sessionCounter++}`,
        isNew: true,
        starts: "",
        ends: "",
        title: "",
        location: "",
        notes: "",
      },
    ]);
  }

  function updateSessionDraft(key: string, patch: Partial<DraftSession>) {
    setSessions((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function removeSessionDraft(key: string) {
    const sess = sessions.find((s) => s.key === key);
    if (!sess) return;
    if (!sess.isNew && sess.id) {
      startTransition(async () => {
        const r = await deleteTrainingSession(sess.id!);
        if (!r.ok) { toast.error(r.error); return; }
        setSessions((prev) => prev.filter((s) => s.key !== key));
      });
    } else {
      setSessions((prev) => prev.filter((s) => s.key !== key));
    }
  }

  /* ── Save ── */
  async function handleSave() {
    if (!title.trim()) { toast.error("Titel erforderlich."); return; }
    if (selectedRestaurantIds.length === 0) { toast.error("Mindestens ein Restaurant auswählen."); return; }

    startTransition(async () => {
      let programId = program?.id;

      if (isEdit && programId) {
        const r = await updateTrainingProgram(programId, {
          title,
          description: description || null,
          topics: description || null,
          prerequisites: prerequisites || null,
          restaurantIds: selectedRestaurantIds,
          templateId: selectedTemplateId,
          isActive,
        });
        if (!r.ok) { toast.error(r.error); return; }
      } else {
        const r = await createTrainingProgram({
          title,
          description: description || null,
          topics: description || null,
          prerequisites: prerequisites || null,
          restaurantIds: selectedRestaurantIds,
          templateId: selectedTemplateId,
        });
        if (!r.ok) { toast.error(r.error); return; }
        programId = r.id;
      }

      // Save sessions
      for (const sess of sessions) {
        if (!sess.starts.trim()) continue;
        const startsAt = new Date(sess.starts).toISOString();
        const endsAt = sess.ends.trim() ? new Date(sess.ends).toISOString() : null;

        if (sess.isNew) {
          await createTrainingSession({
            programId: programId!,
            startsAt,
            endsAt,
            title: null,
            location: null,
            notes: null,
          });
        } else if (sess.id) {
          await updateTrainingSession(sess.id, {
            startsAt,
            endsAt,
            title: null,
            location: null,
            notes: null,
          });
        }
      }

      toast.success(isEdit ? "Programm gespeichert." : "Programm erstellt.");
      onSaved();
    });
  }

  /* ── Scroll lock ── */
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  /* ── Find session for participant panel ── */
  const participantSession = liveProgram?.sessions.find((s) => s.id === participantSessionId) ?? null;

  /* ─────────────────────────────────────────────────────────────── */
  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a3826]">
              <GraduationCap size={18} className="text-[#FFC72C]" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {isEdit ? "Schulung bearbeiten" : "Neue Schulung erstellen"}
              </h2>
              <p className="text-xs text-slate-500">Alles in einem Schritt</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ─── Section A: Template ─── */}
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFC72C] text-[10px] font-black text-[#1a3826]">1</span>
              Vorlage auswählen
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {localTemplates.map((tmpl) => (
                <TemplateCard
                  key={tmpl.id}
                  tmpl={tmpl}
                  selected={selectedTemplateId === tmpl.id && !customMode}
                  onSelect={() => {
                    setCustomMode(false);
                    applyTemplate(tmpl.id);
                  }}
                  onEdit={(t) => setEditingTemplate(t)}
                />
              ))}
              {/* Custom */}
              <button
                type="button"
                onClick={() => { setCustomMode(true); setSelectedTemplateId(null); }}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                  customMode
                    ? "border-slate-700 bg-slate-700/10"
                    : "border-slate-200 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800/50"
                }`}
              >
                {customMode && (
                  <span className="mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700">
                    <Check size={11} className="text-white" />
                  </span>
                )}
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Individuell</span>
                <span className="text-xs text-slate-500">Eigene Inhalte</span>
              </button>
            </div>

            {editingTemplate && (
              <TemplateEditPanel
                tmpl={editingTemplate}
                onClose={(updated) => {
                  if (updated) {
                    setLocalTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
                  }
                  setEditingTemplate(null);
                }}
              />
            )}
          </div>

          {/* ─── Section B: Programmdetails ─── */}
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFC72C] text-[10px] font-black text-[#1a3826]">2</span>
              Programm-Details
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Titel *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z. B. Crewtrainer Service"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 transition focus:border-[#1a3826] focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Beschreibung / Inhalte
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Was wird in diesem Training behandelt?"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 transition focus:border-[#1a3826] focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Voraussetzungen
                </label>
                <textarea
                  value={prerequisites}
                  onChange={(e) => setPrerequisites(e.target.value)}
                  rows={2}
                  placeholder="Was wird vorausgesetzt?"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 transition focus:border-[#1a3826] focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Restaurant multi-select pills */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Restaurants * <span className="font-normal text-slate-400">(Mehrfachauswahl möglich)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {restaurants.map((r) => {
                    const label = formatRestaurantLabel(r);
                    const active = selectedRestaurantIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRestaurant(r.id)}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                          active
                            ? "border-[#1a3826] bg-[#1a3826] text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-[#1a3826]/50 hover:bg-[#1a3826]/5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {active && <Check size={10} />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isEdit && (
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#1a3826]"
                  />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    In der öffentlichen Übersicht sichtbar
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* ─── Section C: Termine ─── */}
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFC72C] text-[10px] font-black text-[#1a3826]">3</span>
              Termine
            </p>
            <div className="space-y-2">
              {sessions.map((sess, idx) => (
                <SessionDraftCard
                  key={sess.key}
                  sess={sess}
                  index={idx}
                  onUpdate={updateSessionDraft}
                  onRemove={removeSessionDraft}
                />
              ))}
              <button
                type="button"
                onClick={addSession}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-xs font-bold text-slate-500 transition hover:border-[#FFC72C] hover:text-[#1a3826] dark:border-slate-700 dark:hover:border-[#FFC72C]"
              >
                <Plus size={14} /> Termin hinzufügen
              </button>
            </div>
          </div>

          {/* ─── Section D: Polaznici (only for existing sessions) ─── */}
          {isEdit && program && program.sessions.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowParticipants((v) => !v)}
                className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFC72C] text-[10px] font-black text-[#1a3826]">4</span>
                Teilnehmer verwalten
                {showParticipants ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showParticipants && (
                <div className="space-y-4">
                  {/* Session selector tabs */}
                  <div className="flex flex-wrap gap-2">
                    {(liveProgram?.sessions ?? program.sessions).map((s, idx) => {
                      const dateLabel = new Date(s.startsAt).toLocaleDateString("de-AT", {
                        day: "2-digit",
                        month: "2-digit",
                      });
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setParticipantSessionId(s.id)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                            participantSessionId === s.id
                              ? "border-[#1a3826] bg-[#1a3826] text-white"
                              : "border-slate-200 text-slate-600 hover:border-[#1a3826]/50"
                          }`}
                        >
                          {s.title?.trim() || `Termin ${idx + 1}`} · {dateLabel}
                          <span className="ml-1 rounded-full bg-current/10 px-1.5 py-0.5 text-[10px]">
                            {s.participants.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {participantSession && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                      <ParticipantSection session={participantSession} onChanged={refreshLiveProgram} />
                    </div>
                  )}
                  {!participantSessionId && (
                    <p className="text-xs text-slate-400">Termin auswählen um Teilnehmer zu verwalten.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="rounded-xl bg-[#1a3826] px-6 py-2 text-sm font-black text-[#FFC72C] shadow hover:bg-[#1a3826]/80 disabled:opacity-50"
          >
            {pending ? "Speichern…" : isEdit ? "Änderungen speichern" : "Schulung erstellen"}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
