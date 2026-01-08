"use client";

import { useEffect, useState } from "react";
// Ne treba nam useRouter jer koristimo window.location
import { getRestaurants } from "@/app/actions/getRestaurants";

// Definicija tipa da TypeScript ne pravi probleme
interface Restaurant {
  id: string;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
}

export default function SelectRestaurantPage() {
  // Nemamo state za prikaz jer nećemo ništa prikazivati osim Loadinga

  useEffect(() => {
    const autoSelectAndRedirect = async () => {
      try {
        // 1. Dohvati sve restorane
        const allRestaurants = await getRestaurants();
        
        // 2. Filtriraj (kopirano iz prošle verzije za svaki slučaj)
        const role = localStorage.getItem("user_role");
        const allowedIdsJson = localStorage.getItem("allowed_restaurants");
        const allowedIds: string[] = allowedIdsJson ? JSON.parse(allowedIdsJson) : [];
        
        let targetRestaurant: Restaurant | null = null;

        // Logika za odabir prvog dostupnog
        if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
           if (allowedIds.length > 0) {
             const filtered = allRestaurants.filter((r: Restaurant) => allowedIds.includes(r.id));
             if (filtered.length > 0) targetRestaurant = filtered[0];
           } else {
             // Ako je admin i nema restrikcija, uzmi prvi sa liste
             if (allRestaurants.length > 0) targetRestaurant = allRestaurants[0];
           }
        } else {
           const filtered = allRestaurants.filter((r: Restaurant) => allowedIds.includes(r.id));
           if (filtered.length > 0) targetRestaurant = filtered[0];
        }

        // 3. AKO SMO NAŠLI RESTORAN -> ODMAH PREUSMJERI
        if (targetRestaurant) {
          console.log("Auto-selecting:", targetRestaurant.name);
          
          localStorage.setItem("selected_restaurant_id", targetRestaurant.id);
          localStorage.setItem("selected_restaurant_name", targetRestaurant.name);
          localStorage.setItem("selected_restaurant_code", targetRestaurant.code);
          
          // CRITICAL: Hard redirect na početnu
          window.location.href = "/"; 
        } else {
          // Ako nema restorana, vrati na login (ili pokaži grešku)
          console.error("Nema dostupnih restorana");
          window.location.href = "/login";
        }

      } catch (error) {
        console.error("Failed to load restaurants", error);
        window.location.href = "/login";
      }
    };

    // Pokreni odmah pri učitavanju
    autoSelectAndRedirect();
  }, []);

  // Prikazujemo SAMO spinner dok on to radi u pozadini
  return (
    <div className="min-h-screen bg-[#1a3826] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-white/20 border-t-[#FFC72C] rounded-full animate-spin mb-4"></div>
      <p className="text-white/50 text-sm font-medium animate-pulse">Učitavanje restorana...</p>
    </div>
  );
}