"use client";

import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight, X } from "lucide-react";
import type { DashboardEventPublic } from "@/app/actions/dashboardEventActions";
import { recordDashboardEventView } from "@/app/actions/dashboardEventActions";

const AUTO_SCROLL_INTERVAL_MS = 5000;
const SCROLL_AMOUNT = 396;

type Props = {
  title?: string;
  items: DashboardEventPublic[];
  initialOpenId?: string | null;
};

export default function EventSlider({
  title = "Events & Highlights",
  items,
  initialOpenId,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const recordedRef = useRef<Set<string>>(new Set());

  const openItem = items.find((i) => i.id === openItemId) ?? null;
  const gallery = openItem?.images ?? [];
  const media = openItem
    ? [
        ...(openItem.videoUrl ? [{ kind: "video" as const, url: openItem.videoUrl }] : []),
        ...gallery.map((img) => ({ kind: "image" as const, url: img.imageUrl })),
      ]
    : [];

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

  useEffect(() => {
    if (!media.length) return;
    const max = Math.max(0, media.length - 1);
    if (activeMediaIndex > max) setActiveMediaIndex(0);
  }, [media.length, activeMediaIndex]);

  // Ako dođeš preko notifikacije, otvori odgovarajući popup.
  useEffect(() => {
    if (!initialOpenId) return;
    if (openItemId) return;
    const exists = items.some((x) => x.id === initialOpenId);
    if (!exists) return;
    setOpenItemId(initialOpenId);
    setActiveMediaIndex(0);
  }, [initialOpenId, items, openItemId]);

  // Aktivnost: zabilježi da je korisnik otvorio popup.
  useEffect(() => {
    if (!openItemId) return;
    if (recordedRef.current.has(openItemId)) return;
    recordedRef.current.add(openItemId);
    void recordDashboardEventView(openItemId);
  }, [openItemId]);

  function openGallery(itemId: string) {
    setOpenItemId(itemId);
    setActiveMediaIndex(0);
  }

  function nextMedia() {
    if (!media.length) return;
    setActiveMediaIndex((i) => (i + 1) % media.length);
  }

  function prevMedia() {
    if (!media.length) return;
    setActiveMediaIndex((i) => (i - 1 + media.length) % media.length);
  }

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h3 className="text-lg font-black text-foreground uppercase tracking-tight">{title}</h3>
            <span className="text-xs font-black uppercase tracking-wide text-[#FFC72C]">
              ({items.length})
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Keine Events.
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
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              className="h-10 w-10 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent hover:border-[#1a3826]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              aria-label="Scroll nach links"
            >
              <ChevronLeft size={18} />
            </button>
            <button
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
                onClick={() => openGallery(item.id)}
                className="group relative h-[180px] md:h-[190px] w-full rounded-3xl overflow-hidden cursor-pointer bg-gradient-to-br from-slate-900 to-slate-800 hover:-translate-y-1 transition-all duration-300 shadow-lg hover:shadow-xl ring-1 ring-black/5 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.coverImageUrl}
                  alt={item.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
                <div className="absolute inset-0 flex flex-col justify-end p-5">
                  <p className="text-white font-black text-lg leading-tight drop-shadow-md line-clamp-2">
                    {item.title}
                  </p>
                  {item.subtitle && (
                    <p className="text-white/80 text-sm font-medium mt-1 line-clamp-1">
                      {item.subtitle}
                    </p>
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

      {openItem && media.length > 0 && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenItemId(null);
          }}
        >
          <div className="relative flex h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
            <div className="flex items-center justify-between bg-[#1a3826] px-4 py-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#FFC72C]">Event Galerie</p>
                <p className="text-xs text-white/80">{openItem.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenItemId(null)}
                className="rounded-lg p-1.5 text-[#FFC72C] transition hover:bg-white/10"
                aria-label="Schließen"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
              <button
                type="button"
                onClick={prevMedia}
                className="absolute left-3 z-10 h-10 w-10 rounded-full bg-black/45 text-white hover:bg-black/65"
                aria-label="Vorheriges Bild"
              >
                <ChevronLeft className="mx-auto" size={20} />
              </button>

              {media[activeMediaIndex]?.kind === "video" ? (
                <video
                  src={media[activeMediaIndex]?.url}
                  controls
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media[activeMediaIndex]?.url}
                  alt={openItem.title}
                  className="max-h-full max-w-full object-contain"
                />
              )}

              <button
                type="button"
                onClick={nextMedia}
                className="absolute right-3 z-10 h-10 w-10 rounded-full bg-black/45 text-white hover:bg-black/65"
                aria-label="Nächstes Bild"
              >
                <ChevronRight className="mx-auto" size={20} />
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
              <span>{openItem.subtitle || "Galerie"}</span>
              <span className="font-bold">
                {activeMediaIndex + 1} / {media.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

