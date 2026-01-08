"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Store, MapPin, ArrowRight, Hash, LogOut, Loader2 } from "lucide-react";
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

  const selectRestaurant = useCallback((rest: Restaurant) => {
    localStorage.setItem("selected_restaurant_id", rest.id);
    localStorage.setItem("selected_restaurant_name", rest.name);
    localStorage.setItem("selected_restaurant_code", rest.code);
    
    // Koristimo router za brzi prelaz bez osvježavanja
    router.push("/");
  }, [router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allRestaurants = await getRestaurants();
        setUserName(localStorage.getItem("user_name") || "Korisnik");
        
        // Jednostavan filter (prikazujemo sve za početak)
        setRestaurants(allRestaurants);

        if (allRestaurants.length === 1) {
          selectRestaurant(allRestaurants[0]);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Greška pri učitavanju restorana");
        setLoading(false);
      }
    };
    fetchData();
  }, [selectRestaurant]);

  if (loading) return (
    <div className="min-h-screen bg-[#1a3826] flex flex-col items-center justify-center">
      <Loader2 className="text-white animate-spin mb-4" size={40} />
      <p className="text-emerald-200/50 font-bold uppercase tracking-widest text-xs">Učitavanje lokacija...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1a3826] flex flex-col items-center justify-center p-6 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/logo.png')] bg-no-repeat bg-center opacity-5 scale-150 pointer-events-none"></div>

      <div className="text-center mb-12 relative z-10">
        <h1 className="text-4xl font-black text-white uppercase tracking-tight mb-2">Dobrodošli, {userName}</h1>
        <p className="text-emerald-200/60 font-medium uppercase text-[10px] tracking-[0.3em]">Odaberite Vašu Radnu Jedinicu</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full relative z-10">
        {restaurants.map((rest) => (
          <button 
            key={rest.id}
            onClick={() => selectRestaurant(rest)}
            className="group bg-white p-8 rounded-[2.5rem] text-left transition-all hover:scale-[1.03] shadow-2xl flex flex-col justify-between h-64 border-4 border-transparent hover:border-yellow-400"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="bg-slate-50 p-3 rounded-2xl group-hover:bg-[#1a3826] group-hover:text-white transition-colors">
                  <Store size={24} />
                </div>
                <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  #{rest.code}
                </span>
              </div>
              <h3 className="text-xl font-black text-[#1a3826] uppercase leading-tight mb-1">{rest.name}</h3>
              <p className="text-slate-400 text-xs font-bold uppercase flex items-center gap-1">
                <MapPin size={12} /> {rest.city || "BIH"}
              </p>
            </div>
            
            <div className="flex items-center gap-2 text-[#1a3826] font-black text-xs uppercase group-hover:gap-4 transition-all">
              Pristupi sistemu <ArrowRight size={16} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}