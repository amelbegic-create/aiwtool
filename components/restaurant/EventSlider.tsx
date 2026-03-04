"use client";

import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

const AUTO_SCROLL_INTERVAL_MS = 5000;
const SCROLL_AMOUNT = 396;

type SliderItem = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  gradient: string;
  href?: string;
};

const PLACEHOLDER_ITEMS: SliderItem[] = [
  {
    id: "teambuilding-2026",
    title: "Teambuilding",
    subtitle: "März 2026",
    imageUrl: "/images/teambuilding-event.jpg",
    gradient: "from-slate-900 to-slate-800",
  },
  {
    id: "umbau-2025",
    title: "Restaurant Umbau",
    subtitle: "2025",
    imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=560&q=80",
    gradient: "from-slate-900 to-slate-800",
  },
  {
    id: "crew-challenge",
    title: "Crew Challenge",
    subtitle: "Winter Cup",
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=560&q=80",
    gradient: "from-slate-900 to-slate-800",
  },
  {
    id: "mccafe-relaunch",
    title: "McCafé Relaunch",
    subtitle: "Neugestaltung",
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=560&q=80",
    gradient: "from-slate-900 to-slate-800",
  },
  {
    id: "sommerfest",
    title: "Sommerfest",
    subtitle: "Team Event",
    imageUrl: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=560&q=80",
    gradient: "from-slate-900 to-slate-800",
  },
];

type Props = {
  title?: string;
  items?: SliderItem[];
};

export default function EventSlider({
  title = "Events & Highlights",
  items = PLACEHOLDER_ITEMS,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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

  // Auto-scroll udesno svakih 5 sekundi; na kraju vrati na početak
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
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
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-foreground uppercase tracking-tight">
          {title}
        </h3>
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

      {/* Slider track — 3 velike kartice u prikazu */}
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="slider-track flex gap-4 overflow-x-auto pb-3 pr-4 md:pr-8 scroll-smooth"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.4 }}
            style={{ scrollSnapAlign: "start", flexShrink: 0 }}
            className="w-[300px] sm:w-[340px] md:w-[380px]"
          >
            <div
              className={`group relative h-[220px] rounded-3xl overflow-hidden cursor-pointer bg-gradient-to-br ${item.gradient} hover:-translate-y-1.5 transition-all duration-300 shadow-xl hover:shadow-2xl ring-1 ring-black/5`}
            >
              {/* Background image */}
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              )}

              {/* Dark gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />

              {/* Coming soon badge if placeholder */}
              {!item.imageUrl && (
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-0.5 rounded-lg bg-white/10 border border-white/15 text-white/60 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                    Bald verfügbar
                  </span>
                </div>
              )}

              {/* Content */}
              <div className="absolute inset-0 flex flex-col justify-end p-5">
                <p className="text-white font-black text-lg leading-tight drop-shadow-md">
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="text-white/80 text-sm font-medium mt-1">
                    {item.subtitle}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-1.5 text-[#FFC72C] text-sm font-bold opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200">
                  Mehr anzeigen <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

    </div>
  );
}
