"use client";

import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight, FileText, Download, X } from "lucide-react";
import type { DashboardNewsPublic } from "@/app/actions/dashboardNewsActions";
import { DashboardNewsAttachmentKind } from "@prisma/client";

const AUTO_SCROLL_INTERVAL_MS = 5000;
const SCROLL_AMOUNT = 396;

type Props = {
  title?: string;
  items: DashboardNewsPublic[];
};

export default function DashboardNewsSlider({ title = "News & Meldungen", items }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const openItem = items.find((i) => i.id === openId) ?? null;

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  };

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: "smooth" });
    setTimeout(updateScrollState, 350);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || items.length === 0) return;
    const id = setInterval(() => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const maxScroll = scrollWidth - clientWidth - 8;
      if (maxScroll <= 0) return;
      if (scrollLeft >= maxScroll) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: SCROLL_AMOUNT, behavior: "smooth" });
      }
      setTimeout(updateScrollState, 350);
    }, AUTO_SCROLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-foreground uppercase tracking-tight">{title}</h3>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Keine News-Meldungen.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-foreground uppercase tracking-tight">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              className="h-10 w-10 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent hover:border-[#1a3826]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              aria-label="Scroll nach links"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              className="h-10 w-10 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent hover:border-[#1a3826]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              aria-label="Scroll nach rechts"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="slider-track flex gap-3 overflow-x-auto pb-2 pr-3 md:pr-6 scroll-smooth"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              style={{ scrollSnapAlign: "start", flexShrink: 0 }}
              className="w-[260px] sm:w-[300px] md:w-[340px]"
            >
              <button
                type="button"
                onClick={() => setOpenId(item.id)}
                className="group relative h-[180px] md:h-[190px] w-full rounded-3xl overflow-hidden cursor-pointer bg-gradient-to-br from-slate-900 to-slate-800 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl ring-1 ring-black/5 text-left"
              >
                {item.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.coverImageUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
                <div className="absolute inset-0 flex flex-col justify-end p-5">
                  <p className="text-white font-black text-lg leading-tight drop-shadow-md line-clamp-2">
                    {item.title}
                  </p>
                  {item.subtitle && (
                    <p className="text-white/80 text-sm font-medium mt-1 line-clamp-1">{item.subtitle}</p>
                  )}
                  <div className="mt-3 flex items-center gap-1.5 text-[#FFC72C] text-sm font-bold opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200">
                    Mehr anzeigen <ArrowRight size={14} />
                  </div>
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal – brand header #1a3826 / #FFC72C */}
      {openItem && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenId(null);
          }}
        >
          <div className="relative flex h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#1a3826] px-5 py-3">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[#FFC72C]" />
                <span className="text-sm font-black uppercase tracking-wider text-[#FFC72C]">
                  Dokument anzeigen
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={openItem.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFC72C] px-3 py-1.5 text-xs font-black text-[#1a3826] transition hover:opacity-90"
                >
                  <Download size={13} /> Herunterladen
                </a>
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="rounded-lg p-1.5 text-[#FFC72C] transition hover:bg-white/10"
                  aria-label="Schließen"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-muted">
              {openItem.attachmentKind === DashboardNewsAttachmentKind.PDF ? (
                <iframe
                  src={openItem.attachmentUrl}
                  className="h-full w-full border-0"
                  title={openItem.title}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center overflow-auto p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- GIF animation + blob/remote URLs */}
                  <img
                    src={openItem.attachmentUrl}
                    alt={openItem.title}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
