'use client';

import { useEffect, useState, useTransition } from 'react';
import { ChevronDown, Store } from 'lucide-react';
import { switchRestaurant } from '@/app/actions/restaurantContext';
import { useRouter } from 'next/navigation';

interface Restaurant {
  id: string;
  name: string | null;
  code: string;
}

interface Props {
  restaurants: Restaurant[];
  activeRestaurantId?: string;
}

export default function RestaurantSwitcher({ restaurants, activeRestaurantId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Bez opcije "Alle Restaurants" – nikad ne prikazujemo "all" u listi
  const list = (restaurants ?? []).filter((r) => r.id !== "all");

  // Kad nema cookie (ili je "all"), automatski postavi prvi restoran i refresh
  // da se cookie odmah upiše – i za jednog i za više restorana.
  useEffect(() => {
    if ((!activeRestaurantId || activeRestaurantId === "all" || activeRestaurantId === "") && list.length >= 1) {
      startTransition(async () => {
        await switchRestaurant(list[0].id);
        router.refresh();
      });
    }
  }, [activeRestaurantId, list, router]);

  // Ako je cookie i dalje "all" (stari bookmark), prikaži prvi restoran kao label
  const effectiveActiveId = activeRestaurantId && activeRestaurantId !== "all" ? activeRestaurantId : list[0]?.id;
  const activeRest = list.find((r) => r.id === effectiveActiveId);
  const displayName = activeRest?.name ?? "Auswählen";

  const handleSelect = (restId: string) => {
    if (restId === effectiveActiveId) {
      setIsOpen(false);
      return;
    }
    startTransition(async () => {
      await switchRestaurant(restId);
      setIsOpen(false);
      router.refresh();
    });
  };

  if (list.length === 0) return null;

  return (
    <div className="relative">
      
      {/* GLAVNI GUMB */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className={`
            group flex items-center gap-3 pl-1 pr-4 py-1.5 rounded-xl border transition-all duration-200
            ${isOpen 
                ? 'bg-[#0d1f15] border-[#FFC72C]/30 shadow-lg text-white' 
                : 'bg-white/5 border-transparent hover:bg-white/10 text-white/90'
            }
        `}
      >
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shadow-sm transition-colors bg-[#1a3826] border border-[#FFC72C]/50 text-[#FFC72C]">
           {isPending ? (
             <span className="animate-spin text-xs font-bold">↻</span>
           ) : (
             <Store size={16} strokeWidth={2.5} />
           )}
        </div>
        
        <div className="text-left flex flex-col">
            <span className="text-[9px] font-bold text-[#FFC72C] uppercase tracking-widest leading-none mb-0.5 opacity-80">
                Store
            </span>
            <span className="text-sm font-black leading-none tracking-tight">
                {displayName}
            </span>
        </div>

        <ChevronDown 
            size={16} 
            className={`ml-1 text-white/40 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#FFC72C]' : ''}`} 
        />
      </button>

      {/* PADAJUĆI MENI */}
      {isOpen && (
        <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 top-full mt-2 w-72 bg-[#1a3826] rounded-2xl shadow-2xl border border-[#FFC72C]/20 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/40">
                
                {/* Header menija */}
                <div className="bg-[#142e1e] px-4 py-2 border-b border-white/5 text-[10px] font-black text-white/40 uppercase tracking-widest">
                    Promijeni Lokaciju
                </div>

                <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-2">
                    {/* GRID RESTORANA */}
                    <div className="grid grid-cols-2 gap-2">
                        {restaurants.map((rest) => {
                            const isActive = activeRestaurantId === rest.id;
                            return (
                                <button 
                                    key={rest.id} 
                                    onClick={() => handleSelect(rest.id)} 
                                    className={`
                                        relative flex items-center justify-center px-2 py-3 rounded-xl border transition-all duration-200 group
                                        ${isActive 
                                            ? 'bg-[#FFC72C] border-[#FFC72C] text-[#1a3826] shadow-md' 
                                            : 'bg-white/5 border-white/5 text-white hover:bg-white/10 hover:border-white/20'
                                        }
                                    `}
                                >
                                    <div className="flex flex-col items-center gap-1">
                                        <span className={`text-[10px] uppercase font-bold tracking-wider ${isActive ? 'text-[#1a3826]/70' : 'text-white/40'}`}>
                                            STORE
                                        </span>
                                        <span className="text-lg font-black leading-none">
                                            {rest.name}
                                        </span>
                                    </div>
                                    {isActive && <div className="absolute top-1.5 right-1.5"><div className="h-1.5 w-1.5 bg-[#1a3826] rounded-full"></div></div>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
      )}
    </div>
  );
}
