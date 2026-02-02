import { tryRequirePermission } from "@/lib/access";
import UsersTabs from "./UsersTabs";
import NoPermission from "@/components/NoPermission";

export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usersAccess = await tryRequirePermission("users:access");
  const restaurantsAccess = usersAccess.ok ? usersAccess : await tryRequirePermission("restaurants:access");

  if (!restaurantsAccess.ok) {
    return <NoPermission moduleName="Korisnici i restorani" />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-10 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-[#1a3826] uppercase tracking-tighter">
            Korisnici <span className="text-[#FFC72C]">&</span> Timovi
          </h1>
          <p className="text-slate-600 text-sm font-semibold mt-1">
            Upravljanje korisnicima, restoranima i konfiguracija rola
          </p>
        </div>
        <UsersTabs />
        {children}
      </div>
    </div>
  );
}
