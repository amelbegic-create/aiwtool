"use client";

import { useEffect } from "react";

type Props = {
  src: string;
  title?: string;
  headerOffsetPx?: number;
};

export default function BonusiFrame({
  src,
  title = "Bonusi",
  headerOffsetPx = 80,
}: Props) {
  
  // Ovo sprječava scrollanje glavne ("parent") stranice dok gledaš iframe,
  // tako da scrollaš samo sadržaj unutar iframe-a.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-[60] bg-white"
      style={{ top: `${headerOffsetPx}px` }}
    >
      <iframe
        title={title}
        src={src}
        className="block w-full border-0"
        style={{
          height: "100%", // Iframe popunjava container
          width: "100%",
        }}
        // Ovi atributi su bitni za mobilne uređaje
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}