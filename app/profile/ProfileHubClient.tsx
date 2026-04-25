"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AvatarUpload from "@/components/profile/AvatarUpload";
import {
  User, CalendarDays, Award, Lightbulb, MessageSquare, Lock,
  ShieldCheck, ChevronRight, Umbrella, ExternalLink,
} from "lucide-react";
import type { CalendarEventItem } from "@/lib/calendarShared";
import type { MyIdeaRow } from "@/app/actions/ideaActions";

import PersonalTab from "./_components/PersonalTab";
import VacationTab from "./_components/VacationTab";
import CertificatesTab from "./_components/CertificatesTab";
import CalendarTab from "./_components/CalendarTab";
import IdeasTab from "./_components/IdeasTab";
import SecurityTab from "./_components/SecurityTab";
import OneOnOneTab from "./_components/OneOnOneTab";

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ARCHITECT: "System Architect",
  ADMIN: "Admin",
  MANAGER: "Manager",
  MANAGEMENT: "Management",
  MITARBEITER: "Mitarbeiter",
};

const ROLE_BADGE: Record<string, string> = {
  SYSTEM_ARCHITECT: "bg-purple-600/15 text-purple-700 dark:text-purple-300 border-purple-400/30",
  ADMIN: "bg-red-600/10 text-red-700 dark:text-red-400 border-red-400/30",
  MANAGER: "bg-[#1a3826]/10 text-[#1a3826] dark:text-[#FFC72C] border-[#1a3826]/20 dark:border-[#FFC72C]/20",
  MANAGEMENT: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/30",
  MITARBEITER: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-400/20",
};

type TabId = "personal" | "vacation" | "certificates" | "calendar" | "ideas" | "topics" | "security";

type UserProps = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  supervisorId: string | null;
  supervisorName: string | null;
  supervisorImage: string | null;
  department: { id: string; name: string; color: string } | null;
  restaurants: { id: string; code: string; name: string | null; isPrimary: boolean }[];
  vacationEntitlement: number;
};

type CertItem = {
  id: string; title: string; description: string; imageUrl: string | null;
  pdfUrl?: string | null; pdfName?: string | null; createdAt: string;
};

type Props = {
  initialTab: string;
  user: UserProps;
  vacation: { carryover: number; allowance: number; total: number; used: number; remaining: number } | null;
  currentYear: number;
  certificates: CertItem[];
  ideas: MyIdeaRow[];
  calendarEvents: CalendarEventItem[];
  openTopicsCount: number;
  supervisorInboxCount: number;
  hasSubordinates: boolean;
};

