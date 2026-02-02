"use client";

import { usePathname } from "next/navigation";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const _pathname = usePathname();
  
  return (
    <div className="flex flex-col h-full bg-white">
      {children}
    </div>
  );
}