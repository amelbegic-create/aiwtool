'use client';

import { useEffect, useTransition, useState } from 'react';
import { ChevronDown, Store, Check } from 'lucide-react';
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

  const list = (restaurants ?? [])
    .filter((r) => r.id !== 'all')
    .sort((a, b) => {
      const na = parseInt(a.name ?? a.code, 10);
      const nb = parseInt(b.name ?? b.code, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return (a.name ?? a.code).localeCompare(b.name ?? b.code);
    });

  useEffect(() => {
    if ((!activeRestaurantId || activeRestaurantId === 'all' || activeRestaurantId === '') && list.length >= 1) {
      startTransition(async () => {
        await switchRestaurant(list[0].id);
        router.refresh();
      });
    }
  }, [activeRestaurantId, list, router]);

  const effectiveActiveId =
    activeRestaurantId && activeRestaurantId !== 'all' ? activeRestaurantId : list[0]?.id;
  const activeRest = list.find((r) => r.id === effectiveActiveId);
  const displayName = activeRest?.name ?? activeRest?.code ?? 'Auswählen';

  const handleSelect = (restId: string) => {
    if (restId === effectiveActiveId) { setIsOpen(false); return; }
    startTransition(async () => {
      await switchRestaurant(restId);
      setIsOpen(false);
      router.refresh();
    });
  };

  if (list.length === 0) return null;

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        disabled={isPending}
        className={`group flex items-center gap-3 pl-1 pr-4 py-1.5 rounded-xl border transition-all duration-200 ${
          isOpen
            ? 'bg-[#0d1f15] border-[#FFC72C]/30 shadow-lg text-white'
            : 'bg-white/5 border-transparent hover:bg-white/10 text-white/90'
        }`}
      >
        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-[#1a3826] border border-[#FFC72C]/50 text-[#FFC72C]">
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
          <span className="text-sm font-black leading-none tracking-tight">{displayName}</span>
        </div>
        <ChevronDown
          size={16}
          className={`ml-1 text-white/40 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#FFC72C]' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="fixed left-0 right-0 top-[60px] px-4 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="bg-[#1a3826] rounded-2xl shadow-2xl border border-[#FFC72C]/20 ring-1 ring-black/30 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                  Lokation wählen
                </span>
                <span className="text-[10px] text-white/25">{list.length} Stores</span>
              </div>

              {/* Single row, full width */}
              <div className="px-3 py-3 flex items-center gap-2">
                {list.map((rest) => {
                  const isActive = effectiveActiveId === rest.id;
                  const label = rest.name ?? rest.code;
                  return (
                    <button
                      key={rest.id}
                      type="button"
                      onClick={() => handleSelect(rest.id)}
                      className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
                        isActive
                          ? 'bg-[#FFC72C] text-[#1a3826] shadow-sm'
                          : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {isActive && <Check size={11} strokeWidth={3} />}
                      {label}
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
