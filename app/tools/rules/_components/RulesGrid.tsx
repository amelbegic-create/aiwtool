"use client";

import React, { useMemo, useState } from "react";
import {
  BookOpen,
  Search,
  CheckCircle2,
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
      {/* HEADER – Compact: title + search + pills u jednom bloku */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 lg:px-10 py-4 md:py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-[#1a3826] text-[#FFC72C] flex items-center justify-center shrink-0">
                  <BookOpen size={18} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg md:text-xl font-bold text-[#1a3826] tracking-tight truncate">
                    Pravila & Procedure
                  </h1>
                  <p className="text-xs text-slate-500 truncate">
                    {showReadStatus && unreadCount > 0 ? (
                      <span className="font-semibold text-red-600 inline-flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        {unreadCount} nepročitano
                      </span>
                    ) : (
                      "Interni dokumenti i procedure"
                    )}
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-56 md:w-64 flex-shrink-0">
                <div className="bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 flex items-center gap-2 min-h-[36px]">
                  <Search size={16} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Pretraži…"
                    className="w-full bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 transition"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Pills – horizontalno scrollabilne kategorije */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
              <button
                onClick={() => setActiveCategory("SVE")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0",
                  activeCategory === "SVE"
                    ? "bg-[#1a3826] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                SVE
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap shrink-0",
                    activeCategory === cat.id
                      ? "bg-[#1a3826] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SADRŽAJ – Compact grid */}
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 lg:px-10 py-5">
        {filteredRules.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle size={20} className="text-slate-400" />
            </div>
            <h2 className="text-base font-bold text-slate-700">Nema pravila za prikaz</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Promijenite kategoriju ili pretragu.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-slate-500 mb-4">
              <span className="font-semibold text-slate-700">{filteredRules.length}</span>{" "}
              {filteredRules.length === 1 ? "pravilo" : "pravila"}
              {activeCategory !== "SVE" && (
                <span className="ml-1.5">
                  <Dot className="inline w-3 h-3 align-middle" />
                  {activeCatName}
                </span>
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredRules.map((rule) => {
                const pr = priorityMeta(rule.priority);
                const cover = coverUrl(rule);
                return (
                  <Link
                    href={`/tools/rules/${rule.id}`}
                    key={rule.id}
                    className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#1a3826]/30 transition-all overflow-hidden flex flex-col"
                  >
                    {/* Cover – fiksna visina h-32; bez slike = mala ikonica */}
                    <div className="h-32 w-full bg-slate-100 overflow-hidden flex items-center justify-center">
                      {cover ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={cover}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
                          <ImageIcon size={16} className="text-slate-500" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 flex flex-col flex-1 min-w-0">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 w-fit px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border mb-1.5",
                          pr.chip
                        )}
                      >
                        <span className={cn("inline-block h-1 w-1 rounded-full", pr.dot)} />
                        {pr.label}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#1a3826] transition-colors line-clamp-2 leading-snug">
                        {rule.title}
                      </h3>
                      {/* Footer: datum + status u text-xs */}
                      <div className="mt-auto pt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 shrink-0 min-w-0">
                          <Calendar size={12} className="text-slate-400 shrink-0" />
                          {formatDateDDMMGGGG(rule.createdAt)}
                        </span>
                        {showReadStatus &&
                          (rule.isRead ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 shrink-0">
                              <CheckCircle2 size={12} />
                              <span className="font-medium">Pročitano</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 shrink-0 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              Novo
                            </span>
                          ))}
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
