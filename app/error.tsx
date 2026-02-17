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
              {isPermissionError ? "Kein Zugriff auf dieses Modul" : "Modul befindet sich im Aufbau"}
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {isPermissionError ? (
                <>Sie haben derzeit keine Berechtigung für dieses Modul. Wenn Sie der Meinung sind, dass dies ein Fehler ist, wenden Sie sich bitte an den Administrator.</>
              ) : (
                <>Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es später erneut oder wenden Sie sich an den Administrator.</>
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50"
              >
                Erneut versuchen
              </button>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-xl bg-[#1a3826] px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:opacity-95"
              >
                Zurück zum Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
