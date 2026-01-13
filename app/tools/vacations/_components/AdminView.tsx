"use client";

import { useState, useMemo } from "react";
import {
  updateVacationStatus,
  addBlockedDay,
  removeBlockedDay,
} from "@/app/actions/vacationActions";
import {
  Check,
  X,
  Trash2,
  Calendar,
  Download,
  Search,
  Filter,
  Users,
  Clock,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- TIPOVI ---
type TabType = "STATS" | "REQUESTS" | "BLOCKED";

interface BlockedDay {
  id: string;
  date: string;
  reason: string | null;
}

interface UserStat {
  id: string;
  name: string | null;
  restaurantNames: string[];
  department: string | null;
  total: number;
  used: number;
  remaining: number;
}

interface RequestWithUser {
  id: string;
  start: string;
  end: string;
  days: number;
  status: string;
  user: {
    name: string | null;
    email: string | null;
    mainRestaurant: string;
  };
}

interface AdminViewProps {
  allRequests: RequestWithUser[];
  blockedDays: BlockedDay[];
  usersStats: UserStat[];
}

export default function AdminView({
  allRequests,
  blockedDays,
  usersStats,
}: AdminViewProps) {
  // FIX: Eksplicitno definisan tip za tabove
  const [activeTab, setActiveTab] = useState<TabType>("STATS");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [restaurantFilter, setRestaurantFilter] = useState("ALL");

  // State za praznike
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [newBlockedReason, setNewBlockedReason] = useState("");

  // --- LOGIKA FILTRIRANJA ---
  const uniqueRestaurants = useMemo(() => {
    const rests = new Set<string>();
    usersStats.forEach((u) =>
      u.restaurantNames.forEach((r) => rests.add(r))
    );
    return Array.from(rests).sort();
  }, [usersStats]);

  const filteredStats = useMemo(() => {
    return usersStats.filter((u) => {
      const matchesSearch = u.name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesRest =
        restaurantFilter === "ALL" ||
        u.restaurantNames.includes(restaurantFilter);
      return matchesSearch && matchesRest;
    });
  }, [usersStats, searchQuery, restaurantFilter]);

  const filteredRequests = useMemo(() => {
    return allRequests.filter((req) => {
      const matchesSearch = req.user.name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());
      // Za zahtjeve filtriramo po glavnom restoranu radi jednostavnosti
      const matchesRest =
        restaurantFilter === "ALL" ||
        req.user.mainRestaurant === restaurantFilter;
      return matchesSearch && matchesRest;
    });
  }, [allRequests, searchQuery, restaurantFilter]);

  // --- AKCIJE ---
  const handleStatus = async (id: string, status: "APPROVED" | "REJECTED") => {
    if (confirm(`Želite li promijeniti status u ${status}?`)) {
      await updateVacationStatus(id, status);
    }
  };

  const handleAddBlocked = async () => {
    if (!newBlockedDate) return alert("Odaberite datum");
    await addBlockedDay(newBlockedDate, newBlockedReason || "Praznik");
    setNewBlockedDate("");
    setNewBlockedReason("");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Izvještaj: Godišnji Odmori", 14, 22);
    doc.setFontSize(10);
    doc.text(`Datum: ${new Date().toLocaleDateString()}`, 14, 28);

    const tableData = filteredStats.map((u) => [
      u.name || "N/A",
      u.restaurantNames.join(", "),
      u.total,
      u.used,
      u.remaining,
    ]);

    autoTable(doc, {
      head: [["Zaposlenik", "Restorani", "Ukupno", "Iskorišteno", "Preostalo"]],
      body: tableData,
      startY: 35,
      theme: "grid",
      headStyles: { fillColor: [26, 56, 38] }, // McDonald's Dark Green
    });

    doc.save("vacation_report.pdf");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-sans text-slate-900">
      {/* FIX: Zamijenjen proizvoljan px sa Tailwind standardom (ili ostavi custom ako baš želiš) */}
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter mb-2">
              ADMIN <span className="text-[#FFC72C]">GODIŠNJI</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Upravljanje odsustvima i statistika
            </p>
          </div>

          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            {[
              { id: "STATS", label: "STATISTIKA", icon: Users },
              { id: "REQUESTS", label: "ZAHTJEVI", icon: Clock },
              { id: "BLOCKED", label: "PRAZNICI", icon: Calendar },
            ].map((tab) => (
              <button
                key={tab.id}
                // FIX: Cast id u TabType da ESLint ne viče "Unexpected any"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? "bg-[#1a3826] text-white shadow-md"
                    : "text-slate-500 hover:text-[#1a3826] hover:bg-slate-50"
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
                {tab.id === "REQUESTS" &&
                  allRequests.filter((r) => r.status === "PENDING").length >
                    0 && (
                    <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1">
                      {allRequests.filter((r) => r.status === "PENDING").length}
                    </span>
                  )}
              </button>
            ))}
          </div>
        </div>

        {/* TOOLBAR (Samo za Stats i Requests) */}
        {activeTab !== "BLOCKED" && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between items-center gap-4">
            {/* Filteri */}
            <div className="flex items-center gap-2 overflow-x-auto w-full xl:w-auto pb-2 xl:pb-0 scrollbar-hide">
              <Filter size={16} className="text-slate-400 shrink-0" />
              <button
                onClick={() => setRestaurantFilter("ALL")}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-all border ${
                  restaurantFilter === "ALL"
                    ? "bg-[#1a3826] text-white border-[#1a3826]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                Svi Restorani
              </button>
              {uniqueRestaurants.map((r) => (
                <button
                  key={r}
                  onClick={() => setRestaurantFilter(r)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-all border ${
                    restaurantFilter === r
                      ? "bg-[#1a3826] text-white border-[#1a3826]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Search & Export */}
            <div className="flex items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-64">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Traži zaposlenika..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#1a3826] transition-all"
                />
              </div>
              {activeTab === "STATS" && (
                <button
                  onClick={exportPDF}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#FFC72C] hover:bg-[#e0af25] text-[#1a3826] rounded-xl text-xs font-black uppercase shadow-sm transition-all active:scale-95 whitespace-nowrap"
                >
                  <Download size={16} /> PDF
                </button>
              )}
            </div>
          </div>
        )}

        {/* --- CONTENT: STATISTIKA --- */}
        {activeTab === "STATS" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              <div className="col-span-4">Zaposlenik</div>
              <div className="col-span-4">Restorani</div>
              <div className="col-span-4 grid grid-cols-3 text-center">
                <span>Ukupno</span>
                <span className="text-green-600">Iskorišteno</span>
                <span className="text-orange-500">Preostalo</span>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredStats.length > 0 ? (
                filteredStats.map((u) => (
                  <div
                    key={u.id}
                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors group"
                  >
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-sm font-bold shadow-sm">
                        {u.name?.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">
                          {u.name}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase font-medium">
                          {u.department || "Nema odjela"}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-4 flex flex-wrap gap-1">
                      {u.restaurantNames.slice(0, 2).map((r, i) => (
                        <span
                          key={i}
                          className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[9px] font-bold uppercase border border-slate-200"
                        >
                          {r}
                        </span>
                      ))}
                      {u.restaurantNames.length > 2 && (
                        <span className="bg-[#1a3826] text-white px-2 py-1 rounded text-[9px] font-bold uppercase">
                          +{u.restaurantNames.length - 2}
                        </span>
                      )}
                    </div>
                    <div className="col-span-4 grid grid-cols-3 items-center text-center">
                      <span className="text-sm font-bold text-slate-400">
                        {u.total}
                      </span>
                      <span className="text-sm font-bold text-green-700">
                        {u.used}
                      </span>
                      <span className="text-lg font-black text-orange-500">
                        {u.remaining}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center text-slate-400 italic">
                  Nema rezultata pretrage.
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- CONTENT: ZAHTJEVI --- */}
        {activeTab === "REQUESTS" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                <tr>
                  <th className="p-4 pl-6">Radnik</th>
                  <th className="p-4">Datum</th>
                  <th className="p-4 text-center">Dana</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right pr-6">Akcija</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="font-bold text-slate-800">
                        {req.user.name}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase">
                        {req.user.mainRestaurant}
                      </div>
                    </td>
                    <td className="p-4 text-sm font-mono text-slate-600">
                      {req.start} <span className="text-slate-300 mx-1">➜</span>{" "}
                      {req.end}
                    </td>
                    <td className="p-4 text-center font-bold text-slate-700">
                      {req.days}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                          req.status === "APPROVED"
                            ? "bg-green-50 text-green-600 border-green-100"
                            : req.status === "REJECTED"
                            ? "bg-red-50 text-red-600 border-red-100"
                            : "bg-orange-50 text-orange-600 border-orange-100"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      {req.status === "PENDING" && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleStatus(req.id, "APPROVED")}
                            className="bg-green-50 hover:bg-green-100 text-green-600 p-2 rounded-lg transition-colors"
                            title="Odobri"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleStatus(req.id, "REJECTED")}
                            className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-lg transition-colors"
                            title="Odbij"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400 italic">
                      Nema zahtjeva za prikaz.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* --- CONTENT: PRAZNICI --- */}
        {activeTab === "BLOCKED" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Dodaj Praznik */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="text-[#1a3826]" size={20} /> Novi Praznik
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                    Datum
                  </label>
                  <input
                    type="date"
                    value={newBlockedDate}
                    onChange={(e) => setNewBlockedDate(e.target.value)}
                    className="w-full border border-slate-200 p-3 rounded-xl focus:border-[#1a3826] outline-none text-sm font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                    Naziv
                  </label>
                  <input
                    type="text"
                    placeholder="Npr. Nova Godina"
                    value={newBlockedReason}
                    onChange={(e) => setNewBlockedReason(e.target.value)}
                    className="w-full border border-slate-200 p-3 rounded-xl focus:border-[#1a3826] outline-none text-sm font-bold text-slate-700"
                  />
                </div>
                <button
                  onClick={handleAddBlocked}
                  className="w-full bg-[#1a3826] hover:bg-[#142e1e] text-white py-3 rounded-xl font-bold uppercase text-xs transition-colors shadow-md active:scale-95"
                >
                  Dodaj u Kalendar
                </button>
              </div>
            </div>

            {/* Lista Praznika */}
            <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4">
                Kalendar Neradnih Dana
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {blockedDays.map((day) => (
                  <div
                    key={day.id}
                    className="flex justify-between items-center p-4 bg-red-50 border border-red-100 rounded-xl group"
                  >
                    <div>
                      <div className="font-bold text-red-900 text-sm">
                        {day.reason || "Praznik"}
                      </div>
                      <div className="text-xs text-red-500 font-mono mt-1">
                        {new Date(day.date).toLocaleDateString("bs-BA")}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm("Obrisati ovaj praznik?"))
                          removeBlockedDay(day.id);
                      }}
                      className="text-red-300 hover:text-red-600 p-2 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {blockedDays.length === 0 && (
                  <div className="col-span-full text-center py-10 text-slate-400 italic">
                    Nema definisanih praznika.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}