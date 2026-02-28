"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Users,
  Eye,
  X,
  Mail,
  Calendar,
  Check,
  XCircle,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { getTeamMemberDetail, type TeamMemberRow, type TeamMemberDetail, type TeamMemberRowWithSupervisor } from "@/app/actions/teamActions";
import { updateVacationStatus } from "@/app/actions/vacationActions";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";
import { toast } from "sonner";

function pdsScoreColor(score: number | null): string {
  if (score == null) return "text-slate-400";
  if (score >= 80) return "text-emerald-600 font-bold";
  if (score >= 60) return "text-amber-600 font-bold";
  return "text-red-600 font-bold";
}

export default function TeamPageClient({
  initialTeam,
  treeData,
  currentUserId,
  canLinkToAdminUserEdit = false,
}: {
  initialTeam: TeamMemberRow[];
  treeData: TeamMemberRowWithSupervisor[];
  currentUserId: string;
  canLinkToAdminUserEdit?: boolean;
}) {
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TeamMemberDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<"pregled" | "godisnji" | "pds">("pregled");
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  const openDetail = useCallback(async (userId: string) => {
    setDetailUserId(userId);
    setDetail(null);
    setActiveTab("pregled");
    setLoadingDetail(true);
    try {
      const d = await getTeamMemberDetail(userId);
      setDetail(d);
    } catch {
      toast.error("Fehler beim Laden.");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetailUserId(null);
    setDetail(null);
  }, []);

  const handleVacationStatus = useCallback(
    async (requestId: string, status: "APPROVED" | "REJECTED") => {
      if (!detailUserId) return;
      setUpdatingRequestId(requestId);
      try {
        await updateVacationStatus(requestId, status);
        toast.success(status === "APPROVED" ? "Anfrage genehmigt." : "Anfrage abgelehnt.");
        const d = await getTeamMemberDetail(detailUserId);
        setDetail(d);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Fehler.");
      } finally {
        setUpdatingRequestId(null);
      }
    },
    [detailUserId]
  );

  return (
    <>
      {initialTeam.length === 0 ? (
        <div className="bg-white dark:bg-card rounded-xl md:rounded-2xl border border-slate-200 dark:border-border shadow-sm p-6 sm:p-12 md:p-16 text-center">
          <div className="inline-flex h-20 w-20 rounded-full bg-slate-100 items-center justify-center mb-6">
            <Users size={40} className="text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Keine Mitarbeiter gefunden</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Diese Liste zeigt Mitarbeiter, die Ihnen direkt unterstellt sind. Im Admin-Bereich können Sie die Zuordnung pro Benutzer festlegen.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: Card layout (< 768px) */}
          <div className="md:hidden space-y-3">
            {initialTeam.map((member) => (
              <div
                key={member.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-base font-bold overflow-hidden shrink-0">
                    {member.image ? (
                      <Image src={member.image} alt="" width={48} height={48} className="object-cover" />
                    ) : (
                      (member.name || "?").charAt(0)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {canLinkToAdminUserEdit ? (
                      <Link
                        href={`/admin/users/${member.id}`}
                        className="font-bold text-slate-800 truncate block hover:underline hover:text-[#1a3826]"
                      >
                        {member.name || "—"}
                      </Link>
                    ) : (
                      <div className="font-bold text-slate-800 truncate">{member.name || "—"}</div>
                    )}
                    <span
                      className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-0.5"
                      style={{
                        backgroundColor: member.departmentColor ? `${member.departmentColor}20` : "#f1f5f9",
                        color: member.departmentColor || "#64748b",
                      }}
                    >
                      {member.department || "—"}
                    </span>
                  </div>
                  {member.isOnVacationToday ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold shrink-0">
                      <Calendar size={14} /> Urlaub
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold shrink-0">
                      <Check size={14} /> Aktiv
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-slate-600 mb-3">
                  <span>Urlaub: {member.vacationUsed}/{member.vacationTotal} · Rest: {member.vacationRemaining} Tage</span>
                  {member.lastPdsScore != null && (
                    <span className={pdsScoreColor(member.lastPdsScore)}>
                      PDS {member.lastPdsScore}{member.lastPdsGrade ? ` (${member.lastPdsGrade})` : ""}
                    </span>
                  )}
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full bg-[#1a3826] transition-all"
                    style={{
                      width: `${member.vacationTotal > 0 ? (member.vacationUsed / member.vacationTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => openDetail(member.id)}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[#1a3826] text-white font-bold text-sm hover:bg-[#142e1e] active:scale-[0.98] transition-all touch-manipulation"
                >
                  <Eye size={18} /> Details
                </button>
              </div>
            ))}
          </div>
          {/* Desktop: Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Mitarbeiter</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Urlaub</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Letztes PDS</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {initialTeam.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
                            {member.image ? (
                              <Image src={member.image} alt="" width={40} height={40} className="object-cover" />
                            ) : (
                              (member.name || "?").charAt(0)
                            )}
                          </div>
                          <div>
                            {canLinkToAdminUserEdit ? (
                              <Link
                                href={`/admin/users/${member.id}`}
                                className="font-bold text-slate-800 hover:underline hover:text-[#1a3826]"
                              >
                                {member.name || "—"}
                              </Link>
                            ) : (
                              <div className="font-bold text-slate-800">{member.name || "—"}</div>
                            )}
                            <span
                              className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                              style={{
                                backgroundColor: member.departmentColor ? `${member.departmentColor}20` : "#f1f5f9",
                                color: member.departmentColor || "#64748b",
                              }}
                            >
                              {member.department || "—"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {member.isOnVacationToday ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold">
                            <Calendar size={12} /> Im Urlaub
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                            <Check size={12} /> Aktiv
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#1a3826]"
                                style={{
                                  width: `${member.vacationTotal > 0 ? (member.vacationUsed / member.vacationTotal) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-600">
                              {member.vacationUsed}/{member.vacationTotal} Tage
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">Resturlaub: {member.vacationRemaining} Tage</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {member.lastPdsScore != null ? (
                          <span className={pdsScoreColor(member.lastPdsScore)}>
                            {member.lastPdsScore}
                            {member.lastPdsGrade ? ` (${member.lastPdsGrade})` : ""}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openDetail(member.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#1a3826] hover:text-white text-slate-700 text-xs font-bold transition-colors min-h-[44px]"
                        >
                          <Eye size={14} /> Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Slide-over Sheet: full screen on mobile, panel on desktop */}
      {detailUserId != null && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 transition-opacity"
            onClick={closeDetail}
            aria-hidden
          />
          <div
            className="fixed top-0 right-0 bottom-0 w-full md:max-w-2xl bg-white shadow-2xl z-50 flex flex-col safe-area-t safe-area-b-mobile"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-detail-title"
          >
            <div className="flex items-center justify-between gap-4 p-4 border-b border-slate-200 bg-[#1a3826] min-h-[56px] safe-area-t">
              <h2 id="team-detail-title" className="text-lg font-black text-white truncate flex-1 min-w-0">
                {detail?.name || "Wird geladen…"}
              </h2>
              <button
                type="button"
                onClick={closeDetail}
                className="flex-shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl text-white/80 hover:bg-white/20 active:bg-white/30 transition touch-manipulation"
                aria-label="Schließen"
              >
                <X size={24} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <Loader2 size={32} className="animate-spin text-[#1a3826]" />
              </div>
            ) : detail ? (
              <>
                <div className="flex border-b border-slate-200 bg-slate-50/50">
                  {(["pregled", "godisnji", "pds"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                        activeTab === tab
                          ? "text-[#1a3826] border-b-2 border-[#1a3826] bg-white"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {tab === "pregled" && "Übersicht"}
                      {tab === "godisnji" && "Urlaub"}
                      {tab === "pds" && "PDS-Dossier"}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-8">
                  {activeTab === "pregled" && (
                    <div className="space-y-6">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-24 w-24 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-2xl font-black overflow-hidden shrink-0">
                          {detail.image ? (
                            <Image
                              src={detail.image}
                              alt=""
                              width={96}
                              height={96}
                              className="object-cover"
                            />
                          ) : (
                            (detail.name || "?").charAt(0)
                          )}
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-slate-800">{detail.name}</p>
                          <p className="text-sm text-slate-500 flex items-center justify-center gap-1.5 mt-1">
                            <Mail size={14} /> {detail.email || "—"}
                          </p>
                          {detail.department && (
                            <span
                              className="inline-flex mt-2 px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: detail.departmentColor ? `${detail.departmentColor}25` : "#f1f5f9",
                                color: detail.departmentColor || "#64748b",
                              }}
                            >
                              {detail.department}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Anzahl PDS
                          </p>
                          <p className="text-2xl font-black text-[#1a3826]">{detail.pdsHistory.length}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Urlaub (Rest)
                          </p>
                          <p className="text-2xl font-black text-[#1a3826]">{detail.vacationRemaining} Tage</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "godisnji" && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-medium mb-4">
                        Letzte {detail.vacationRequests.length} Urlaubsanträge
                      </p>
                      {detail.vacationRequests.length === 0 ? (
                        <p className="text-slate-500 text-sm">Keine Anträge.</p>
                      ) : (
                        detail.vacationRequests.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white"
                          >
                            <div>
                              <p className="font-medium text-slate-800">
                                {formatDateDDMMGGGG(req.start)} – {formatDateDDMMGGGG(req.end)}
                              </p>
                              <p className="text-xs text-slate-500">{req.days} Tage</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-1 rounded text-[10px] font-bold ${
                                  req.status === "APPROVED"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : req.status === "REJECTED"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {req.status === "APPROVED"
                                  ? "Genehmigt"
                                  : req.status === "REJECTED"
                                    ? "Abgelehnt"
                                    : "Ausstehend"}
                              </span>
                              {req.status === "PENDING" && (
                                <>
                                  <button
                                    type="button"
                                    disabled={updatingRequestId === req.id}
                                    onClick={() => handleVacationStatus(req.id, "APPROVED")}
                                    className="p-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                                    title="Genehmigen"
                                  >
                                    {updatingRequestId === req.id ? (
                                      <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                      <Check size={16} />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={updatingRequestId === req.id}
                                    onClick={() => handleVacationStatus(req.id, "REJECTED")}
                                    className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                                    title="Ablehnen"
                                  >
                                    <XCircle size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === "pds" && (
                    <div className="space-y-4">
                      {detail.pdsHistory.length === 0 ? (
                        <p className="text-slate-500 text-sm">Keine PDS-Formulare.</p>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {detail.pdsHistory.map((pds) => (
                              <div
                                key={pds.id}
                                className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-lg bg-[#1a3826]/10 flex items-center justify-center">
                                    <ClipboardList size={18} className="text-[#1a3826]" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800">PDS {pds.year}</p>
                                    <p className={`text-sm ${pdsScoreColor(pds.totalScore)}`}>
                                      {pds.totalScore} Punkte
                                      {pds.finalGrade ? ` · ${pds.finalGrade}` : ""}
                                    </p>
                                  </div>
                                </div>
                                <Link
                                  href={`/tools/PDS/${pds.id}`}
                                  className="text-xs font-bold text-[#1a3826] hover:underline"
                                >
                                  PDS öffnen
                                </Link>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-slate-500 mt-4">
                            Bewertungsverlauf:{" "}
                            {detail.pdsHistory.map((p) => `${p.year}: ${p.totalScore}`).join(" → ")}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
                Details können nicht geladen werden.
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
