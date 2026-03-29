"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import { X } from "lucide-react";

export function GalleryFileThumb({
  file,
  onRemove,
}: {
  file: File;
  onRemove?: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => {
    return () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    };
  }, [url]);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-muted">
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition hover:bg-black/80 group-hover:opacity-100"
          aria-label="Entfernen"
        >
          <X size={14} />
        </button>
      ) : null}
      <div className="relative aspect-square w-full">
        <Image src={url} alt="" fill className="object-cover" sizes="160px" unoptimized />
      </div>
    </div>
  );
}
