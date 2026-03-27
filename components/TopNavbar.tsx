"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { APP_TOOLS, TOOL_CATEGORIES } from "@/lib/tools/tools-config";
import { ChevronDown, LayoutGrid, LogOut, User, Menu, X, Bell, Settings, CheckCircle2, XCircle, RotateCcw, Clock, CalendarX, CalendarRange, FileText, Lightbulb, Lock, Unlock } from "lucide-react";
import { useState, useEffect, useRef, useTransition } from "react";
import { signOut, useSession } from "next-auth/react";
import { Kanit } from "next/font/google";
import RestaurantSwitcher from "./RestaurantSwitcher";
import { dict } from "@/translations";
import { toast } from "sonner";
import { isGlobalScopeRole } from "@/lib/permissions";
import { markNotificationsAsRead } from "@/app/actions/notificationActions";

interface UserWithRole {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  permissions?: string[];
}

const brandFont = Kanit({ subsets: ["latin"], weight: ["600", "800", "900"] });

const CATEGORY_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  restaurant: "Restaurant",
  personal: "Personal",
  finanz: "Finanz",
  vorlagen: "Vorlagen",
};

interface RichNotification {
  id: string;
  kind?: string;
  title: string;
  description: string;
  href: string;
  createdAt?: string;
  actorName?: string;
  actorImage?: string | null;
  actorInitials?: string;
  restaurantName?: string | null;
  vacationStatus?: string;
  vacationDates?: string;
}

interface TopNavbarProps {
  restaurants: { id: string; name: string | null; code: string }[];
  activeRestaurantId?: string;
  notificationCount?: number;
  notifications?: RichNotification[];
}

/* ---- helpers ---- */
function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "Gerade eben";
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  return `vor ${Math.floor(diff / 86400)} T.`;
}

function kindMeta(kind?: string, status?: string) {
  if (kind === "admin_vacation_pending") {
    return {
      icon: <Clock size={14} className="text-white" />,
      bg: "bg-blue-500",
      label: "Urlaubsantrag",
      labelColor: "text-blue-600 dark:text-blue-400",
    };
  }
  if (kind === "admin_vacation_storno") {
    return {
      icon: <CalendarX size={14} className="text-white" />,
      bg: "bg-orange-500",
      label: "Stornierung",
      labelColor: "text-orange-600 dark:text-orange-400",
    };
  }
  if (kind === "admin_idea_new") {
    return {
      icon: <Lightbulb size={14} className="text-white" />,
      bg: "bg-amber-500",
      label: "Ideenbox",
      labelColor: "text-amber-700 dark:text-amber-400",
    };
  }
  if (kind === "dashboard_news_new") {
    return {
      icon: <FileText size={14} className="text-white" />,
      bg: "bg-[#1a3826]",
      label: "News",
      labelColor: "text-[#FFC72C]",
    };
  }
  if (kind === "dashboard_events_new") {
    return {
      icon: <CalendarRange size={14} className="text-white" />,
      bg: "bg-[#1a3826]",
      label: "Events",
      labelColor: "text-[#FFC72C]",
    };
  }
  if (kind === "cl_month_locked") {
    return {
      icon: <Lock size={14} className="text-white" />,
      bg: "bg-[#1b3a26]",
      label: "CL gesperrt",
      labelColor: "text-[#1b3a26] dark:text-[#FFC72C]",
    };
  }
  if (kind === "cl_unlock_requested") {
    return {
      icon: <Unlock size={14} className="text-white" />,
      bg: "bg-violet-600",
      label: "CL Entsperre",
      labelColor: "text-violet-700 dark:text-violet-400",
    };
  }
  const s = status ?? kind ?? "";
  if (s.includes("approved") || s === "APPROVED") {
    return {
      icon: <CheckCircle2 size={14} className="text-white" />,
      bg: "bg-emerald-500",
      label: "Genehmigt",
      labelColor: "text-emerald-600 dark:text-emerald-400",
    };
  }
  if (s.includes("rejected") || s === "REJECTED") {
    return {
      icon: <XCircle size={14} className="text-white" />,
      bg: "bg-red-500",
      label: "Abgelehnt",
      labelColor: "text-red-600 dark:text-red-400",
    };
  }
  if (s.includes("returned") || s === "RETURNED") {
    return {
      icon: <RotateCcw size={14} className="text-white" />,
      bg: "bg-amber-500",
      label: "Zurückgesendet",
      labelColor: "text-amber-600 dark:text-amber-400",
    };
  }
  return {
    icon: <Bell size={14} className="text-white" />,
    bg: "bg-slate-500",
    label: "",
    labelColor: "text-muted-foreground",
  };
}

