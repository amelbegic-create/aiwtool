"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Store, MapPin, ArrowRight, Hash, LogOut, Loader2 } from "lucide-react";
import { getRestaurants } from "@/app/actions/getRestaurants";

export default function SelectRestaurantPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<any[]>([]);

  const selectRestaurant = useCallback((rest: any) => {
    localStorage.setItem("selected_restaurant_id", rest.id);
    localStorage.setItem("selected_restaurant_name", rest.name);
    localStorage.setItem("selected_restaurant_code", rest.code);
    window.location.href = "/"; 
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") window.location.href = "/login";
    if (status !== "authenticated") return;

    const fetchData = async () => {
      try {
        const allRestaurants = await getRestaurants();
        const role = (session?.user as any)?.role;
        const allowedIds = (session?.user as any)?.allowedRestaurants || [];

        let filtered: any[] = [];
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
           filtered = allRestaurants;
        } else {
           // TIP r: any rješava grešku
           filtered = allRestaurants.filter((r: any) => allowedIds.includes(r.id));
        }

        setRestaurants(filtered);
        if (filtered.length === 1) selectRestaurant(filtered[0]);
        else setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };
    fetchData();
  }, [status, session, selectRestaurant]);

  if (loading || status === "loading") return <div className="min-h-screen bg-[#1a3826] flex items-center justify-center"><Loader2 className="text-white animate-spin w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-[#1a3826] flex flex-col items-center justify-center p-6 text-white text-center">
        <h1 className="text-3xl font-black mb-10 uppercase">Izaberite Restoran</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
            {restaurants.map((rest: any) => (
                <button key={rest.id} onClick={() => selectRestaurant(rest)} className="bg-white text-slate-800 p-6 rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform">
                    {rest.name} ({rest.code})
                </button>
            ))}
        </div>
    </div>
  );
}