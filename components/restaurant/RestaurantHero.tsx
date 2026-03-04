"use client";

import { motion } from "framer-motion";
import { ArrowLeft, MapPin, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Props = {
  name: string;
  code: string;
  tagline?: string | null;
  address?: string | null;
  city?: string | null;
  isActive: boolean;
  photoUrl?: string | null;
  backHref?: string;
};

export default function RestaurantHero({
  name,
  code,
  tagline,
  address,
  city,
  isActive,
  photoUrl,
  backHref = "/restaurants",
}: Props) {
  const location = [address, city].filter(Boolean).join(", ");

  return (
    <div className="relative w-full h-72 md:h-[400px] overflow-hidden">
      {/* Background: photo or brand gradient */}
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={`${name} Titelbild`}
          fill
          className="object-cover object-center"
          priority
          unoptimized={photoUrl.includes("blob.vercel-storage.com")}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a3826] via-[#1e4a2f] to-[#0f2218]" />
      )}

      {/* Multi-layer dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

      {/* Subtle golden accent line at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#FFC72C]/80 via-[#FFC72C]/40 to-transparent" />

      {/* Back button */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/30 backdrop-blur-md border border-white/10 text-white text-xs font-bold hover:bg-black/50 transition-all duration-200 shadow-md"
        >
          <ArrowLeft size={14} />
          Zurück
        </Link>
      </div>

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10 z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-3xl"
        >
          {/* Store code badge */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="inline-flex items-center gap-2 mb-3"
          >
            <span className="px-2.5 py-0.5 rounded-lg bg-[#FFC72C]/90 text-[#1a3826] text-xs font-black tracking-widest uppercase shadow">
              #{code}
            </span>
            {isActive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Operativan
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-xs font-bold backdrop-blur-sm">
                <XCircle size={12} />
                Zatvoren
              </span>
            )}
          </motion.div>

          {/* Restaurant name */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight drop-shadow-lg"
          >
            {name}
          </motion.h1>

          {/* Tagline */}
          {tagline && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="mt-1.5 text-[#FFC72C] text-base md:text-lg font-medium italic drop-shadow"
            >
              {tagline}
            </motion.p>
          )}

          {/* Location */}
          {location && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="mt-3 flex items-center gap-1.5 text-white/70 text-sm font-medium"
            >
              <MapPin size={14} className="text-white/50" />
              {location}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Animated scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-4 right-6 z-10"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="text-white/40"
        >
          <ChevronDown size={20} />
        </motion.div>
      </motion.div>
    </div>
  );
}
