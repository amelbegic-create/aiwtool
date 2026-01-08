"use client";

import { usePathname } from "next/navigation";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // LayoutWrapper sada samo propušta djecu bez uvoženja Sidebara
  return (
    <div className="flex flex-col h-full bg-white">
      {children}
    </div>
  );
}