"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
  MessageSquare, Plus, X, Loader2, ChevronDown, ChevronUp,
  Clock, CheckCircle, AlertCircle, Ban, Archive, RotateCcw,
  Edit, Send, Users, Inbox, AlertTriangle,
} from "lucide-react";
import {
  createOneOnOneTopic,
  getMyOneOnOneTopics,
  getMySubordinateTopics,
  updateTopicStatus,
  cancelMyTopic,
  archiveTopic,
  unarchiveTopic,
  updateTopicNotes,
  updateMyTopic,
  type OneOnOneTopicRow,
} from "@/app/actions/oneOnOneActions";
import type { OneOnOneTopicStatus } from "@prisma/client";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<OneOnOneTopicStatus, { label: string; icon: React.ReactNode; chip: string }> = {
  OPEN:        { label: "Offen",         icon: <Clock size={12} />,        chip: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300/50" },
  IN_PROGRESS: { label: "In Bearbeitung",icon: <AlertCircle size={12} />,  chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300/50" },
  DONE:        { label: "Erledigt",      icon: <CheckCircle size={12} />,  chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300/50" },
  CANCELLED:   { label: "Storniert",     icon: <Ban size={12} />,          chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300/50" },
};

function StatusChip({ status }: { status: OneOnOneTopicStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${c.chip}`}>
      {c.icon} {c.label}
    </span>
  );
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({
  supervisorName,
  onClose,
  onCreated,
}: {
  supervisorName: string | null;
  onClose: () => void;
  onCreated: (t: OneOnOneTopicRow) => void;
}) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("Bitte einen Titel eingeben."); return; }
    startTransition(async () => {
      const r = await createOneOnOneTopic({ title, details, isUrgent });
      if (r.ok) {
        toast.success("Gesprächsthema erstellt.");
        onCreated(r.topic);
        onClose();
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 bg-[#1a3826]">
          <div className="flex items-center gap-2.5">
            <MessageSquare size={18} className="text-[#FFC72C]" />
            <span className="text-sm font-black text-white">Neues Gesprächsthema</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {supervisorName && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
              <Send size={13} className="shrink-0 text-[#1a3826] dark:text-[#FFC72C]" />
              Anfrage wird gesendet an: <strong className="text-foreground ml-1">{supervisorName}</strong>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Thema *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Worum geht es?"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition"
              autoFocus
            />
            <div className="text-right text-[10px] text-muted-foreground/60 mt-1">{title.length}/200</div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Details (optional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Hintergrund, Fragen, Anliegen…"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition"
            />
            <div className="text-right text-[10px] text-muted-foreground/60 mt-1">{details.length}/1000</div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-border px-4 py-3 hover:bg-muted/40 transition select-none">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              className="rounded"
            />
            <div>
              <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-red-500" /> Dringend
              </div>
              <div className="text-xs text-muted-foreground">Bevorzugte Behandlung anfragen</div>
            </div>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={pending || !title.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a3826] text-[#FFC72C] text-sm font-black hover:bg-[#142d1f] transition disabled:opacity-60"
            >
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {pending ? "Senden…" : "Thema senden"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Detail / Edit Modal ──────────────────────────────────────────────────────

function TopicDetailModal({
  topic,
  viewAs,
  onClose,
  onUpdated,
}: {
  topic: OneOnOneTopicRow;
  viewAs: "requester" | "supervisor";
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [statusPending, startStatusTransition] = useTransition();
  const [notesPending, startNotesTransition] = useTransition();
  const [editPending, startEditTransition] = useTransition();

  const [supNotes, setSupNotes] = useState(topic.supervisorNotes ?? "");
  const [agreedActions, setAgreedActions] = useState(topic.agreedActions ?? "");
  const [editTitle, setEditTitle] = useState(topic.title);
  const [editDetails, setEditDetails] = useState(topic.details ?? "");
  const [editMode, setEditMode] = useState(false);

  const canEditTopic = viewAs === "requester" && topic.status === "OPEN";
  const canChangeStatus = viewAs === "supervisor" && (topic.status === "OPEN" || topic.status === "IN_PROGRESS");
  const canSaveNotes = viewAs === "supervisor";

  const handleStatusChange = (newStatus: "IN_PROGRESS" | "DONE" | "CANCELLED") => {
    startStatusTransition(async () => {
      const r = await updateTopicStatus(topic.id, newStatus, { supervisorNotes: supNotes, agreedActions });
      if (r.ok) {
        toast.success(`Status geändert: ${STATUS_CONFIG[newStatus].label}`);
        onUpdated();
        onClose();
      } else {
        toast.error(r.error ?? "Fehler.");
      }
    });
  };

  const handleSaveNotes = () => {
    startNotesTransition(async () => {
      const r = await updateTopicNotes(topic.id, { supervisorNotes: supNotes, agreedActions });
      if (r.ok) {
        toast.success("Notizen gespeichert.");
        onUpdated();
      } else {
        toast.error(r.error ?? "Fehler.");
      }
    });
  };

  const handleSaveEdit = () => {
    startEditTransition(async () => {
      const r = await updateMyTopic(topic.id, { title: editTitle, details: editDetails });
      if (r.ok) {
        toast.success("Thema aktualisiert.");
        onUpdated();
        setEditMode(false);
      } else {
        toast.error(r.error ?? "Fehler.");
      }
    });
  };

  const handleCancel = () => {
    startStatusTransition(async () => {
      const r = await cancelMyTopic(topic.id);
      if (r.ok) {
        toast.success("Thema storniert.");
        onUpdated();
        onClose();
      } else {
        toast.error(r.error ?? "Fehler.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 bg-[#1a3826] sticky top-0 z-10">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusChip status={topic.status} />
              {topic.isUrgent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-200 border border-red-500/30">
                  <AlertTriangle size={10} /> Dringend
                </span>
              )}
            </div>
            <h2 className="text-base font-black text-white mt-1.5 leading-tight">{topic.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Participants */}
          <div className="grid grid-cols-2 gap-3">
            <ParticipantCard label="Anfragender" user={topic.createdByUser} date={topic.createdAt} />
            <ParticipantCard label="Vorgesetzter" user={topic.supervisor} date={null} />
          </div>

          {/* Edit mode for requester */}
          {canEditTopic && editMode ? (
            <div className="space-y-3 rounded-2xl border border-[#1a3826]/20 bg-[#1a3826]/3 p-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Thema</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Details</label>
                <textarea
                  value={editDetails}
                  onChange={(e) => setEditDetails(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditMode(false)} className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted">Abbrechen</button>
                <button type="button" onClick={handleSaveEdit} disabled={editPending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1a3826] text-[#FFC72C] text-xs font-black disabled:opacity-60">
                  {editPending ? <Loader2 size={12} className="animate-spin" /> : null} Speichern
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Details */}
              {topic.details && (
                <Section title="Details" icon={<MessageSquare size={14} />}>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{topic.details}</p>
                </Section>
              )}
            </>
          )}

          {/* Supervisor notes section */}
          {(topic.supervisorNotes || topic.agreedActions || canSaveNotes) && (
            <Section title="Nach dem Gespräch" icon={<CheckCircle size={14} />} accent>
              {canSaveNotes ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Gesprächsnotizen</label>
                    <textarea
                      value={supNotes}
                      onChange={(e) => setSupNotes(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Was wurde besprochen?"
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Dogovoreni koraci</label>
                    <textarea
                      value={agreedActions}
                      onChange={(e) => setAgreedActions(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder="Was wurde vereinbart?"
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={notesPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#1a3826]/30 text-xs font-black text-[#1a3826] dark:text-[#FFC72C] hover:bg-[#1a3826]/5 transition disabled:opacity-60"
                  >
                    {notesPending ? <Loader2 size={12} className="animate-spin" /> : null} Notizen speichern
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {topic.supervisorNotes && (
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Notizen</div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{topic.supervisorNotes}</p>
                    </div>
                  )}
                  {topic.agreedActions && (
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Vereinbarte Schritte</div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{topic.agreedActions}</p>
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* Timeline */}
          <Section title="Verlauf" icon={<Clock size={14} />}>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <TimelineEntry label="Erstellt" date={topic.createdAt} />
              {topic.updatedAt !== topic.createdAt && <TimelineEntry label="Aktualisiert" date={topic.updatedAt} />}
              {topic.resolvedAt && <TimelineEntry label="Abgeschlossen" date={topic.resolvedAt} />}
            </div>
          </Section>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {/* Requester: edit OPEN */}
            {canEditTopic && !editMode && (
              <button type="button" onClick={() => setEditMode(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted transition">
                <Edit size={13} /> Bearbeiten
              </button>
            )}
            {/* Requester: cancel OPEN */}
            {viewAs === "requester" && topic.status === "OPEN" && (
              <button type="button" onClick={handleCancel} disabled={statusPending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/10">
                {statusPending ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />} Stornieren
              </button>
            )}
            {/* Supervisor: set in progress */}
            {canChangeStatus && topic.status === "OPEN" && (
              <button type="button" onClick={() => handleStatusChange("IN_PROGRESS")} disabled={statusPending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-400/30 text-xs font-bold hover:bg-amber-500/15 transition disabled:opacity-60">
                {statusPending ? <Loader2 size={13} className="animate-spin" /> : <AlertCircle size={13} />} In Bearbeitung
              </button>
            )}
            {/* Supervisor: done */}
            {canChangeStatus && (
              <button type="button" onClick={() => handleStatusChange("DONE")} disabled={statusPending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-400/30 text-xs font-bold hover:bg-emerald-500/15 transition disabled:opacity-60">
                {statusPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Als erledigt markieren
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  viewAs,
  onOpen,
  onArchive,
  onUnarchive,
  isArchived,
}: {
  topic: OneOnOneTopicRow;
  viewAs: "requester" | "supervisor";
  onOpen: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  isArchived: boolean;
}) {
  const otherUser = viewAs === "requester" ? topic.supervisor : topic.createdByUser;

  return (
    <div className={`rounded-2xl border ${topic.isUrgent && topic.status === "OPEN" ? "border-red-300/60 dark:border-red-700/40" : "border-border"} bg-card shadow-sm hover:shadow-md transition overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#1a3826] to-[#0f2218] flex items-center justify-center text-[#FFC72C] text-xs font-black shrink-0">
            {otherUser.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={otherUser.image} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              initials(otherUser.name)
            )}
          </div>
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <StatusChip status={topic.status} />
              {topic.isUrgent && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-red-600 dark:text-red-400">
                  <AlertTriangle size={10} /> Dringend
                </span>
              )}
            </div>
            <p className="text-sm font-black text-foreground leading-snug truncate">{topic.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {viewAs === "requester" ? `An: ${otherUser.name ?? otherUser.email}` : `Von: ${otherUser.name ?? otherUser.email}`}
              {" · "}
              {fmtDate(topic.createdAt)}
            </p>
            {topic.details && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 opacity-70">{topic.details}</p>
            )}
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 flex items-center gap-2 border-t border-border/40 pt-2.5">
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 py-2 rounded-xl bg-[#1a3826]/8 hover:bg-[#1a3826]/15 dark:bg-[#FFC72C]/8 dark:hover:bg-[#FFC72C]/15 text-[#1a3826] dark:text-[#FFC72C] text-xs font-black transition"
        >
          Öffnen
        </button>
        {isArchived ? (
          <button type="button" onClick={onUnarchive} className="p-2 rounded-xl border border-border hover:bg-muted transition text-muted-foreground" title="Wiederherstellen">
            <RotateCcw size={14} />
          </button>
        ) : (
          (topic.status === "DONE" || topic.status === "CANCELLED") && (
            <button type="button" onClick={onArchive} className="p-2 rounded-xl border border-border hover:bg-muted transition text-muted-foreground" title="Archivieren">
              <Archive size={14} />
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ─── Section helper ───────────────────────────────────────────────────────────

function Section({ title, icon, children, accent }: { title: string; icon: React.ReactNode; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border ${accent ? "border-[#1a3826]/20 dark:border-[#FFC72C]/20 bg-[#1a3826]/3 dark:bg-[#FFC72C]/3" : "border-border bg-muted/20"} p-4`}>
      <div className="flex items-center gap-2 mb-3 text-xs font-black text-muted-foreground uppercase tracking-wide">
        <span className="text-[#1a3826] dark:text-[#FFC72C]">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function ParticipantCard({ label, user, date }: { label: string; user: { name: string | null; email: string | null; image: string | null }; date: Date | string | null }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wide mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#1a3826] to-[#0f2218] flex items-center justify-center text-[#FFC72C] text-[10px] font-black shrink-0 overflow-hidden">
          {user.image ? <img src={user.image} alt="" className="w-full h-full object-cover" /> : initials(user.name)}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground truncate">{user.name ?? user.email ?? "—"}</p>
          {date && <p className="text-[10px] text-muted-foreground">{fmtDate(date)}</p>}
        </div>
      </div>
    </div>
  );
}

function TimelineEntry({ label, date }: { label: string; date: Date | string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-[#1a3826] dark:bg-[#FFC72C] shrink-0" />
      <span className="font-semibold">{label}:</span>
      <span>{fmtDate(date)}</span>
    </div>
  );
}

// ─── Main Tab Component ───────────────────────────────────────────────────────

type Props = {
  userId: string;
  hasSupervisor: boolean;
  supervisorName: string | null;
  supervisorImage: string | null;
  hasSubordinates: boolean;
};

export default function OneOnOneTab({
  hasSupervisor,
  supervisorName,
  supervisorImage,
  hasSubordinates,
}: Props) {
  const [activeSection, setActiveSection] = useState<"mine" | "inbox">("mine");
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<{ topic: OneOnOneTopicRow; viewAs: "requester" | "supervisor" } | null>(null);

  const [myTopics, setMyTopics] = useState<OneOnOneTopicRow[]>([]);
  const [inboxTopics, setInboxTopics] = useState<OneOnOneTopicRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTopics = async () => {
    setLoading(true);
    const [mine, inbox] = await Promise.all([
      getMyOneOnOneTopics({ archived: showArchived }),
      hasSubordinates ? getMySubordinateTopics({ archived: showArchived }) : Promise.resolve([]),
    ]);
    setMyTopics(mine);
    setInboxTopics(inbox);
    setLoading(false);
  };

  useEffect(() => {
    loadTopics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const handleArchive = async (topicId: string) => {
    const r = await archiveTopic(topicId);
    if (r.ok) { toast.success("Archiviert."); loadTopics(); }
    else toast.error(r.error ?? "Fehler.");
  };

  const handleUnarchive = async (topicId: string) => {
    const r = await unarchiveTopic(topicId);
    if (r.ok) { toast.success("Wiederhergestellt."); loadTopics(); }
    else toast.error(r.error ?? "Fehler.");
  };

  const activeTopics = activeSection === "mine" ? myTopics : inboxTopics;
  const viewAs: "requester" | "supervisor" = activeSection === "mine" ? "requester" : "supervisor";
  const openCount = activeTopics.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <MessageSquare size={20} className="text-[#1a3826] dark:text-[#FFC72C]" />
            Gesprächsthemen
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Themen für das nächste Gespräch mit dem Vorgesetzten festhalten
          </p>
        </div>
        {hasSupervisor && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a3826] text-[#FFC72C] text-sm font-black hover:bg-[#142d1f] transition shadow-md"
          >
            <Plus size={15} /> Neues Thema
          </button>
        )}
      </div>

      {/* No supervisor notice */}
      {!hasSupervisor && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50/50 dark:bg-amber-900/10 p-5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground">Kein Vorgesetzter zugewiesen</p>
            <p className="text-xs text-muted-foreground mt-0.5">Bitte wende dich an einen Administrator, um deinen Vorgesetzten zuzuweisen.</p>
          </div>
        </div>
      )}

      {/* Section switcher (if user has subordinates) */}
      {hasSubordinates && (
        <div className="flex rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setActiveSection("mine")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black transition ${activeSection === "mine" ? "bg-[#1a3826] text-[#FFC72C]" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <Send size={14} />
            Meine Themen
            {myTopics.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length > 0 && (
              <span className={`inline-flex h-4 min-w-[16px] px-1 rounded-full text-[9px] font-black items-center justify-center ${activeSection === "mine" ? "bg-[#FFC72C]/20 text-[#FFC72C]" : "bg-[#1a3826] text-white"}`}>
                {myTopics.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("inbox")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black transition ${activeSection === "inbox" ? "bg-[#1a3826] text-[#FFC72C]" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <Inbox size={14} />
            Von Mitarbeitern
            {inboxTopics.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length > 0 && (
              <span className={`inline-flex h-4 min-w-[16px] px-1 rounded-full text-[9px] font-black items-center justify-center ${activeSection === "inbox" ? "bg-[#FFC72C]/20 text-[#FFC72C]" : "bg-[#1a3826] text-white"}`}>
                {inboxTopics.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Archive toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground">
          {loading ? "Laden…" : `${openCount} aktive${openCount !== 1 ? "" : "s"} Thema${openCount !== 1 ? "en" : ""}`}
        </span>
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-bold transition"
        >
          <Archive size={13} />
          {showArchived ? "Aktive anzeigen" : "Archiv anzeigen"}
          {showArchived ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* Topic list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Laden…</span>
        </div>
      ) : activeTopics.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <MessageSquare size={32} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground">
            {showArchived ? "Keine archivierten Themen." : "Keine aktiven Themen."}
          </p>
          {!showArchived && hasSupervisor && activeSection === "mine" && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1a3826] text-[#FFC72C] text-xs font-black hover:bg-[#142d1f] transition"
            >
              <Plus size={13} /> Erstes Thema erstellen
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activeTopics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              viewAs={viewAs}
              isArchived={showArchived}
              onOpen={() => setSelectedTopic({ topic, viewAs })}
              onArchive={() => handleArchive(topic.id)}
              onUnarchive={() => handleUnarchive(topic.id)}
            />
          ))}
        </div>
      )}

      {/* Supervisor display (if mine) */}
      {activeSection === "mine" && supervisorName && !showArchived && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1a3826] to-[#0f2218] flex items-center justify-center text-[#FFC72C] text-[10px] font-black shrink-0 overflow-hidden">
            {supervisorImage ? <img src={supervisorImage} alt="" className="w-full h-full object-cover" /> : initials(supervisorName)}
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">{supervisorName}</p>
            <p className="text-[10px] text-muted-foreground">Dein direkter Vorgesetzter</p>
          </div>
          <Users size={14} className="ml-auto text-muted-foreground shrink-0" />
        </div>
      )}

      {/* Modals */}
      {createOpen && (
        <CreateModal
          supervisorName={supervisorName}
          onClose={() => setCreateOpen(false)}
          onCreated={(t) => {
            setMyTopics((prev) => [t, ...prev]);
          }}
        />
      )}

      {selectedTopic && (
        <TopicDetailModal
          topic={selectedTopic.topic}
          viewAs={selectedTopic.viewAs}
          onClose={() => setSelectedTopic(null)}
          onUpdated={() => {
            setSelectedTopic(null);
            loadTopics();
          }}
        />
      )}
    </div>
  );
}
