"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { FileText } from "lucide-react";

type Category = {
  id: string;
  name: string;
  description: string | null;
  iconName: string | null;
  _count?: { templates: number };
};

function getIconComponent(iconName: string | null) {
  if (!iconName) return FileText;
  const Icon = (Icons as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[iconName];
  return Icon || FileText;
}

export default function VorlagenCategoriesClient({ categories }: { categories: Category[] }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10">
        <div className="border-b border-border pb-6 mb-8">
          <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
            VORLAGEN
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Offizielle Dokumente und Formulare zum Herunterladen
          </p>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-2xl md:rounded-3xl border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-emerald-50/40 via-card to-[#1a3826]/5 dark:from-[#1a3826]/10 dark:via-card dark:to-[#1a3826]/5 shadow-lg p-10 md:p-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-[#1a3826]/8 dark:bg-[#FFC72C]/12 flex items-center justify-center mx-auto mb-5">
              <FileText size={30} className="text-[#1a3826] dark:text-[#FFC72C]" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Keine Kategorien</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Bitte wenden Sie sich an Ihren Administrator.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {categories.map((cat, index) => {
              const Icon = getIconComponent(cat.iconName);
              return (
                <motion.article
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <Link
                    href={`/tools/vorlagen/${cat.id}`}
                    className="group block rounded-2xl md:rounded-3xl overflow-hidden h-full min-h-[200px] border border-[#1a3826]/10 dark:border-[#FFC72C]/20 bg-gradient-to-br from-white via-emerald-50/20 to-[#1a3826]/5 dark:from-card dark:via-[#1a3826]/5 dark:to-[#1a3826]/10 shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-[#1a3826]/25 dark:hover:border-[#FFC72C]/40 transition-all duration-300 p-6 flex flex-col"
                  >
                    <div className="h-16 w-16 rounded-2xl bg-[#1a3826] dark:bg-[#FFC72C] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Icon size={32} className="text-[#FFC72C] dark:text-[#1a3826]" />
                    </div>
                    <h2 className="text-lg md:text-xl font-black text-[#1a3826] dark:text-[#FFC72C] leading-tight mb-2">
                      {cat.name}
                    </h2>
                    {cat.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                        {cat.description}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {cat._count?.templates || 0} Vorlage(n)
                      </span>
                      <span className="text-xs font-bold text-[#FFC72C] opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-200 flex items-center gap-1">
                        Öffnen
                        <Icons.ChevronRight size={14} />
                      </span>
                    </div>
                  </Link>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
