import prisma from "@/lib/prisma";
import Link from "next/link";
import { 
  Store, 
  MapPin, 
  Search, 
  ArrowLeft, 
  Plus, 
  ChevronRight 
} from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function RestaurantsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const email = session.user?.email;
  if (!email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      restaurants: { include: { restaurant: true } }
    }
  });

  const userRole = user?.role;
  const isAdmin =
    userRole === Role.SYSTEM_ARCHITECT || userRole === Role.SUPER_ADMIN || userRole === Role.ADMIN;

  let restaurants;
  if (isAdmin) {
    restaurants = await prisma.restaurant.findMany({ orderBy: { code: 'asc' } });
  } else {
    restaurants = user?.restaurants.map(r => r.restaurant) || [];
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 text-foreground">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-500 text-sm font-medium hover:text-[#1a3826] mb-2 transition-colors">
               <ArrowLeft className="w-4 h-4" /> Zurück zum Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Mreža Restorana</h1>
            <p className="text-slate-500 text-sm mt-1">
              Pristup operativnim podacima za {restaurants.length} lokacija.
            </p>
          </div>

          <div className="flex items-center gap-3">
             <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Pretraži..." className="h-10 pl-10 pr-4 rounded-md border border-slate-200 text-sm w-64 bg-white" />
            </div>
            {isAdmin && (
                <button className="h-10 px-4 bg-[#1a3826] text-white rounded-md text-sm font-bold flex items-center gap-2 hover:bg-[#264f36] transition-all shadow-sm">
                    <Plus className="w-4 h-4" /> Dodaj
                </button>
            )}
          </div>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((r) => (
                <Link key={r.id} href={`/restaurant/${r.code}`} className="group bg-white rounded-lg border border-slate-200 p-6 hover:border-[#1a3826] hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between h-52">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110 group-hover:bg-[#1a3826]/5"></div>
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="h-12 w-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-[#1a3826] group-hover:text-[#FFC72C] transition-colors">
                                <Store className="w-6 h-6" />
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${r.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                {r.isActive ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-[#1a3826] transition-colors">{r.name}</h3>
                        <div className="flex items-center gap-2 text-slate-500 text-xs mt-2">
                             <span className="font-mono bg-slate-100 px-1.5 rounded border border-slate-200">#{r.code}</span>
                             <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" /> {r.city || "BiH"}</span>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 mt-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">Otvori Alate</span>
                        <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#1a3826] group-hover:text-white transition-all">
                             <ChevronRight className="w-4 h-4" />
                        </div>
                    </div>
                </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
