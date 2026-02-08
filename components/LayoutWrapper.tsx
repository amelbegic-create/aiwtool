"use client";

import { usePathname } from "next/navigation";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  usePathname(); // keep for future use / re-render on route
  return (
    <div className="flex flex-col h-full bg-background">
      {children}
    </div>
  );
}