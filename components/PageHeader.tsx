// components/PageHeader.tsx

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  moduleLabel?: string; // npr. "Glavni dashboard", "Modul restorani"...
}

export function PageHeader({ title, subtitle, moduleLabel }: PageHeaderProps) {
  return (
    <header className="bg-gradient-to-r from-slate-900 to-slate-950 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
        {/* Lijevi dio – logo + naslov */}
        <div className="min-w-0 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1 text-xs font-medium">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[11px] font-semibold text-slate-950">
              AT
            </span>
            <span className="truncate">
              MCDToolAT • Operativni centar za McD restorane
            </span>
          </div>

          <div>
            <h1 className="truncate text-2xl font-semibold">{title}</h1>
            {subtitle && (
              <p className="mt-1 max-w-2xl text-sm text-slate-200/80">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Desni dio – info o korisniku / modu */}
        <div className="hidden min-w-[220px] text-right text-xs md:block">
          <div className="inline-flex items-center justify-between gap-2 rounded-full bg-slate-800/80 px-3 py-1">
            <span className="text-[11px] font-medium text-slate-300">
              System Admin
            </span>
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
              KORISNIK
            </span>
          </div>

          <div className="mt-2 text-[11px] text-amber-300">
            Production / Internal use only
          </div>

          {moduleLabel && (
            <div className="mt-1 text-[11px] text-slate-400">
              Aktivan modul:{" "}
              <span className="font-semibold text-slate-100">
                {moduleLabel}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
