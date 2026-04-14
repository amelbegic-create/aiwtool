"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Wrench, User } from "lucide-react";
import { dict } from "@/translations";

const BASE_NAV_ITEMS = [
  { href: "/dashboard", label: dict.nav_dashboard, icon: LayoutDashboard },
  { href: "/team", label: dict.nav_team, icon: Users, requiresTeam: true },
  { href: "/tools/categories/staff", label: dict.nav_staff_tools, icon: Wrench },
  { href: "/profile", label: dict.nav_profile, icon: User },
];

export default function BottomNav({ showTeam = false }: { showTeam?: boolean }) {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/select-restaurant" || pathname?.startsWith("/login/")) {
    return null;
  }

  const NAV_ITEMS = BASE_NAV_ITEMS.filter(item => !item.requiresTeam || showTeam);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)] safe-area-b"
      role="navigation"
      aria-label="Hauptnavigation"
    >
      <div className={`grid h-16 max-w-lg mx-auto ${NAV_ITEMS.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : item.href === "/tools/categories/staff"
                ? pathname?.startsWith("/tools")
                : pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] py-2 px-1 text-muted-foreground transition-colors touch-manipulation active:bg-muted/50"
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                size={22}
                className={isActive ? "text-[#1a3826] dark:text-[#FFC72C]" : ""}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-tight ${
                  isActive ? "text-[#1a3826] dark:text-[#FFC72C]" : ""
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
