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
  const REFRESH_GUARD_KEY = "activeRestaurantSyncRefreshDone";

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (typeof window !== "undefined" && sessionStorage.getItem(REFRESH_GUARD_KEY) === "1") {
      return;
    }
    void (async () => {
      const { changed } = await syncActiveRestaurantCookieWithSession();
      if (changed) {
        try {
          sessionStorage.setItem(REFRESH_GUARD_KEY, "1");
        } catch {
          // ignore storage failures
        }
        router.refresh();
      }
    })();
  }, [router]);

  return null;
}
