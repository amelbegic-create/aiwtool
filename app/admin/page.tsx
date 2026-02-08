import { tryRequirePermission } from "@/lib/access";
import Link from "next/link";
import { Users, Building2, ShieldCheck, BookOpen, LayoutDashboard, ClipboardList } from "lucide-react";
import NoPermission from "@/components/NoPermission";

export default async function AdminHome() {
  const usersAccess = await tryRequirePermission("users:access");
  const restaurantsAccess = usersAccess.ok ? usersAccess : await tryRequirePermission("restaurants:access");
  const rulesAccess = await tryRequirePermission("rules:access");
  const pdsAccess = await tryRequirePermission("pds:access");

  const hasAnyAdminAccess = usersAccess.ok || restaurantsAccess.ok || rulesAccess.ok || pdsAccess.ok;
  if (!hasAnyAdminAccess) {
    return <NoPermission moduleName="Admin panel" />;
  }

  const cards = [
    {
      title: "Korisnici & Timovi",
      desc: "Lista korisnika, kreiranje, dodjela restorana i permisija, konfiguracija rola.",
      href: "/admin/users",
      icon: Users,
      tag: "Users & RBAC",
    },
    {
      title: "Restorani",
      desc: "Dodavanje lokacija, uređivanje i status (aktivno/neaktivno).",
      href: "/admin/restaurants",
      icon: Building2,
      tag: "Locations",
    },
    ...(usersAccess.ok
      ? [
          {
            title: "Moduli na dashboardu",
            desc: "Označite koje module prikazati korisnicima u sekciji „Novi moduli“ na početnoj stranici.",
            href: "/admin/dashboard-modules",
            icon: LayoutDashboard,
            tag: "Dashboard",
          },
        ]
      : []),
    ...(rulesAccess.ok
      ? [
          {
            title: "Pravila i procedure",
            desc: "Upravljanje pravilima, kategorijama, statistika čitanja, uređivanje i brisanje.",
            href: "/admin/rules",
            icon: BookOpen,
            tag: "Pravila",
          },
        ]
      : []),
    ...(pdsAccess.ok
      ? [
          {
            title: "PDS obrasci",
            desc: "Kreiranje i upravljanje PDS obrascima za jedan, više ili sve restorane.",
            href: "/admin/pds",
            icon: ClipboardList,
            tag: "PDS",
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-10 font-sans text-foreground">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter">
              ADMIN <span className="text-[#FFC72C]">PANEL</span>
            </h1>
            <p className="text-muted-foreground text-sm font-semibold">
              Upravljanje korisnicima, restoranima i pristupima
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-black uppercase text-muted-foreground">
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border">
              <ShieldCheck size={16} className="text-[#1a3826] dark:text-[#FFC72C]" />
              Globalne permisije
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.href}
                href={c.href}
                className="group bg-card rounded-3xl border border-border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-[#1a3826]/10 dark:bg-[#FFC72C]/20 text-[#1a3826] dark:text-[#FFC72C] flex items-center justify-center">
                    <Icon size={22} />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted border border-border px-3 py-2 rounded-full">
                    {c.tag}
                  </div>
                </div>

                <div className="mt-5">
                  <h2 className="text-xl font-black text-card-foreground group-hover:text-[#1a3826] dark:group-hover:text-[#FFC72C] transition-colors">
                    {c.title}
                  </h2>
                  <p className="text-sm text-muted-foreground font-semibold mt-2 leading-relaxed">
                    {c.desc}
                  </p>
                </div>

                <div className="mt-6 text-xs font-black uppercase tracking-widest text-[#1a3826] dark:text-[#FFC72C]">
                  Otvori →
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
