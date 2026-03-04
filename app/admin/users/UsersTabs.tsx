"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, SlidersHorizontal, Layers, Award } from "lucide-react";

export default function UsersTabs() {
  const pathname = usePathname();
  const isRoles = pathname.includes("/roles");
  const isDepartments = pathname.includes("/departments");
  const isCertificates = pathname.includes("/certificates");

  return (
    <div className="flex gap-2 border-b border-slate-200 pb-4 flex-wrap">
      <Link
        href="/admin/users"
        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
          !isRoles && !isDepartments && !isCertificates
            ? "bg-[#1a3826] text-white shadow-md"
            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
        }`}
      >
        <Users size={18} />
        Benutzerliste
      </Link>
      <Link
        href="/admin/users/roles"
        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
          isRoles
            ? "bg-[#1a3826] text-white shadow-md"
            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
        }`}
      >
        <SlidersHorizontal size={18} />
        Rollen-/Berechtigungskonfiguration
      </Link>
      <Link
        href="/admin/users/departments"
        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
          isDepartments
            ? "bg-[#1a3826] text-white shadow-md"
            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
        }`}
      >
        <Layers size={18} />
        Abteilungen
      </Link>
      <Link
        href="/admin/users/certificates"
        className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
          isCertificates
            ? "bg-[#1a3826] text-white shadow-md"
            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
        }`}
      >
        <Award size={18} />
        Zertifikate
      </Link>
    </div>
  );
}
