"use client";

import { useEffect } from "react";

type Props = {
  src: string;
  title?: string;
  headerOffsetPx?: number; // visina top headera (kod tebe je h-20 => 80px)
};

export default function BonusiFrame({ src, title = "Bonusi", headerOffsetPx = 80 }: Props) {
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  return (
    <div className="fixed left-0 right-0 bottom-0 z-[60] bg-white" style={{ top: `${headerOffsetPx}px` }}>
      <iframe
        title={title}
        src={src}
        className="absolute inset-0 h-full w-full"
        style={{ border: 0, display: "block", background: "white" }}
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}
