'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, Check, Store } from 'lucide-react';
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

  const activeRest = restaurants.find(r => r.id === activeRestaurantId) || restaurants[0];
  const displayName = activeRest?.name || activeRest?.code || "Odaberi";

  const handleSelect = (restId: string) => {
    if (restId === activeRest?.id) {
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
      
      {/* GUMB - Dizajniran za ZELENU pozadinu */}
      <button 
        onClick={() => restaurants.length > 1 && setIsOpen(!isOpen)}
        disabled={isPending}
        className={`
            group flex items-center gap-3 pl-1 pr-3 py-1 rounded-lg border transition-all duration-200
            ${isOpen 
                ? 'bg-[#0d1f15] border-[#FFC72C]/50 shadow-lg' 
                : 'bg-white/10 border-transparent hover:bg-white/20 hover:border-white/10'
            }
        `}
      >
        {/* Ikonica */}
        <div className="bg-[#FFC72C] h-7 w-7 rounded flex items-center justify-center text-[#1a3826] shadow-sm">
           {isPending ? (
             <span className="animate-spin text-xs font-bold">↻</span>
           ) : (
             <Store size={14} strokeWidth={3} />
           )}
        </div>
        
        {/* Tekst */}
        <div className="text-left flex flex-col">
            <span className="text-[8px] text-[#FFC72C] font-bold uppercase tracking-widest leading-none mb-0.5 opacity-90">
                Restoran
            </span>
            <span className="text-xs font-black text-white leading-none uppercase tracking-wide truncate max-w-[140px]">
                {displayName}
            </span>
        </div>

        {/* Strelica */}
        {restaurants.length > 1 && (
             <ChevronDown 
                size={14} 
                className={`text-white/60 ml-1 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#FFC72C]' : ''}`} 
            />
        )}
      </button>

      {/* DROPDOWN - Tamni */}
      {isOpen && (
        <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 top-full mt-2 w-64 bg-[#1a3826] rounded-xl shadow-2xl border border-[#FFC72C]/20 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/20">
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                    {restaurants.map((rest) => {
                        const isActive = activeRest?.id === rest.id;
                        return (
                            <button
                                key={rest.id}
                                onClick={() => handleSelect(rest.id)}
                                className={`
                                    w-full text-left px-3 py-2.5 flex items-center justify-between group transition-all rounded-lg mb-0.5
                                    ${isActive ? 'bg-[#FFC72C] text-[#1a3826]' : 'text-white hover:bg-white/10'}
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${isActive ? 'border-[#1a3826]/30' : 'border-white/20 text-white/50'}`}>
                                        {rest.code}
                                    </span>
                                    <span className="text-xs font-bold uppercase tracking-tight">
                                        {rest.name}
                                    </span>
                                </div>
                                {isActive && <Check size={14} strokeWidth={3}/>}
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
      )}
    </div>
  );
}