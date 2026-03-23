"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncActiveRestaurantCookieWithSession } from "@/app/actions/activeRestaurantSync";

/**
 * Ispravlja `activeRestaurantId` cookie ako ne odgovara restoranima trenutnog korisnika
 * (npr. ostatak od prijašnjeg admin logina). Mora biti Server Action – ne RSC render.
 */
export default function ActiveRestaurantCookieSync() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      const { changed } = await syncActiveRestaurantCookieWithSession();
      if (changed) router.refresh();
    })();
  }, [router]);

  return null;
}
