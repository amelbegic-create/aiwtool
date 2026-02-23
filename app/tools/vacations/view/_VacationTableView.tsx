"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import type { UserStat, RequestWithUser, BlockedDay } from "../_components/AdminView";
import {
  exportTablePDFWithData,
  exportTimelinePDFWithData,
} from "../_components/AdminView";

interface Props {
  usersStats: UserStat[];
  allRequests: RequestWithUser[];
  blockedDays?: BlockedDay[];
  selectedYear: number;
  reportRestaurantLabel?: string;
  viewType: "table" | "plan";
  /** Datumi globalnih praznika (ISO) za crvenu liniju u PDF-u */
  globalHolidayDates?: string[];
}

export default function VacationTableView({
  usersStats,
  allRequests,
  blockedDays = [],
  selectedYear,
  reportRestaurantLabel,
  viewType,
  globalHolidayDates = [],
}: Props) {
  const handleTablePDF = () => {
    exportTablePDFWithData(usersStats, selectedYear, reportRestaurantLabel);
  };

  const handlePlanPDF = () => {
    exportTimelinePDFWithData(
      usersStats,
      allRequests,
      blockedDays,
      selectedYear,
      reportRestaurantLabel,
      viewType === "plan" ? `Uebersichtsplan_${selectedYear}.pdf` : undefined,
      globalHolidayDates.length > 0 ? globalHolidayDates : undefined
    );
  };

  const restaurantDisplay = (names: string[]) =>
    names.length > 2 ? "Alle Restaurants" : names.join(", ");

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:p-10 font-sans text-foreground">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter">
              {viewType === "table" ? "Urlaub Tabelle" : "Urlaubsplan"} {selectedYear}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {reportRestaurantLabel || "Urlaubsübersicht"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/tools/vacations?year=${selectedYear}`}
              className="px-4 py-2 rounded-lg text-sm font-bold text-muted-foreground hover:bg-accent"
            >
              Zurück
            </Link>
            <button
              onClick={viewType === "table" ? handleTablePDF : handlePlanPDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1a3826] text-white rounded-lg text-sm font-bold hover:bg-[#142e1e] transition-colors"
            >
              <FileText size={18} /> PDF herunterladen
            </button>
          </div>
        </div>

        {viewType === "table" && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/80 border-b border-border">
                  <tr>
                    <th className="p-4 font-bold text-muted-foreground uppercase">Name</th>
                    <th className="p-4 font-bold text-muted-foreground uppercase">Abteilung</th>
                    <th className="p-4 font-bold text-muted-foreground uppercase">Restaurants</th>
                    <th className="p-4 font-bold text-muted-foreground uppercase text-center">Vortrag</th>
                    <th className="p-4 font-bold text-muted-foreground uppercase text-center">Gesamt</th>
                    <th className="p-4 font-bold text-muted-foreground uppercase text-center">Verbraucht</th>
                    <th className="p-4 font-bold text-muted-foreground uppercase text-center">Resturlaub</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usersStats.map((u) => (
                    <tr key={u.id} className="hover:bg-accent/50">
                      <td className="p-4 font-medium">{u.name || "N/A"}</td>
                      <td className="p-4 text-muted-foreground">{u.department || "N/A"}</td>
                      <td className="p-4 text-muted-foreground">{restaurantDisplay(u.restaurantNames)}</td>
                      <td className="p-4 text-center">{u.carriedOver ?? 0}</td>
                      <td className="p-4 text-center">{u.total}</td>
                      <td className="p-4 text-center text-green-600 font-semibold">{u.used}</td>
                      <td className="p-4 text-center text-orange-500 font-semibold">{u.remaining}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewType === "plan" && (
          <div className="bg-card rounded-xl border border-border p-6">
            <p className="text-muted-foreground mb-4">
              Übersichtsplan mit {usersStats.length} Mitarbeitern. Nutzen Sie „PDF herunterladen“ für den grafischen Plan.
            </p>
            <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
              {usersStats.map((u) => {
                const reqs = allRequests.filter((r) => r.user.id === u.id && r.status === "APPROVED");
                return (
                  <li key={u.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-muted-foreground text-sm">
                      {reqs.length} genehmigte Anträge · {u.used} Tage verbraucht
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
