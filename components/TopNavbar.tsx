"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_TOOLS, TOOL_CATEGORIES } from "@/lib/tools/tools-config";
import { ChevronDown, LayoutGrid, LogOut, User, Menu, X } from "lucide-react";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Kanit } from "next/font/google";
import RestaurantSwitcher from "./RestaurantSwitcher";

interface UserWithRole {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
}

const brandFont = Kanit({ subsets: ["latin"], weight: ["600", "800", "900"] });

const CATEGORY_LABELS: Record<string, string> = {
  general: "Dashboard",
  staff: "Personal",
  operations: "Operations",
  other: "Other",
};

interface TopNavbarProps {
  restaurants: { id: string; name: string | null; code: string }[];
  activeRestaurantId?: string;
}

export default function TopNavbar({ restaurants = [], activeRestaurantId }: TopNavbarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  const user = session?.user as UserWithRole | undefined;
  const role = user?.role;

  // Dozvole za admina
  const canSeeAllRestaurants = 
    role === 'SYSTEM_ARCHITECT' || 
    role === 'SUPER_ADMIN' || 
    role === 'ADMIN' || 
    role === 'MANAGER';

  // Sakrij navbar na login stranici
  if (pathname === "/login" || pathname === "/select-restaurant") return null;

  return (
    <header className="bg-[#1a3826] text-white shadow-xl h-16 shrink-0 relative z-50 transition-all border-b border-white/5">
      <div className="h-full max-w-[1920px] mx-auto px-6 flex justify-between items-center">
        
        {/* LIJEVA STRANA: LOGO + RESTORAN SWITCHER */}
        <div className="flex items-center gap-6">
            <Link href="/dashboard" onClick={closeMenu} className={`flex items-baseline gap-2 hover:opacity-80 transition-all select-none ${brandFont.className}`}>
                <h1 className="text-2xl tracking-tighter text-white uppercase font-black">AIW</h1>
                <p className="text-sm text-[#FFC72C] tracking-[0.1em] uppercase font-extrabold">Services</p>
            </Link>

            {/* Prikaz Switchera samo ako ima restorana ili je admin */}
            {(restaurants.length > 0 || canSeeAllRestaurants) && (
                <div className="hidden md:flex items-center gap-4">
                    <div className="h-8 w-px bg-white/10"></div>
                    <RestaurantSwitcher 
                        restaurants={restaurants} 
                        activeRestaurantId={activeRestaurantId} 
                        showAllOption={canSeeAllRestaurants} 
                    />
                </div>
            )}
        </div>

        {/* SREDINA: NAVIGACIJA */}
        <nav className="hidden md:flex h-full items-center gap-1">
          {TOOL_CATEGORIES.map((category) => {
            const categoryTools = APP_TOOLS.filter(t => t.category === category.id);
            const isGeneral = category.id === 'general';
            const isActiveCategory = categoryTools.some(t => pathname.startsWith(t.href)) || (isGeneral && pathname === '/dashboard');
            const displayLabel = CATEGORY_LABELS[category.id] || category.label;

            return (
              <div key={category.id} className="relative group h-full flex items-center">
                <Link 
                  href={isGeneral ? "/dashboard" : `/tools/categories/${category.id}`}
                  className={`h-10 px-4 rounded-lg flex items-center gap-2 text-[11px] font-black uppercase transition-all tracking-widest ${isActiveCategory ? 'bg-white/10 text-[#FFC72C]' : 'hover:bg-white/5 text-emerald-100/60 hover:text-white'}`}
                >
                  {isGeneral && <LayoutGrid size={14} />}
                  {displayLabel}
                  {!isGeneral && <ChevronDown size={12} className="opacity-40 group-hover:rotate-180 transition-transform" />}
                </Link>

                {/* Dropdown Menu */}
                {!isGeneral && categoryTools.length > 0 && (
                  <div className="absolute top-[90%] left-0 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 z-50">
                    <div className="p-2 space-y-0.5 text-slate-900">
                      {categoryTools.map((tool) => (
                        <Link key={tool.id} href={tool.href} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors group/tool">
                          <span className="p-1.5 bg-slate-100 rounded-md text-slate-400 group-hover/tool:bg-[#1a3826] group-hover/tool:text-[#FFC72C] transition-all">
                            <tool.icon size={14} />
                          </span>
                          <span className="text-xs font-bold text-slate-700 tracking-tight">{tool.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* DESNA STRANA: USER PROFILE */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex flex-col items-end leading-none border-r border-white/10 pr-4 font-bold">
            <span className="text-[10px] font-black text-white uppercase tracking-tight">{session?.user?.name || "Korisnik"}</span>
            <span className="text-[9px] font-bold text-[#FFC72C] uppercase tracking-widest mt-1 opacity-80">
                Online
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/profile" onClick={closeMenu} className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white hover:text-[#1a3826] text-white overflow-hidden flex items-center justify-center transition-all border border-white/10">
               {session?.user?.image ? <img src={session.user.image} alt="User" className="h-full w-full object-cover" /> : <User size={16} />}
            </Link>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="h-8 w-8 flex items-center justify-center text-white/30 hover:text-red-400 transition-colors ml-1"><LogOut size={16} /></button>
          </div>
        </div>

        {/* MOBILE MENU TOGGLE */}
        <button 
          className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors" 
          onClick={() => setMobileMenuOpen(prev => !prev)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 w-full bg-[#1a3826] border-t border-white/5 shadow-2xl animate-in slide-in-from-top-2 duration-200 overflow-y-auto max-h-[80vh]">
            <div className="p-4 space-y-4 pb-10">
                
                {(restaurants.length > 0 || canSeeAllRestaurants) && (
                  <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <p className="text-[10px] text-slate-400 uppercase font-black mb-2 tracking-widest">Odaberi Restoran</p>
                      <RestaurantSwitcher 
                        restaurants={restaurants} 
                        activeRestaurantId={activeRestaurantId} 
                        showAllOption={canSeeAllRestaurants} 
                      />
                  </div>
                )}

                <div className="space-y-1">
                    {TOOL_CATEGORIES.map((category) => (
                        <Link 
                            key={category.id}
                            href={category.id === 'general' ? "/dashboard" : `/tools/categories/${category.id}`}
                            onClick={closeMenu}
                            className="flex items-center justify-between px-4 py-3 rounded-lg text-sm font-bold text-white hover:bg-white/5 transition-colors"
                        >
                            <span className="uppercase tracking-widest text-xs font-black">{CATEGORY_LABELS[category.id] || category.label}</span>
                        </Link>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-2 pt-4 border-t border-white/5">
                    <button onClick={() => signOut()} className="flex items-center justify-center gap-2 bg-red-500/10 text-red-400 p-3 rounded-lg text-[10px] font-black uppercase tracking-widest">
                        <LogOut size={14} /> Odjava
                    </button>
                </div>
            </div>
        </div>
      )}
    </header>
  );
}