"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";
import type { UserStat, RequestWithUser } from "../_components/AdminView";
import { exportIndividualReportWithData } from "../_components/AdminView";

function statusLabel(s: string) {
  if (s === "APPROVED") return "Genehmigt";
  if (s === "REJECTED") return "Abgelehnt";
  if (s === "PENDING") return "Ausstehend";
  if (s === "RETURNED") return "Zur Überarbeitung";
  if (s === "CANCEL_PENDING") return "Stornierung ausstehend";
  if (s === "CANCELLED") return "Storniert";
  return s;
}

interface Props {
  user: UserStat;
  allRequests: RequestWithUser[];
  selectedYear: number;
}

export default function VacationReportView({ user, allRequests, selectedYear }: Props) {
  const handlePDF = () => {
    exportIndividualReportWithData(user, allRequests, selectedYear);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:p-10 font-sans text-foreground">
      <div className="max-w-[900px] mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter">
              Urlaubsbericht {selectedYear}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{user.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/tools/vacations?year=${selectedYear}`}
              className="px-4 py-2 rounded-lg text-sm font-bold text-muted-foreground hover:bg-accent"
            >
              Zurück
            </Link>
            <button
              onClick={handlePDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1a3826] text-white rounded-lg text-sm font-bold hover:bg-[#142e1e] transition-colors"
            >
              <FileText size={18} /> PDF herunterladen
            </button>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-muted-foreground uppercase mb-1">Mitarbeiter</h2>
            <p className="text-lg font-bold">{user.name || "N/A"}</p>
            <p className="text-sm text-muted-foreground">{user.email || "N/A"}</p>
            <p className="text-sm text-muted-foreground">Abteilung: {user.department || "N/A"}</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1a3826] rounded-lg p-4 text-center">
              <div className="text-xs font-bold text-white uppercase">Gesamt</div>
              <div className="text-2xl font-bold text-white">{user.total}</div>
            </div>
            <div className="bg-[#1a3826] rounded-lg p-4 text-center">
              <div className="text-xs font-bold text-white uppercase">Verbraucht</div>
              <div className="text-2xl font-bold text-white">{user.used}</div>
            </div>
            <div className="bg-[#1a3826] rounded-lg p-4 text-center">
              <div className="text-xs font-bold text-white uppercase">Resturlaub</div>
              <div className="text-2xl font-bold text-white">{user.remaining}</div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-muted-foreground uppercase mb-3">Anträge</h2>
            {allRequests.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine Anträge für dieses Jahr.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-bold text-muted-foreground">Von</th>
                      <th className="text-left py-2 font-bold text-muted-foreground">Bis</th>
                      <th className="text-center py-2 font-bold text-muted-foreground">Tage</th>
                      <th className="text-left py-2 font-bold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allRequests.map((req) => (
                      <tr key={req.id}>
                        <td className="py-2">{formatDateDDMMGGGG(req.start)}</td>
                        <td className="py-2">{formatDateDDMMGGGG(req.end)}</td>
                        <td className="py-2 text-center">{req.days}</td>
                        <td className="py-2">
                          <span
                            className={
                              req.status === "APPROVED"
                                ? "font-bold text-green-600 dark:text-green-400"
                                : req.status === "REJECTED"
                                  ? "font-bold text-red-600 dark:text-red-400"
                                  : ""
                            }
                          >
                            {statusLabel(req.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
