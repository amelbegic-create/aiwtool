"use client"; // <--- OVO POSTAJE CLIENT COMPONENT

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation"; // Koristimo router jer smo već učitali app

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Čekamo da se status učita
    if (status === "loading") return;

    // Ako nema sesije -> Login
    if (status === "unauthenticated") {
      router.push("/login");
    }
    
    // Ako ima sesije -> Ostani tu (Dashboard)
    if (status === "authenticated") {
      // Ovdje kasnije možeš dodati redirect na /dashboard ako želiš, 
      // ali za sada samo neka prikaže sadržaj da vidimo da radi.
      console.log("Korisnik ulogovan:", session.user);
    }
  }, [status, router, session]);

  if (status === "loading") {
    return (
        <div className="flex h-screen items-center justify-center bg-[#1a3826]">
            <div className="text-white">Učitavanje Dashboarda...</div>
        </div>
    );
  }

  if (status === "authenticated") {
    return (
       <div className="flex h-screen items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded shadow text-center">
             <h1 className="text-2xl font-bold text-green-600 mb-4">USPJEH! 🎉</h1>
             <p>Dobrodošli, <strong>{session?.user?.name}</strong></p>
             <p className="text-gray-500 text-sm mt-2">Email: {session?.user?.email}</p>
             <div className="mt-6 p-4 bg-yellow-50 text-yellow-800 rounded border border-yellow-200">
                Ovo je tvoj Dashboard. Auth sada radi preko Browsera!
             </div>
          </div>
       </div>
    );
  }

  return null; // Prazno dok redirektuje
}