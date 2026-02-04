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
  Dot,
} from "lucide-react";
import Link from "next/link";
import { formatDateDDMMGGGG } from "@/lib/dateUtils";

interface RulesGridProps {
  initialRules: Array<{
    id: string;
    title: string;
    categoryId: string;
    category?: { name: string } | null;
    priority: string;
    imageUrl?: string | null;
    images?: Array<{ url: string }>;
    createdAt: string | Date;
    isRead?: boolean;
  }>;
  categories: Array<{ id: string; name: string }>;
  showReadStatus?: boolean;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function priorityMeta(p: string) {
  if (p === "URGENT")
    return {
      label: "HITNO",
      chip: "bg-red-50 text-red-700 border-red-200",
      dot: "bg-red-500",
    };
  if (p === "MANDATORY")
    return {
      label: "OBAVEZNO",
      chip: "bg-[#FFC72C]/20 text-[#1a3826] border-[#FFC72C]/40",
      dot: "bg-[#FFC72C]",
    };
  return {
    label: "INFO",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  };
}

export default function RulesGrid({
  initialRules,
  categories,
  showReadStatus = true,
}: RulesGridProps) {
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

  const unreadCount = useMemo(
    () => (showReadStatus ? filteredRules.filter((r) => !r.isRead).length : 0),
    [filteredRules, showReadStatus]
  );

  const coverUrl = (r: (typeof rules)[0]) =>
    r.imageUrl || (r.images && r.images.length > 0 ? r.images[0].url : null);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900 pb-24">
      {/* HEADER – u stilu tools/categories i dashboarda */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 lg:px-10 py-6 md:py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-[#1a3826] text-[#FFC72C] flex items-center justify-center shadow border border-[#1a3826]/20">
                  <BookOpen size={20} strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    SISTEMSKI MODULI / PRAVILA
                  </p>
                  <h1 className="text-2xl md:text-3xl font-black text-[#1a3826] uppercase tracking-tight mt-1">
                    Pravila & Procedure
                  </h1>
                  <p className="text-sm font-semibold text-slate-500 mt-1">
                    Interni dokumenti i procedure za sve zaposlenike
                  </p>
                  {showReadStatus && unreadCount > 0 && (
                    <p className="mt-2 text-xs font-bold text-red-600 inline-flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                      </span>
                      {unreadCount} nepročitano
                    </p>
                  )}
                </div>
              </div>
              <div className="w-full sm:w-[320px] md:w-[380px]">
                <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-2.5 flex items-center gap-3 min-h-[44px]">
                  <Search size={18} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Pretraži po naslovu…"
                    className="w-full bg-transparent outline-none text-sm font-semibold text-slate-700 placeholder:text-slate-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 transition"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Filter po kategoriji */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Filter po kategoriji</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => setActiveCategory("SVE")}
                  className={cn(
                    "px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border shrink-0",
                    activeCategory === "SVE"
                      ? "bg-[#1a3826] border-[#1a3826] text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  SVE
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap shrink-0",
                      activeCategory === cat.id
                        ? "bg-[#1a3826] border-[#1a3826] text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SADRŽAJ */}
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 lg:px-10 py-8">
        {filteredRules.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
            <div className="h-12 w-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} className="text-slate-400" />
            </div>
            <h2 className="text-lg font-black text-slate-700">Nema pravila za prikaz</h2>
            <p className="text-sm font-semibold text-slate-500 mt-2 max-w-sm mx-auto">
              Pokušajte promijeniti kategoriju ili upisati drugi pojam u pretragu.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm font-semibold text-slate-600">
                Prikazano: <span className="font-black text-slate-800">{filteredRules.length}</span>{" "}
                {filteredRules.length === 1 ? "pravilo" : "pravila"}
                {activeCategory !== "SVE" && (
                  <span className="ml-2 text-slate-500">
                    <Dot className="inline w-4 h-4 align-middle" />
                    <span className="font-bold">{activeCatName}</span>
                  </span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRules.map((rule) => {
                const pr = priorityMeta(rule.priority);
                const cover = coverUrl(rule);
                return (
                  <Link
                    href={`/tools/rules/${rule.id}`}
                    key={rule.id}
                    className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col"
                  >
                    <div className="h-0.5 w-full bg-gradient-to-r from-[#1a3826] to-[#FFC72C]" />
                    <div className="aspect-[4/3] w-full bg-slate-100 border-b border-slate-100 overflow-hidden">
                      {cover ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={cover}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={20} className="text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1.5 mb-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border shrink-0",
                            pr.chip
                          )}
                        >
                          <span className={cn("inline-block h-1 w-1 rounded-full mr-1 align-middle", pr.dot)} />
                          {pr.label}
                        </span>
                        {showReadStatus &&
                          (rule.isRead ? (
                            <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-700 shrink-0">
                              <CheckCircle2 size={10} />
                              Pročitano
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[9px] font-bold uppercase text-red-600 shrink-0">
                              <span className="relative flex h-1 w-1 rounded-full bg-red-500" />
                              Novo
                            </span>
                          ))}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#1a3826] transition-colors line-clamp-2 leading-snug">
                        {rule.title}
                      </h3>
                      <div className="mt-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                        {rule.category?.name}
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-500 flex items-center gap-1">
                        <Calendar size={10} className="text-slate-400 shrink-0" />
                        {formatDateDDMMGGGG(rule.createdAt)}
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a3826]">Otvori</span>
                        <div className="h-6 w-6 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-[#1a3826] group-hover:text-[#FFC72C] group-hover:border-[#1a3826] transition-all">
                          <ChevronRight size={12} />
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
