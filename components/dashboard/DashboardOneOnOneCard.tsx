"use client";

import { useState } from "react";
import {
  MessageSquare,
  Plus,
  Inbox,
  CalendarDays,
  ChevronRight,
  AlertTriangle,
  X,
} from "lucide-react";
import type { OneOnOneTopicRow } from "@/app/actions/oneOnOneActions";
import OneOnOneTab from "@/app/profile/_components/OneOnOneTab";

const GOD_ROLES = new Set(["SYSTEM_ARCHITECT", "ADMIN"]);

type Props = {
  userId: string;
  userRole: string;
  myOpenCount: number;
  inboxCount: number;
  recentTopics: OneOnOneTopicRow[];
  nextMeeting: OneOnOneTopicRow | null;
  hasSupervisor: boolean;
  supervisorName: string | null;
  supervisorImage: string | null;
  hasSubordinates: boolean;
};

function fmtShortDate(d: Date | string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" });
}

function fmtMeetingTime(d: Date | string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return (
    dt.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" }) +
    " " +
    dt.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })
  );
}

// ─── Full-screen modal wrapping OneOnOneTab ───────────────────────────────────

function OneOnOneModal({
  userId,
  userRole,
  hasSupervisor,
  supervisorName,
  supervisorImage,
  hasSubordinates,
  initialOpenTopicId,
  onClose,
}: {
  userId: string;
  userRole: string;
  hasSupervisor: boolean;
  supervisorName: string | null;
  supervisorImage: string | null;
  hasSubordinates: boolean;
  initialOpenTopicId?: string | null;
  onClose: () => void;
}) {
  const isGod = GOD_ROLES.has(userRole);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background rounded-2xl shadow-2xl border border-border w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1a3826] shrink-0">
          <div className="flex items-center gap-2.5">
            <MessageSquare size={18} className="text-[#FFC72C]" />
            <span className="text-sm font-black text-white tracking-wide">Gesprächsthemen</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          <OneOnOneTab
            userId={userId}
            hasSupervisor={hasSupervisor || isGod}
            supervisorName={supervisorName}
            supervisorImage={supervisorImage}
            hasSubordinates={hasSubordinates || isGod}
            initialOpenTopicId={initialOpenTopicId}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard card ───────────────────────────────────────────────────────────

export default function DashboardOneOnOneCard({
  userId,
  userRole,
  myOpenCount,
  inboxCount,
  recentTopics,
  nextMeeting,
  hasSupervisor,
  supervisorName,
  supervisorImage,
  hasSubordinates,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTopicId, setInitialTopicId] = useState<string | null>(null);

  const isGod = GOD_ROLES.has(userRole);
  const showCreate = hasSupervisor || isGod || hasSubordinates;
  const totalActive = myOpenCount + inboxCount;

  const openModal = (topicId?: string) => {
    setInitialTopicId(topicId ?? null);
    setModalOpen(true);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-xl bg-[#1a3826] flex flex-col h-full shadow-lg">
        {/* Decorative circles */}
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-[#FFC72C]/8 pointer-events-none" />
        <div className="absolute -right-2 bottom-6 w-16 h-16 rounded-full bg-[#FFC72C]/5 pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FFC72C]/15 flex items-center justify-center shrink-0">
              <MessageSquare size={14} className="text-[#FFC72C]" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#FFC72C]/80">
              Gesprächsthemen
            </span>
          </div>
          {showCreate && (
            <button
              type="button"
              onClick={() => openModal()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FFC72C]/15 hover:bg-[#FFC72C]/25 transition text-[#FFC72C] text-[10px] font-black"
            >
              <Plus size={11} /> Neu
            </button>
          )}
        </div>

        {/* Stats row */}
        <div className="relative z-10 px-4 pb-2 flex items-end gap-4 shrink-0">
          <div>
            <p className="text-2xl font-black tabular-nums text-white leading-none">{totalActive}</p>
            <p className="text-[#FFC72C]/60 text-[10px] font-bold mt-0.5">aktive Themen</p>
          </div>
          {inboxCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFC72C]/15 border border-[#FFC72C]/20">
              <Inbox size={11} className="text-[#FFC72C]" />
              <span className="text-[#FFC72C] text-[10px] font-black">{inboxCount} Inbox</span>
            </div>
          )}
        </div>

        {/* Next meeting */}
        {nextMeeting?.meetingStartsAt && (
          <div className="relative z-10 mx-4 mb-2 px-3 py-2 rounded-xl bg-[#FFC72C]/10 border border-[#FFC72C]/20 shrink-0">
            <div className="flex items-center gap-2">
              <CalendarDays size={12} className="text-[#FFC72C] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black text-[#FFC72C]/70 uppercase tracking-wide">Nächster Termin</p>
                <p className="text-[11px] font-black text-white truncate">
                  {fmtMeetingTime(nextMeeting.meetingStartsAt)}
                  {nextMeeting.meetingLocation && (
                    <span className="text-[#FFC72C]/60"> · {nextMeeting.meetingLocation}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recent topics */}
        <div className="relative z-10 flex-1 overflow-hidden px-4 pb-1 flex flex-col gap-1 min-h-0">
          {recentTopics.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[#FFC72C]/40 text-xs text-center font-semibold">
                {hasSupervisor || isGod ? "Noch keine Themen" : "Kein Vorgesetzter zugewiesen"}
              </p>
            </div>
          ) : (
            recentTopics.slice(0, 3).map((t) => {
              const isUrgent = t.isUrgent && t.status === "OPEN";
              const isRequester = t.createdByUser.id === userId;
              const other = isRequester ? t.supervisor : t.createdByUser;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openModal(t.id)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-left shrink-0"
                >
                  <div className="h-6 w-6 rounded-full bg-[#FFC72C]/20 flex items-center justify-center shrink-0 overflow-hidden">
                    {other.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={other.image} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="text-[9px] font-black text-[#FFC72C]">
                        {(other.name || "?").split(" ").map((p: string) => p[0]).join("").toUpperCase().slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black text-white truncate leading-tight">{t.title}</p>
                    <p className="text-[9px] text-[#FFC72C]/50 truncate">
                      {isRequester ? `An: ${other.name ?? other.email}` : `Von: ${other.name ?? other.email}`}
                      {" · "}
                      {fmtShortDate(t.createdAt)}
                    </p>
                  </div>
                  {isUrgent && <AlertTriangle size={11} className="text-red-400 shrink-0" />}
                  {t.meetingStartsAt && <CalendarDays size={11} className="text-[#FFC72C]/60 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Footer CTA */}
        <button
          type="button"
          onClick={() => openModal()}
          className="relative z-10 mx-4 mb-4 mt-2 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#FFC72C]/15 hover:bg-[#FFC72C]/25 transition text-[#FFC72C] text-[11px] font-black shrink-0 border border-[#FFC72C]/20"
        >
          Alle Themen <ChevronRight size={13} />
        </button>
      </div>

      {/* Inline modal — no page navigation */}
      {modalOpen && (
        <OneOnOneModal
          userId={userId}
          userRole={userRole}
          hasSupervisor={hasSupervisor}
          supervisorName={supervisorName}
          supervisorImage={supervisorImage}
          hasSubordinates={hasSubordinates}
          initialOpenTopicId={initialTopicId}
          onClose={() => { setModalOpen(false); setInitialTopicId(null); }}
        />
      )}
    </>
  );
}
