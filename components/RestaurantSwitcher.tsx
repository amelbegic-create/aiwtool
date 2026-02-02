'use client';

import { useEffect, useState, useTransition } from 'react';
import { ChevronDown, Store, Globe, CheckCircle2 } from 'lucide-react';
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
  showAllOption?: boolean;
}

export default function RestaurantSwitcher({ restaurants, activeRestaurantId, showAllOption = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // ✅ FIX: ako korisnik ima samo 1 restoran i cookie nije postavljen,
  // automatski postavi activeRestaurantId da moduli ne “zapnu” na "Odaberi"
  useEffect(() => {
    if ((!activeRestaurantId || activeRestaurantId === '') && restaurants && restaurants.length === 1) {
      const onlyId = restaurants[0]?.id;
      if (!onlyId) return;

      startTransition(async () => {
        await switchRestaurant(onlyId);
        router.refresh();
      });
    }
  }, [activeRestaurantId, restaurants, router]);

  // Logika za prikaz trenutnog
  const activeRest = restaurants.find(r => r.id === activeRestaurantId);
  
  // Prikazno ime (Samo broj)
  let displayName = activeRest?.name || "Odaberi";
  if (activeRestaurantId === 'all') {
      displayName = "Svi";
  }

  const handleSelect = (restId: string) => {
    if (restId === activeRestaurantId) {
      setIsOpen(false);
      return;
    }
    startTransition(async () => {
      await switchRestaurant(restId);
      setIsOpen(false);
      router.refresh(); 
    });
  };

  if (!restaurants || restaurants.length === 0) return null;

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
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-sm transition-colors ${activeRestaurantId === 'all' ? 'bg-[#FFC72C] text-[#1a3826]' : 'bg-[#1a3826] border border-[#FFC72C]/50 text-[#FFC72C]'}`}>
           {isPending ? (
             <span className="animate-spin text-xs font-bold">↻</span>
           ) : (
             activeRestaurantId === 'all' ? <Globe size={16} strokeWidth={2.5} /> : <Store size={16} strokeWidth={2.5} />
           )}
        </div>
        
        <div className="text-left flex flex-col">
            <span className="text-[9px] font-bold text-[#FFC72C] uppercase tracking-widest leading-none mb-0.5 opacity-80">
                {activeRestaurantId === 'all' ? 'Prikaz' : 'Store'}
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
                    
                    {/* OPCIJA: SVI RESTORANI */}
                    {showAllOption && (
                        <button 
                            onClick={() => handleSelect('all')} 
                            className={`w-full text-left px-3 py-3 flex items-center justify-between group transition-all rounded-xl mb-2 border border-transparent
                            ${activeRestaurantId === 'all' ? 'bg-[#FFC72C] text-[#1a3826] shadow-md font-bold' : 'text-white hover:bg-white/5 hover:border-white/10'}`}
                        >
                            <div className="flex items-center gap-3">
                                <Globe size={16} />
                                <span className="text-xs font-bold uppercase tracking-wide">Svi Restorani</span>
                            </div>
                            {activeRestaurantId === 'all' && <CheckCircle2 size={16} className="text-[#1a3826]"/>}
                        </button>
                    )}

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