export default function ProfileHubClient({
  initialTab,
  user,
  vacation,
  currentYear,
  certificates,
  ideas,
  calendarEvents,
  openTopicsCount,
  supervisorInboxCount,
  hasSubordinates,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>((initialTab as TabId) || "personal");
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);

  const switchTab = (tab: TabId) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/profile?${params.toString()}`, { scroll: false });
  };

  const totalTopics = openTopicsCount + supervisorInboxCount;
  const displayImage = avatarOverride ?? user.image;
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;
  const roleBadge = ROLE_BADGE[user.role] ?? ROLE_BADGE.MITARBEITER;

  type NavItem = { id: TabId; label: string; icon: React.ReactNode; badge?: number };
  const NAV: NavItem[] = [
    { id: "personal", label: "Profil", icon: <User size={15} /> },
    { id: "vacation", label: "Urlaub", icon: <Umbrella size={15} /> },
    { id: "certificates", label: "Zertifikate", icon: <Award size={15} /> },
    { id: "calendar", label: "Kalender", icon: <CalendarDays size={15} /> },
    { id: "ideas", label: "Meine Ideen", icon: <Lightbulb size={15} /> },
    {
      id: "topics",
      label: "Gesprächsthemen",
      icon: <MessageSquare size={15} />,
      badge: totalTopics > 0 ? totalTopics : undefined,
    },
    { id: "security", label: "Sicherheit", icon: <Lock size={15} /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Narrow header bar (same style as rest of app) ── */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-[#1a3826] dark:text-[#FFC72C]">
              MEIN <span className="text-[#FFC72C] dark:text-white">HUB</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Persönliches Profil und Einstellungen</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Left sidebar ── */}
          <aside className="lg:w-72 shrink-0 space-y-4">
            {/* Identity card */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="bg-gradient-to-br from-[#1a3826] to-[#0d1f15] px-5 py-6 flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-[#FFC72C]/40 shadow-lg">
                  <AvatarUpload
                    currentImageUrl={displayImage}
                    onUpdate={(url) => setAvatarOverride(url)}
                    className="w-full h-full"
                  />
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm text-white truncate max-w-[180px]">{user.name || "Benutzer"}</p>
                  <p className="text-[11px] text-white/50 truncate mt-0.5 max-w-[180px]">{user.email}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${roleBadge}`}>
                  <ShieldCheck size={11} />
                  {roleLabel}
                </span>
              </div>

              {/* Meta info */}
              {(user.department || user.supervisorName) && (
                <div className="px-5 py-4 space-y-2.5 border-t border-border">
                  {user.department && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: user.department.color }} />
                      <span className="truncate">{user.department.name}</span>
                    </div>
                  )}
                  {user.supervisorName && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User size={12} className="shrink-0 text-muted-foreground/60" />
                      <span className="truncate">{user.supervisorName}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Vacation mini stat (if data available) */}
            {vacation && (
              <button
                type="button"
                onClick={() => switchTab("vacation")}
                className="w-full rounded-2xl border border-[#1a3826]/20 dark:border-[#FFC72C]/20 bg-card shadow-sm p-4 flex items-center gap-4 hover:bg-muted/30 transition text-left"
              >
                <div className="h-11 w-11 rounded-xl bg-[#1a3826] flex items-center justify-center shrink-0">
                  <Umbrella size={18} className="text-[#FFC72C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Urlaub {currentYear}</div>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-black text-[#1a3826] dark:text-[#FFC72C]">{vacation.remaining}</span>
                    <span className="text-xs text-muted-foreground">/ {vacation.total} Tage frei</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#1a3826] dark:bg-[#FFC72C]"
                      style={{ width: `${Math.min(100, (vacation.used / Math.max(1, vacation.total)) * 100)}%` }}
                    />
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground shrink-0" />
              </button>
            )}

            {/* Quick links */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Module öffnen</span>
              </div>
              <div className="p-2">
                {[
                  { label: "Urlaubsmodul", href: "/tools/vacations", icon: <Umbrella size={13} /> },
                  { label: "Zertifikate", href: "/tools/certificates", icon: <Award size={13} /> },
                  { label: "Kalender", href: "/tools/calendar", icon: <CalendarDays size={13} /> },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition"
                  >
                    <span className="text-[#1a3826] dark:text-[#FFC72C]">{item.icon}</span>
                    {item.label}
                    <ExternalLink size={10} className="ml-auto opacity-50" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Sidebar nav */}
            <nav className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Navigation</span>
              </div>
              <div className="p-2">
                {NAV.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => switchTab(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-left ${
                        isActive
                          ? "bg-[#1a3826] text-[#FFC72C]"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className={isActive ? "text-[#FFC72C]" : "text-[#1a3826] dark:text-[#FFC72C]"}>{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className={`inline-flex h-4 min-w-[16px] px-1 rounded-full items-center justify-center text-[9px] font-black ${isActive ? "bg-[#FFC72C] text-[#1a3826]" : "bg-[#1a3826] text-white"}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>
          </aside>

          {/* ── Main content ── */}
          <main className="flex-1 min-w-0">
            {/* Mobile tab strip */}
            <div className="lg:hidden mb-4 flex overflow-x-auto gap-1 pb-1 scrollbar-hide">
              {NAV.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchTab(item.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition ${
                      isActive ? "bg-[#1a3826] text-[#FFC72C]" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                    {item.badge && (
                      <span className="inline-flex h-4 min-w-[16px] px-1 rounded-full items-center justify-center text-[9px] font-black bg-red-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div>
              {activeTab === "personal" && <PersonalTab user={user} />}
              {activeTab === "vacation" && <VacationTab vacation={vacation} currentYear={currentYear} />}
              {activeTab === "certificates" && <CertificatesTab certificates={certificates} userId={user.id} />}
              {activeTab === "calendar" && <CalendarTab userId={user.id} initialEvents={calendarEvents} />}
              {activeTab === "ideas" && <IdeasTab initialIdeas={ideas} />}
              {activeTab === "topics" && (
                <OneOnOneTab
                  userId={user.id}
                  userRole={user.role}
                  hasSupervisor={!!user.supervisorId}
                  supervisorName={user.supervisorName}
                  supervisorImage={user.supervisorImage}
                  hasSubordinates={hasSubordinates}
                />
              )}
              {activeTab === "security" && <SecurityTab />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
