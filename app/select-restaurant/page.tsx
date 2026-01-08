"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Store, MapPin, ArrowRight, Hash, LogOut } from "lucide-react";
import { getRestaurants } from "@/app/actions/getRestaurants";

interface Restaurant {
  id: string;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
}

export default function SelectRestaurantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [userName, setUserName] = useState("");

  // FIX: Funkcija premještena IZNAD useEffect-a
  const selectRestaurant = useCallback((rest: Restaurant) => {
    localStorage.setItem("selected_restaurant_id", rest.id);
    localStorage.setItem("selected_restaurant_name", rest.name);
    localStorage.setItem("selected_restaurant_code", rest.code);
    router.push("/");
  }, [router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allRestaurants = await getRestaurants();
        
        const role = localStorage.getItem("user_role");
        const allowedIdsJson = localStorage.getItem("allowed_restaurants");
        const allowedIds: string[] = allowedIdsJson ? JSON.parse(allowedIdsJson) : [];
        setUserName(localStorage.getItem("user_name") || "Korisnik");

        let filtered: Restaurant[] = [];

        if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
           if (allowedIds.length > 0) {
             filtered = allRestaurants.filter(r => allowedIds.includes(r.id));
           } else {
             filtered = allRestaurants;
           }
        } else {
           filtered = allRestaurants.filter(r => allowedIds.includes(r.id));
        }

        setRestaurants(filtered);

        if (filtered.length === 1) {
          selectRestaurant(filtered[0]);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to load restaurants");
        setLoading(false);
      }
    };

    fetchData();
  }, [selectRestaurant]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  if (loading) return (
    <div className="min-h-screen bg-[#1a3826] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-white/20 border-t-[#FFC72C] rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1a3826] flex flex-col items-center justify-center p-6">
      <div className="absolute top-6 right-6">
         <button onClick={handleLogout} className="flex items-center gap-2 text-white/50 hover:text-white text-xs font-bold uppercase">
            <LogOut size={14}/> Odjavi se ({userName})
         </button>
      </div>
      <div className="text-center mb-10">
        <img src="/logo.png" alt="Logo" className="h-24 w-auto mx-auto mb-4 object-contain" />
        <h1 className="text-3xl font-black text-white uppercase tracking-tight">Dobrodošli, {userName}</h1>
        <p className="text-emerald-200/60 mt-2 font-medium">Izaberite lokaciju za rad.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl w-full">
        {restaurants.length > 0 ? (
          restaurants.map((rest) => (
            <button 
              key={rest.id}
              onClick={() => selectRestaurant(rest)}
              className="group relative bg-white hover:bg-emerald-50 p-6 rounded-2xl text-left transition-all hover:scale-[1.02] shadow-lg border border-transparent hover:border-emerald-200"
            >
              <div className="absolute top-4 right-4 bg-slate-100 group-hover:bg-white p-2 rounded-full transition-colors">
                <Store className="text-slate-400 group-hover:text-[#1a3826] w-6 h-6" />
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                <span className="flex items-center gap-1"><MapPin size={12} /> {rest.city || "BiH"}</span>
                <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-500"><Hash size={10} /> {rest.code}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 group-hover:text-[#1a3826] mb-1">{rest.name}</h3>
              <div className="mt-6 flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-wider group-hover:text-[#1a3826] group-hover:gap-3 transition-all">
                Otvori <ArrowRight size={14} />
              </div>
            </button>
          ))
        ) : (
          <div className="col-span-1 md:col-span-3 text-center text-white/50 p-8 border-2 border-dashed border-white/10 rounded-xl">
            <p className="font-bold">Nemate pristup nijednom restoranu.</p>
            <p className="text-sm mt-2">Kontaktirajte administratora.</p>
          </div>
        )}
      </div>
    </div>
  );
}