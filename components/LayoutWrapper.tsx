"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Lista stranica gdje NE ŽELIMO sidebar (Login, Register, itd.)
  const isPublicPage = pathname === "/login" || pathname === "/register";

  if (isPublicPage) {
    return <>{children}</>;
  }

  // Za sve ostale stranice: Prikaži Sidebar lijevo + Sadržaj desno
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
         {children}
      </div>
    </div>
  );
}