/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState } from "react";
import {
  BookOpen,
  Search,
  CheckCircle2,
  ChevronRight,
  Image as ImageIcon,
  AlertTriangle,
  Calendar,
  SlidersHorizontal,
  Sparkles,
  Dot,
} from "lucide-react";
import Link from "next/link";

interface UserViewProps {
  initialRules: any[];
  categories: any[];
  userId: string;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const priorityMeta = (p: string) => {
  if (p === "URGENT")
    return {
      label: "HITNO",
      chip: "bg-red-50 text-red-700 border-red-200",
      dot: "bg-red-500",
      ring: "ring-red-200",
    };
  if (p === "MANDATORY")
    return {
      label: "OBAVEZNO",
      chip: "bg-[#FFC72C]/20 text-[#1a3826] border-[#FFC72C]/40",
      dot: "bg-[#FFC72C]",
      ring: "ring-[#FFC72C]/40",
    };
  return {
    label: "INFO",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    ring: "ring-blue-200",
  };
};

export default function UserView({ initialRules, categories }: UserViewProps) {
  const [rules] = useState(initialRules);
  const [activeCategory, setActiveCategory] = useState("SVE");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      const matchesCat = activeCategory === "SVE" || r.categoryId === activeCategory;
      const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [rules, activeCategory, searchQuery]);

  const activeCatName =
    activeCategory === "SVE"
      ? "Sve kategorije"
      : categories.find((c) => c.id === activeCategory)?.name || "Kategorija";

  const unreadCount = useMemo(() => filteredRules.filter((r) => !r.isRead).length, [filteredRules]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-24">
      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 md:px-10 py-6">
          <div className="flex flex-col lg:flex-row gap-5 lg:items-end lg:justify-between">
            {/* Left: Brand */}
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-[#1a3826] text-white flex items-center justify-center shadow-lg shadow-[#1a3826]/20">
                <BookOpen size={22} />
              </div>

              <div className="space-y-1">
                <h1 className="text-3xl md:text-4xl font-black text-[#1a3826] uppercase tracking-tighter">
                  Pravila <span className="text-[#FFC72C]">&</span> Procedure
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <Sparkles size={16} className="text-[#1a3826]" />
                    McDonald&apos;s Interni Sistem
                  </span>
                  <span className="hidden sm:inline text-slate-300">•</span>
                  <span className="inline-flex items-center gap-2">
                    <SlidersHorizontal size={16} className="text-slate-400" />
                    {activeCatName}
                  </span>
                  {unreadCount > 0 && (
                    <>
                      <span className="hidden sm:inline text-slate-300">•</span>
                      <span className="inline-flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </span>
                        <span className="font-bold text-slate-600">{unreadCount} nepročitano</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Search */}
            <div className="w-full lg:w-[520px]">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                <Search size={18} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Pretraži po naslovu…"
                  className="w-full bg-transparent outline-none text-base font-bold text-slate-700 placeholder:text-slate-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-xs font-black uppercase px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="mt-2 text-xs font-medium text-slate-500">
                Tip: traži “HACCP”, “Safety”, “Shift”, “Opening”, itd.
              </div>
            </div>
          </div>

          {/* CATEGORIES */}
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveCategory("SVE")}
              className={cn(
                "px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border",
                activeCategory === "SVE"
                  ? "bg-[#1a3826] border-[#1a3826] text-white shadow-md"
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              SVE
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border whitespace-nowrap",
                  activeCategory === cat.id
                    ? "bg-[#1a3826] border-[#1a3826] text-white shadow-md"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 pt-10">
        {/* Empty state */}
        {filteredRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-300">
            <div className="bg-slate-100 p-8 rounded-full mb-5 border border-slate-200">
              <AlertTriangle size={44} className="opacity-40" />
            </div>
            <p className="font-black text-xl text-slate-400">Nema pravila za prikaz.</p>
            <p className="text-sm font-medium text-slate-400 mt-2">
              Pokušaj promijeniti kategoriju ili upisati drugi pojam.
            </p>
          </div>
        ) : (
          <>
            {/* Top helper row */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
              <div className="text-sm font-medium text-slate-600">
                Prikazano:{" "}
                <span className="font-black text-slate-800">{filteredRules.length}</span>{" "}
                {filteredRules.length === 1 ? "pravilo" : "pravila"}
                {activeCategory !== "SVE" && (
                  <span className="ml-2 inline-flex items-center gap-1 text-slate-500">
                    <Dot className="text-slate-300" />
                    <span className="font-bold">{activeCatName}</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black uppercase text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" /> Info
                  </span>
                </span>
                <span className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black uppercase text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#FFC72C]" /> Obavezno
                  </span>
                </span>
                <span className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black uppercase text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500" /> Hitno
                  </span>
                </span>
              </div>
            </div>

            {/* GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {filteredRules.map((rule) => {
                const pr = priorityMeta(rule.priority);

                return (
                  <Link
                    href={`/tools/rules/${rule.id}`}
                    key={rule.id}
                    className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 overflow-hidden flex flex-col"
                  >
                    {/* Top strip */}
                    <div className="h-1 w-full bg-gradient-to-r from-[#1a3826] via-[#1a3826] to-[#FFC72C]" />

                    <div className="p-5 flex flex-col h-full">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3">
                        <span className={cn("px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border", pr.chip)}>
                          <span className={cn("inline-block h-2 w-2 rounded-full mr-2 align-middle", pr.dot)} />
                          {pr.label}
                        </span>

                        {rule.isRead ? (
                          <div className="flex items-center gap-2">
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-emerald-600 inline-flex items-center gap-2">
                              <CheckCircle2 size={14} />
                              Pročitano
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-[10px] font-black uppercase text-red-600">
                            Novo
                          </div>
                        )}
                      </div>

                      {/* Cover */}
                      {rule.images && rule.images.length > 0 ? (
                        <div className={cn("mt-4 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 relative", pr.ring, "ring-0 group-hover:ring-4 transition-all")}>
                          <div className="h-44 w-full relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={rule.images[0].url}
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                              alt="Cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-70"></div>

                            <div className="absolute bottom-3 left-3 bg-black/55 backdrop-blur-md text-white px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase inline-flex items-center gap-1.5">
                              <ImageIcon size={12} />
                              {rule.images.length} slika
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bez covera</div>
                              <div className="text-sm font-bold text-slate-600 mt-1">Ovo pravilo nema sliku.</div>
                            </div>
                            <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                              <ImageIcon size={18} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Title */}
                      <h3 className="mt-4 text-xl font-black text-slate-900 leading-snug group-hover:text-[#1a3826] transition-colors line-clamp-2">
                        {rule.title}
                      </h3>

                      {/* Footer */}
                      <div className="mt-auto pt-5 flex items-center justify-between border-t border-slate-200">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">
                            {rule.category?.name}
                          </div>
                          <div className="mt-1 text-xs font-medium text-slate-500 flex items-center gap-2">
                            <Calendar size={14} className="text-slate-400" />
                            <span className="font-mono">
                              {new Date(rule.createdAt).toLocaleDateString("bs-BA")}
                            </span>
                          </div>
                        </div>

                        <div className="h-11 w-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#1a3826] group-hover:bg-[#1a3826] group-hover:text-white group-hover:border-[#1a3826] transition-all">
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
