"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  Award,
  FileText,
  ChevronDown,
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
  const [activeTab, setActiveTab] = useState<"pregled" | "godisnji" | "pds" | "certs">("pregled");
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const [certPreview, setCertPreview] = useState<{
    type: "pdf" | "image";
    url: string;
    name: string;
  } | null>(null);

  // Close dept dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setDeptDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDept = (dept: string) => {
    setSelectedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const clearDepts = () => setSelectedDepts(new Set());

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
      let comment: string | undefined;
      if (status === "REJECTED") {
        const input = window.prompt(
          "Unesite razlog odbijanja (vidi ga radnik u svojim zahtjevima):",
          ""
        );
        if (input === null) return;
        comment = input.trim();
      }
      setUpdatingRequestId(requestId);
      try {
        await updateVacationStatus(requestId, status, comment);
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

  const isOfficeDept = (dept: string | null) =>
    dept ? dept.trim().toUpperCase() === "OFFICE" : false;

  const RestaurantCell = ({ member }: { member: TeamMemberRow }) => {
    if (isOfficeDept(member.department)) {
      return (
        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-500">
          Verwaltung
        </span>
      );
    }
    const rests = member.restaurants ?? [];
    if (rests.length === 0) return <span className="text-slate-400 text-xs">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {rests.slice(0, 2).map((r) => (
          <span key={r.code} className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-[#1a3826]/10 text-[#1a3826]">
            {r.name || r.code}
          </span>
        ))}
        {rests.length > 2 && (
          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
            +{rests.length - 2}
          </span>
        )}
      </div>
    );
  };

  const departmentOptions = Array.from(
    new Set(initialTeam.map((m) => (m.department && m.department.trim() !== "" ? m.department : "")))
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const filteredTeam =
    selectedDepts.size === 0
      ? initialTeam
      : initialTeam.filter((m) => selectedDepts.has((m.department || "").trim()));

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
          {/* Filterleiste */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Result count */}
            <p className="text-xs text-slate-500 font-medium">
              {filteredTeam.length} von {initialTeam.length} Mitarbeiter
              {selectedDepts.size > 0 && (
                <button
                  type="button"
                  onClick={clearDepts}
                  className="ml-2 text-[#1a3826] font-bold hover:underline"
                >
                  Filter löschen
                </button>
              )}
            </p>

            {departmentOptions.length > 0 && (
              <div className="relative" ref={deptDropdownRef}>
                <button
                  type="button"
                  onClick={() => setDeptDropdownOpen((o) => !o)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 font-bold hover:border-[#1a3826] hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1a3826] transition-all min-h-[36px]"
                >
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Abteilung</span>
                  {selectedDepts.size > 0 ? (
                    <span className="flex items-center gap-1.5">
                      {/* Show first 2 selected, then +N */}
                      {Array.from(selectedDepts).slice(0, 2).map((d) => (
                        <span
                          key={d}
                          className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[#1a3826] text-white"
                        >
                          {d}
                        </span>
                      ))}
                      {selectedDepts.size > 2 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-200 text-slate-600">
                          +{selectedDepts.size - 2}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-500 font-medium">Alle</span>
                  )}
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 transition-transform ${deptDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {deptDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-30 overflow-hidden">
                    {/* "Alle" row */}
                    <button
                      type="button"
                      onClick={clearDepts}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold transition-colors hover:bg-slate-50 ${
                        selectedDepts.size === 0 ? "text-[#1a3826]" : "text-slate-500"
                      }`}
                    >
                      <span
                        className={`h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          selectedDepts.size === 0
                            ? "bg-[#1a3826] border-[#1a3826]"
                            : "border-slate-300"
                        }`}
                      >
                        {selectedDepts.size === 0 && <Check size={10} className="text-white" />}
                      </span>
                      Alle
                    </button>

                    <div className="border-t border-slate-100" />

                    {/* Department checkboxes */}
                    {departmentOptions.map((dep) => {
                      const checked = selectedDepts.has(dep);
                      return (
                        <button
                          key={dep}
                          type="button"
                          onClick={() => toggleDept(dep)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-slate-50"
                        >
                          <span
                            className={`h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              checked
                                ? "bg-[#1a3826] border-[#1a3826]"
                                : "border-slate-300"
                            }`}
                          >
                            {checked && <Check size={10} className="text-white" />}
                          </span>
                          <span className={`font-medium ${checked ? "text-[#1a3826] font-bold" : "text-slate-700"}`}>
                            {dep}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile: Card layout (< 768px) */}
          <div className="md:hidden space-y-3">
          {filteredTeam.map((member) => (
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
                    <div className="mt-1">
                      <RestaurantCell member={member} />
                    </div>
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
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Mitarbeiter
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Abteilung
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Restaurant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Urlaub
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-24">
                      Aktion
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTeam.map((member) => (
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
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                          style={{
                            backgroundColor: member.departmentColor ? `${member.departmentColor}20` : "#f1f5f9",
                            color: member.departmentColor || "#64748b",
                          }}
                        >
                          {member.department || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RestaurantCell member={member} />
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
                          {/* Resturlaub-Text entfernt – Info ist bereits in der Detailansicht vorhanden */}
                        </div>
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
                  {(["pregled", "godisnji", "pds", "certs"] as const).map((tab) => (
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
                      {tab === "certs" && "Zertifikate"}
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

                  {activeTab === "certs" && (
                    <div className="space-y-4">
                      {detail.certificates.length === 0 ? (
                        <p className="text-slate-500 text-sm">
                          Keine Zertifikate oder Schulungen hinterlegt.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {detail.certificates.map((cert) => (
                            <div
                              key={cert.id}
                              className="relative rounded-2xl border border-slate-200 bg-white p-4 flex gap-3"
                            >
                              <div className="mt-1">
                                <div className="h-9 w-9 rounded-full bg-[#1a3826]/10 flex items-center justify-center">
                                  <Award size={18} className="text-[#1a3826]" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-slate-900">{cert.title}</p>
                                  <span className="text-[11px] text-slate-500">
                                    {new Date(cert.createdAt).toLocaleDateString("de-DE", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                    })}
                                  </span>
                                  {cert.pdfUrl && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-semibold">
                                      <FileText size={12} />
                                      PDF
                                    </span>
                                  )}
                                </div>
                                {cert.description && (
                                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                                    {cert.description}
                                  </p>
                                )}
                                <div className="mt-1 flex flex-wrap items-center gap-3">
                                  {cert.pdfUrl && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCertPreview({
                                          type: "pdf",
                                          url: cert.pdfUrl!,
                                          name: cert.pdfName || cert.title,
                                        })
                                      }
                                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a3826] hover:underline"
                                    >
                                      <FileText size={14} />
                                      {cert.pdfName || "PDF öffnen"}
                                    </button>
                                  )}
                                  {cert.imageUrl && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCertPreview({
                                          type: "image",
                                          url: cert.imageUrl!,
                                          name: cert.imageName || cert.title,
                                        })
                                      }
                                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a3826] hover:underline"
                                    >
                                      <FileText size={14} />
                                      {cert.imageName || "Bild öffnen"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-slate-400">
                        Dieser Bereich zeigt Zertifikate, Kurse und Schulungen, die im Admin‑Bereich
                        hinterlegt wurden.
                      </p>
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
      {certPreview && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {certPreview.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {certPreview.type === "pdf" ? "PDF-Vorschau" : "Bildvorschau"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCertPreview(null)}
                className="ml-3 inline-flex items-center justify-center h-9 w-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Schließen"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 bg-slate-50 flex items-center justify-center">
              {certPreview.type === "pdf" ? (
                <iframe
                  src={certPreview.url}
                  title={certPreview.name}
                  className="w-full h-[70vh] border-0 bg-white"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={certPreview.url}
                  alt={certPreview.name}
                  className="max-h-[70vh] max-w-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
