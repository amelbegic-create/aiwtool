"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { switchRestaurant } from "@/app/actions/restaurantContext";

/**
 * Deep link iz notifikacije: postavi aktivni restoran u cookie (samo kroz Server Action).
 */
export default function VacationUrlRestaurantSync({ restaurantId }: { restaurantId: string | null }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (!restaurantId || restaurantId === "all" || done.current) return;
    done.current = true;
    void (async () => {
      try {
        await switchRestaurant(restaurantId);
        router.refresh();
      } catch {
        /* ignore */
      }
    })();
  }, [restaurantId, router]);

  return null;
}
