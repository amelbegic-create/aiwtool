"use client";

import { useState } from "react";
import {
  MessageSquare,
  Plus,
  Archive,
  ChevronRight,
  X,
} from "lucide-react";
import type { ConversationRow } from "@/app/actions/conversationActions";
import OneOnOneTab from "@/app/profile/_components/OneOnOneTab";

const GOD_ROLES = new Set(["SYSTEM_ARCHITECT", "ADMIN"]);

type Props = {
  userId: string;
  userRole: string;
  myOpenCount: number;
  inboxCount: number;
  recentConversations: ConversationRow[];
  hasSupervisor: boolean;
  supervisorName: string | null;
  supervisorImage: string | null;
  hasSubordinates: boolean;
};

function fmtShortDate(d: Date | string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" });
}

// ─── Full-screen modal wrapping OneOnOneTab ───────────────────────────────────

function OneOnOneModal({
  userId,
  userRole,
  hasSupervisor,
  supervisorName,
  supervisorImage,
  hasSubordinates,
  onClose,
}: {
  userId: string;
  userRole: string;
  hasSupervisor: boolean;
  supervisorName: string | null;
  supervisorImage: string | null;
  hasSubordinates: boolean;
  onClose: () => void;
}) {
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
            userRole={userRole}
            hasSupervisor={hasSupervisor || GOD_ROLES.has(userRole)}
            supervisorName={supervisorName}
            supervisorImage={supervisorImage}
            hasSubordinates={hasSubordinates || GOD_ROLES.has(userRole)}
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
  recentConversations,
  hasSupervisor,
  supervisorName,
  supervisorImage,
  hasSubordinates,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const isGod = GOD_ROLES.has(userRole);
  const showCreate = hasSupervisor || isGod || hasSubordinates;
  const totalActive = myOpenCount + inboxCount;

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
              onClick={() => setModalOpen(true)}
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
            <p className="text-[#FFC72C]/60 text-[10px] font-bold mt-0.5">aktive Gespräche</p>
          </div>
          {inboxCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFC72C]/15 border border-[#FFC72C]/20">
              <Archive size={11} className="text-[#FFC72C]" />
              <span className="text-[#FFC72C] text-[10px] font-black">{inboxCount} als Vorges.</span>
            </div>
          )}
        </div>

        {/* Recent conversations */}
        <div className="relative z-10 flex-1 overflow-hidden px-4 pb-1 flex flex-col gap-1 min-h-0">
          {recentConversations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[#FFC72C]/40 text-xs text-center font-semibold">
                {hasSupervisor || isGod ? "Noch keine Gespräche" : "Kein Vorgesetzter zugewiesen"}
              </p>
            </div>
          ) : (
            recentConversations.slice(0, 3).map((conv) => {
              const isRequester = conv.requesterUserId === userId;
              const other = isRequester ? conv.supervisor : conv.requester;
              const dashboardTitle = (conv.notes ?? "").trim().split(/\r?\n/)[0]?.trim() || "";
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setModalOpen(true)}
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
                    <p className="text-[11px] font-black text-white truncate leading-tight">
                      {dashboardTitle || (isRequester ? `Mit: ${other.name}` : `Von: ${other.name}`)}
                    </p>
                    <p className="text-[9px] text-[#FFC72C]/50 truncate">
                      {isRequester ? `An: ${other.name ?? other.email}` : `Von: ${other.name ?? other.email}`}
                      {" · "}
                      {fmtShortDate(conv.createdAt)}
                      {conv.items.length > 0 && ` · ${conv.items.length} Thema${conv.items.length !== 1 ? "en" : ""}`}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer CTA */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="relative z-10 mx-4 mb-4 mt-2 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#FFC72C]/15 hover:bg-[#FFC72C]/25 transition text-[#FFC72C] text-[11px] font-black shrink-0 border border-[#FFC72C]/20"
        >
          Alle Gespräche <ChevronRight size={13} />
        </button>
      </div>

      {/* Inline modal */}
      {modalOpen && (
        <OneOnOneModal
          userId={userId}
          userRole={userRole}
          hasSupervisor={hasSupervisor}
          supervisorName={supervisorName}
          supervisorImage={supervisorImage}
          hasSubordinates={hasSubordinates}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
