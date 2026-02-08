import Link from "next/link";
import { ShieldAlert, Construction } from "lucide-react";

interface NoPermissionProps {
  moduleName?: string;
  inDevelopment?: boolean;
}

export default function NoPermission({ moduleName, inDevelopment }: NoPermissionProps) {
  const showInDevelopment = inDevelopment ?? !moduleName;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-sm p-8">
        <div className="flex items-start gap-4">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${
            showInDevelopment ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400" : "bg-muted border border-border text-muted-foreground"
          }`}>
            {showInDevelopment ? <Construction size={20} /> : <ShieldAlert size={20} />}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-foreground tracking-tight">
              {showInDevelopment ? "Modul trenutno je u izradi" : "Nemate pristup ovom modulu"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {showInDevelopment ? (
                <>Ovaj modul je trenutno u fazi razvoja. Pokušajte ponovo kasnije ili obratite se administratoru.</>
              ) : (
                <>Trenutno nemate dodijeljene permisije za modul <span className="font-bold text-foreground">{moduleName}</span>.
                Ako mislite da je ovo greška, obratite se administratoru.</>
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard" className="inline-flex items-center justify-center rounded-xl bg-[#1a3826] px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:opacity-95">
                Nazad na Dashboard
              </Link>
              <Link href="/profile" className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-2 text-xs font-black uppercase tracking-widest text-foreground hover:bg-accent">
                Moj profil
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
