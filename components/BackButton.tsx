"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type BackButtonProps = {
  href?: string;
  label?: string;
};

export default function BackButton({ href, label }: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition"
    >
      <ArrowLeft className="h-3 w-3" />
      {label ?? "Nazad"}
    </button>
  );
}