export default function TopNavbar({
  restaurants = [],
  activeRestaurantId,
  notificationCount = 0,
  notifications = [],
}: TopNavbarProps) {
  const pathname = usePathname();
  const [notifPending, startNotifTransition] = useTransition();
  const [locallyReadIds, setLocallyReadIds] = useState<Set<string>>(new Set());
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  /** Server šalje samo nepročitane; stanje „gelesen“ je u bazi. */
  const unreadNotifications = notifications.filter((n) => !locallyReadIds.has(n.id));
  const unreadCount = unreadNotifications.length;

  // Prikaži "Gespeichert" toast nakon automatskog snimanja pri izlasku iz modula
  useEffect(() => {
    try {
      if (sessionStorage.getItem("mcd-autosave-toast") === "1") {
        sessionStorage.removeItem("mcd-autosave-toast");
        toast.success("Gespeichert.");
      }
    } catch { /* ignore */ }
  }, [pathname]);

  const persistRead = (ids: string[]) => {
    if (ids.length === 0) return;
    setLocallyReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    startNotifTransition(() => {
      void (async () => {
        try {
          await markNotificationsAsRead(ids);
        } catch {
          // optimistic UI ostaje; server će uskladiti stanje na sljedećem navigationu
        }
      })();
    });
  };

  const markRead = (id: string) => persistRead([id]);

  const markAllRead = () => persistRead(notifications.map((n) => n.id));

  // U listi prikazujemo samo nepročitane (max 5)
  const visibleNotifications = unreadNotifications.slice(0, 5);
  const hiddenCount = unreadNotifications.length - visibleNotifications.length;

  // Zatvori dropdown klikom van
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  const closeMenu = () => setMobileMenuOpen(false);

  const user = session?.user as UserWithRole | undefined;
  const role = user?.role;
  const permissions = user?.permissions || [];

  const isPerRestaurantOnly = pathname.startsWith("/tools/labor-planner");

  const canSeeAllRestaurants = isGlobalScopeRole(role) || role === "MANAGER";

  /** Ulaz u /admin: eksplicitno admin_panel:access ili SYSTEM_ARCHITECT (bypass u hasPermission). */
  const showAdminNav =
    role === "SYSTEM_ARCHITECT" || permissions.includes("admin_panel:access");

  // Sakrij navbar na login stranici
  if (pathname === "/login" || pathname === "/select-restaurant") return null;

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 w-full shrink-0 bg-[#1a3826] text-white shadow-lg border-b border-white/5 safe-area-t">
      <div className="h-14 md:h-16 max-w-[1920px] mx-auto px-3 md:px-6 flex justify-between items-center">
        
        {/* LIJEVA: HAMBURGER (mobile) + LOGO */}
        <div className="flex items-center gap-1 md:gap-6">
            {/* Hamburger + Notifications (mobile only) */}
            <div className="md:hidden flex items-center gap-0.5">
              <button
                className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors touch-manipulation"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Menü öffnen"
              >
                <Menu size={24} />
              </button>
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative flex h-11 w-11 min-w-[44px] items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors touch-manipulation"
                aria-label="Benachrichtigungen"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </div>
            <Link href="/dashboard" onClick={closeMenu} className={`flex items-baseline gap-2 hover:opacity-80 transition-all select-none ${brandFont.className}`}>
                <h1 className="text-xl md:text-2xl tracking-tighter text-white uppercase font-black">AIW</h1>
                <p className="text-xs md:text-sm text-[#FFC72C] tracking-[0.1em] uppercase font-extrabold">Services</p>
            </Link>

            {/* Prikaz Switchera samo ako ima restorana ili je admin - sakriveno na mobilnim */}
            {(restaurants.length > 0 || canSeeAllRestaurants) && (
                <div className="hidden md:flex items-center gap-4">
                    <div className="h-8 w-px bg-white/10"></div>
                    <RestaurantSwitcher 
                        restaurants={restaurants} 
                        activeRestaurantId={activeRestaurantId} 
                    />
                </div>
            )}
        </div>

        {/* SREDINA: NAVIGACIJA - samo desktop */}
        <nav className="hidden md:flex h-full items-center gap-1">
          {TOOL_CATEGORIES.map((category) => {
            const categoryTools = APP_TOOLS.filter(t => t.category === category.id);
            const isDashboard = category.id === 'dashboard';
            const isVorlagen = category.id === 'vorlagen';
            const isActiveCategory = 
              (isDashboard && pathname === '/dashboard') ||
              (isVorlagen && pathname.startsWith('/tools/vorlagen')) ||
              categoryTools.some(t => pathname.startsWith(t.href));
            const displayLabel = CATEGORY_LABELS[category.id] || category.label;

            if (isDashboard) {
              return (
                <div key={category.id} className="relative h-full flex items-center">
                  <Link 
                    href="/dashboard"
                    className={`h-10 px-4 rounded-lg flex items-center gap-2 text-[11px] font-black uppercase transition-all tracking-widest ${isActiveCategory ? 'bg-white/10 text-[#FFC72C]' : 'hover:bg-white/5 text-emerald-100/60 hover:text-white'}`}
                  >
                    <LayoutGrid size={14} />
                    {displayLabel}
                  </Link>
                </div>
              );
            }

            if (isVorlagen) {
              return (
                <div key={category.id} className="relative h-full flex items-center">
                  <Link 
                    href="/tools/vorlagen"
                    className={`h-10 px-4 rounded-lg flex items-center gap-2 text-[11px] font-black uppercase transition-all tracking-widest ${isActiveCategory ? 'bg-white/10 text-[#FFC72C]' : 'hover:bg-white/5 text-emerald-100/60 hover:text-white'}`}
                  >
                    {displayLabel}
                  </Link>
                </div>
              );
            }

            return (
              <div key={category.id} className="relative group h-full flex items-center">
                <button
                  type="button"
                  className={`h-10 px-4 rounded-lg flex items-center gap-2 text-[11px] font-black uppercase transition-all tracking-widest ${isActiveCategory ? 'bg-white/10 text-[#FFC72C]' : 'hover:bg-white/5 text-emerald-100/60 hover:text-white'}`}
                >
                  {displayLabel}
                  <ChevronDown size={12} className="opacity-40 group-hover:rotate-180 transition-transform" />
                </button>

                {/* Dropdown Menu */}
                {categoryTools.length > 0 && (
                  <div className="absolute top-[90%] left-0 w-64 bg-card rounded-xl shadow-2xl border border-border overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 z-50">
                    <div className="p-2 space-y-0.5 text-card-foreground">
                      {categoryTools.map((tool) => (
                        <Link key={tool.id} href={tool.href} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors group/tool">
                          <span className="p-1.5 bg-muted rounded-md text-muted-foreground group-hover/tool:bg-[#1a3826] group-hover/tool:text-[#FFC72C] transition-all">
                            <tool.icon size={14} />
                          </span>
                          <span className="text-xs font-bold text-foreground tracking-tight">{tool.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* DESNA STRANA: NOTIFIKACIJE + USER PROFILE */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex flex-col items-end leading-none border-r border-white/10 pr-4 font-bold">
            <span className="text-[10px] font-black text-white uppercase tracking-tight">{session?.user?.name || "Benutzer"}</span>
            <span className="text-[9px] font-bold text-[#FFC72C] uppercase tracking-widest mt-1 opacity-80">
                Online
            </span>
          </div>
          {/* Notifikacije – zvono sa Facebook-stil dropdownom */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className="relative h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all border border-white/10"
              aria-label="Benachrichtigungen"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-md animate-pulse">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-3 w-[390px] rounded-2xl bg-card shadow-2xl border border-border z-50 overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
                  <span className="text-base font-black text-foreground">Benachrichtigungen</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <span className="text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {unreadCount} ungelesen
                      </span>
                    )}
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        disabled={notifPending}
                        onClick={markAllRead}
                        className="text-[11px] font-bold text-[#1a3826] dark:text-[#FFC72C] hover:underline disabled:opacity-40"
                      >
                        Alle gelesen
                      </button>
                    )}
                  </div>
                </div>

                {/* Liste – max 5 nepročitanih */}
                <div className="divide-y divide-border/50">
                  {visibleNotifications.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <Bell size={32} className="mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-muted-foreground">Keine neuen Benachrichtigungen.</p>
                    </div>
                  ) : (
                    visibleNotifications.map((n) => {
                      const meta = kindMeta(n.kind, n.vacationStatus);
                      const isAdminKind =
                        n.kind === "admin_vacation_pending" ||
                        n.kind === "admin_vacation_storno" ||
                        n.kind === "admin_idea_new" ||
                        n.kind === "cl_month_locked" ||
                        n.kind === "cl_unlock_requested";
                      const isDashboardNotif =
                        n.kind === "dashboard_news_new" || n.kind === "dashboard_events_new";
                      return (
                        <div key={n.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors group relative">
                          <Link
                            href={n.href}
                            onClick={() => { markRead(n.id); setNotifOpen(false); }}
                            className="flex items-start gap-3 flex-1 min-w-0"
                          >
                            {/* Avatar */}
                            <div className="shrink-0 relative">
                              <div className="w-11 h-11 rounded-full overflow-hidden bg-[#1a3826] flex items-center justify-center">
                                {n.actorImage ? (
                                  <Image src={n.actorImage} alt={n.actorName ?? ""} width={44} height={44} className="object-cover w-full h-full" />
                                ) : (
                                  <span className="text-sm font-black text-[#FFC72C]">
                                    {n.actorInitials ?? (isAdminKind ? "?" : "ME")}
                                  </span>
                                )}
                              </div>
                              <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full ${meta.bg} flex items-center justify-center ring-2 ring-card`}>
                                {meta.icon}
                              </div>
                            </div>
                            {/* Text */}
                            <div className="flex-1 min-w-0">
                              {isAdminKind ? (
                                <>
                                  <p className="text-sm leading-snug text-foreground break-words">
                                    <span className="font-black">{n.actorName}</span>{" "}
                                    <span className={`font-bold ${meta.labelColor}`}>{n.description}</span>
                                  </p>
                                  {n.restaurantName && <p className="text-[11px] text-muted-foreground mt-0.5">📍 {n.restaurantName}</p>}
                                  {n.vacationDates && <p className="text-[11px] font-mono text-muted-foreground mt-0.5">📅 {n.vacationDates}</p>}
                                </>
                              ) : isDashboardNotif ? (
                                <>
                                  <p className="text-sm leading-snug text-foreground break-words">
                                    <span className="font-black">{n.title}</span>{" "}
                                    <span className={`font-bold ${meta.labelColor}`}>{n.description}</span>
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm leading-snug text-foreground">
                                    <span className="font-bold">Ihr Urlaubsantrag </span>
                                    <span className={`font-black ${meta.labelColor}`}>{meta.label}</span>
                                  </p>
                                  {n.vacationDates && <p className="text-[11px] font-mono text-muted-foreground mt-0.5">📅 {n.vacationDates}</p>}
                                </>
                              )}
                              <p className="text-[10px] text-muted-foreground/60 mt-1 font-semibold">{timeAgo(n.createdAt)}</p>
                            </div>
                          </Link>
                          {/* Als gelesen markieren */}
                          <button
                            type="button"
                            title="Als gelesen markieren"
                            disabled={notifPending}
                            onClick={() => markRead(n.id)}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1 p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer – "Weitere anzeigen" */}
                {(hiddenCount > 0 || unreadCount > 0) && (
                  <div className="px-4 py-3 border-t border-border bg-muted/20">
                    <button
                      type="button"
                      onClick={() => { setNotifOpen(false); setShowAllModal(true); }}
                      className="w-full text-center text-xs font-bold text-[#1a3826] dark:text-[#FFC72C] hover:underline"
                    >
                      {hiddenCount > 0 ? `Weitere ${hiddenCount} Benachrichtigungen anzeigen` : "Alle Benachrichtigungen anzeigen"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {showAdminNav && (
            <Link
              href="/admin"
              onClick={closeMenu}
              className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all border border-white/10"
              title="Admin Panel / Einstellungen"
              aria-label="Admin Panel"
            >
              <Settings size={18} />
            </Link>
          )}
          <div className="flex items-center gap-1.5">
            <Link href="/profile" onClick={closeMenu} className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white hover:text-[#1a3826] text-white overflow-hidden flex items-center justify-center transition-all border border-white/10 relative" title={dict.nav_profile_tooltip}>
               {session?.user?.image ? (
                 <Image src={session.user.image} alt="User" fill className="object-cover" sizes="32px" priority />
               ) : (
                 <User size={16} />
               )}
            </Link>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="h-8 w-8 flex items-center justify-center text-white/30 hover:text-red-400 transition-colors ml-1"><LogOut size={16} /></button>
          </div>
        </div>

      </div>
    </header>

    {/* MOBILE SHEET DRAWER - izlazi sa lijeve strane */}
    {mobileMenuOpen && (
      <>
        <div
          className="md:hidden fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeMenu}
          aria-hidden="true"
        />
        <div
          className="md:hidden fixed inset-y-0 left-0 z-[101] w-[min(320px,85vw)] max-w-full bg-[#1a3826] shadow-2xl animate-in slide-in-from-left duration-300 overflow-y-auto"
          role="dialog"
          aria-label="Navigationsmenü"
        >
          <div className="flex flex-col min-h-full">
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
              <span className={`text-lg font-black text-white ${brandFont.className}`}>Menü</span>
              <button
                onClick={closeMenu}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors"
                aria-label="Menü schließen"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4 space-y-4 flex-1">
              {(restaurants.length > 0 || canSeeAllRestaurants) && (
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <p className="text-[10px] text-slate-400 uppercase font-black mb-3 tracking-widest">Odaberi Restoran</p>
                  <RestaurantSwitcher 
                    restaurants={restaurants} 
                    activeRestaurantId={activeRestaurantId} 
                  />
                </div>
              )}

              <nav className="space-y-1">
                {TOOL_CATEGORIES.map((category) => {
                  const categoryTools = APP_TOOLS.filter(t => t.category === category.id);
                  const isDashboard = category.id === 'dashboard';
                  const isVorlagen = category.id === 'vorlagen';

                  if (isDashboard) {
                    return (
                      <div key={category.id}>
                        <Link
                          href="/dashboard"
                          onClick={closeMenu}
                          className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-white hover:bg-white/10 transition-colors min-h-[44px]"
                        >
                          <LayoutGrid size={18} />
                          <span className="uppercase tracking-widest text-xs font-black">
                            {CATEGORY_LABELS[category.id] || category.label}
                          </span>
                        </Link>
                      </div>
                    );
                  }

                  if (isVorlagen) {
                    return (
                      <div key={category.id}>
                        <Link
                          href="/tools/vorlagen"
                          onClick={closeMenu}
                          className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-white hover:bg-white/10 transition-colors min-h-[44px]"
                        >
                          <FileText size={18} />
                          <span className="uppercase tracking-widest text-xs font-black">
                            {CATEGORY_LABELS[category.id] || category.label}
                          </span>
                        </Link>
                      </div>
                    );
                  }

                  return (
                    <div key={category.id}>
                      <div className="flex items-center justify-between px-4 py-3.5 rounded-xl text-white min-h-[44px]">
                        <span className="uppercase tracking-widest text-xs font-black">
                          {CATEGORY_LABELS[category.id] || category.label}
                        </span>
                        <ChevronDown size={16} className="text-white/40 rotate-[-90deg]" />
                      </div>
                      {categoryTools.length > 0 && (
                        <div className="ml-4 mt-1 space-y-0.5 pl-4 border-l border-white/10">
                          {categoryTools.map((tool) => (
                            <Link
                              key={tool.id}
                              href={tool.href}
                              onClick={closeMenu}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-100/90 hover:bg-white/5 hover:text-white transition-colors min-h-[44px]"
                            >
                              <tool.icon size={18} />
                              {tool.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-white/10 space-y-2">
                {showAdminNav && (
                  <Link
                    href="/admin"
                    onClick={closeMenu}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-white hover:bg-white/10 transition-colors min-h-[44px]"
                  >
                    <Settings size={18} />
                    <span className="text-sm font-bold">Admin Panel</span>
                  </Link>
                )}
                <Link
                  href="/profile"
                  onClick={closeMenu}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-white hover:bg-white/10 transition-colors min-h-[44px]"
                >
                  <User size={18} />
                  <span className="text-sm font-bold">Mein Profil</span>
                </Link>
                <button
                  onClick={() => { closeMenu(); signOut({ callbackUrl: "/login" }); }}
                  className="w-full flex items-center justify-center gap-2 bg-red-500/20 text-red-300 hover:bg-red-500/30 py-3.5 rounded-xl text-sm font-black uppercase tracking-widest transition-colors min-h-[44px]"
                >
                  <LogOut size={18} /> Abmelden
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )}
    {/* MODAL: Alle Benachrichtigungen */}
    {showAllModal && (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => { if (e.target === e.currentTarget) setShowAllModal(false); }}
      >
        <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <span className="text-base font-black text-foreground">Alle Benachrichtigungen</span>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  disabled={notifPending}
                  onClick={markAllRead}
                  className="text-[11px] font-bold text-[#1a3826] dark:text-[#FFC72C] hover:underline disabled:opacity-40"
                >
                  Alle gelesen
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAllModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Liste */}
          <div className="divide-y divide-border max-h-[65vh] overflow-y-auto">
            {unreadNotifications.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Bell size={36} className="mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Keine Benachrichtigungen.</p>
              </div>
            ) : (
            unreadNotifications.map((n) => {
                const meta = kindMeta(n.kind, n.vacationStatus);
                const isAdminKind =
                  n.kind === "admin_vacation_pending" ||
                  n.kind === "admin_vacation_storno" ||
                  n.kind === "admin_idea_new" ||
                  n.kind === "cl_month_locked" ||
                  n.kind === "cl_unlock_requested";
                const isDashboardNotif =
                  n.kind === "dashboard_news_new" || n.kind === "dashboard_events_new";
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3.5 group transition-colors hover:bg-muted/40"
                  >
                    <Link
                      href={n.href}
                      onClick={() => { markRead(n.id); setShowAllModal(false); }}
                      className="flex items-start gap-3 flex-1 min-w-0"
                    >
                      <div className="shrink-0 relative">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1a3826] flex items-center justify-center">
                          {n.actorImage ? (
                            <Image src={n.actorImage} alt={n.actorName ?? ""} width={40} height={40} className="object-cover w-full h-full" />
                          ) : (
                            <span className="text-sm font-black text-[#FFC72C]">
                              {n.actorInitials ?? (isAdminKind ? "?" : "ME")}
                            </span>
                          )}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${meta.bg} flex items-center justify-center ring-2 ring-card`}>
                          <span className="scale-75">{meta.icon}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        {isAdminKind ? (
                          <>
                            <p className="text-sm leading-snug text-foreground break-words">
                              <span className="font-black">{n.actorName}</span>{" "}
                              <span className={`font-bold ${meta.labelColor}`}>{n.description}</span>
                            </p>
                            {n.restaurantName && <p className="text-[11px] text-muted-foreground mt-0.5">📍 {n.restaurantName}</p>}
                            {n.vacationDates && <p className="text-[11px] font-mono text-muted-foreground mt-0.5">📅 {n.vacationDates}</p>}
                          </>
                        ) : isDashboardNotif ? (
                          <>
                            <p className="text-sm leading-snug text-foreground break-words">
                              <span className="font-black">{n.title}</span>{" "}
                              <span className={`font-bold ${meta.labelColor}`}>{n.description}</span>
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm leading-snug text-foreground">
                              <span className="font-bold">Ihr Urlaubsantrag </span>
                              <span className={`font-black ${meta.labelColor}`}>{meta.label}</span>
                            </p>
                            {n.vacationDates && <p className="text-[11px] font-mono text-muted-foreground mt-0.5">📅 {n.vacationDates}</p>}
                          </>
                        )}
                        <p className="text-[10px] text-muted-foreground/60 mt-1 font-semibold">{timeAgo(n.createdAt)}</p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      title="Als gelesen markieren"
                      disabled={notifPending}
                      onClick={() => markRead(n.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1 p-1 rounded-full hover:bg-muted text-muted-foreground disabled:opacity-40"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-border bg-muted/20">
            <button
              onClick={() => setShowAllModal(false)}
              className="w-full py-2 rounded-xl bg-[#1a3826] dark:bg-[#FFC72C] text-white dark:text-[#1a3826] text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}