"use client";

import { usePathname } from "next/navigation";
// ... ostali importi

export default function TopNavbar() {
  const pathname = usePathname();

  // Sakrivamo navigaciju na login i select-restaurant stranicama
  if (pathname === "/login" || pathname === "/select-restaurant") {
    return null;
  }

  return (
    <nav className="...">
      {/* Tvoj postojeći kod navigacije */}
    </nav>
  );
}