"use client";

import { useEffect, useCallback } from "react";
import { getRestaurants } from "@/app/actions/getRestaurants";

// Definisanje interfejsa za restoran
interface Restaurant {
  id: string;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
}

export default function SelectRestaurantPage() {
  const selectRestaurant = useCallback((rest: Restaurant) => {
    localStorage.setItem("selected_restaurant_id", rest.id);
    localStorage.setItem("selected_restaurant_name", rest.name);
    localStorage.setItem("selected_restaurant_code", rest.code);
    
    // Forsiramo hard refresh da browser sigurno pošalje kolačiće serveru
    window.location.href = "/"; 
  }, []);

  useEffect(() => {
    const autoSelect = async () => {
      try {
        const allRestaurants = await getRestaurants();
        
        const role = localStorage.getItem("user_role");
        const allowedIdsJson = localStorage.getItem("allowed_restaurants");
        const allowedIds: string[] = allowedIdsJson ? JSON.parse(allowedIdsJson) : [];
        
        let target: Restaurant | null = null;

        // Popravljene TypeScript greške dodavanjem tipa (r: Restaurant)
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
           if (allowedIds.length > 0) {
             const filtered = allRestaurants.filter((r: Restaurant) => allowedIds.includes(r.id));
             if (filtered.length > 0) target = filtered[0];
           } else if (allRestaurants.length > 0) {
             target = allRestaurants[0];
           }
        } else {
           const filtered = allRestaurants.filter((r: Restaurant) => allowedIds.includes(r.id));
           if (filtered.length > 0) target = filtered[0];
        }

        if (target) {
          selectRestaurant(target);
        } else {
          window.location.href = "/login";
        }
      } catch (error) {
        console.error("Greška pri učitavanju:", error);
        window.location.href = "/login";
      }
    };

    autoSelect();
  }, [selectRestaurant]);

  return (
    <div className="min-h-screen bg-[#1a3826] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-white/20 border-t-[#FFC72C] rounded-full animate-spin mb-4"></div>
      <p className="text-white/50 text-sm font-medium">Učitavanje restorana...</p>
    </div>
  );
}