"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isPermissionError = error?.name === "PermissionDeniedError";

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-sm p-8">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {isPermissionError ? "Nemate pristup ovom modulu" : "Modul trenutno je u izradi"}
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {isPermissionError ? (
                <>Trenutno nemate dodijeljene permisije za ovaj modul. Ako mislite da je ovo greška, obratite se administratoru.</>
              ) : (
                <>Došlo je do neočekivane greške. Pokušajte ponovo kasnije ili obratite se administratoru.</>
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50"
              >
                Pokušaj ponovo
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-xl bg-[#1a3826] px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:opacity-95"
              >
                Nazad na Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
