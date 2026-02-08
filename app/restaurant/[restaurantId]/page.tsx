import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  Store,
  MapPin,
  Calculator,
  ClipboardCheck,
  TrendingUp,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ restaurantId: string }>;
};

export default async function RestaurantDashboard({ params }: PageProps) {
  const { restaurantId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  // 1) DOHVATI RESTORAN (po code)
  const restaurant = await prisma.restaurant.findUnique({
    where: { code: restaurantId },
  });

  if (!restaurant) notFound();

  // 2) PROVJERA PRISTUPA
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { restaurants: true },
  });

  if (!user) redirect("/login");

  const userRole = String(user.role);
  const isSuperAdmin =
    userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "SYSTEM_ARCHITECT";

  const hasAccess = isSuperAdmin || user.restaurants.some((r) => r.restaurantId === restaurant.id);

  if (!hasAccess) redirect("/restaurants");

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 text-foreground">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/restaurants"
          className="inline-flex items-center gap-2 text-slate-500 text-sm font-bold hover:text-[#1a3826] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Nazad na Mrežu Restorana
        </Link>

        {/* HEADER RESTORANA */}
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex gap-6 items-center">
            <div className="h-16 w-16 rounded-lg bg-[#1a3826] flex items-center justify-center text-[#FFC72C] shadow-sm">
              <Store className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-slate-900">{restaurant.name}</h1>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    restaurant.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {restaurant.isActive ? "OPERATIVAN" : "ZATVOREN"}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="font-mono font-bold text-slate-700">#{restaurant.code}</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {restaurant.address || "BiH"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ALATI GRID */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#1a3826]" /> Operativni Alati
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. MJESEČNI PLANER */}
            <Link
              href={`/tools/labor-planner?restaurant=${restaurant.code}`}
              className="group bg-white p-6 rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all flex flex-col h-60 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4 relative z-10 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Calculator className="w-6 h-6" />
              </div>
              <div className="relative z-10 flex-1">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-slate-900 text-lg group-hover:text-blue-700">Mjesečni Planer</h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">FINANCE</span>
                </div>
                <p className="text-sm text-slate-500">Detaljna analiza produktivnosti, troška i sati po danima.</p>
              </div>
              <div className="mt-auto relative z-10 flex items-center text-sm font-bold text-blue-600 gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                Otvori Planer <ArrowRight className="w-4 h-4" />
              </div>
            </Link>

            {/* 2. EVALUACIJA */}
            <Link
              href={`/tools/evaluations?restaurant=${restaurant.code}`}
              className="group bg-white p-6 rounded-xl border border-slate-200 hover:border-purple-500 hover:shadow-md transition-all flex flex-col h-60 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <div className="h-12 w-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center mb-4 relative z-10 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div className="relative z-10 flex-1">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-slate-900 text-lg group-hover:text-purple-700">Evaluacija Učinka</h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">HR</span>
                </div>
                <p className="text-sm text-slate-500">Službeni obrazac za ocjenjivanje radnika i menadžera.</p>
              </div>
              <div className="mt-auto relative z-10 flex items-center text-sm font-bold text-purple-600 gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                Nova Evaluacija <ArrowRight className="w-4 h-4" />
              </div>
            </Link>

            {/* 3. PRODUKTIVNOST */}
            <Link
              href={`/tools/productivity?restaurant=${restaurant.code}`}
              className="group bg-white p-6 rounded-xl border border-slate-200 hover:border-orange-500 hover:shadow-md transition-all flex flex-col h-60 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
              <div className="h-12 w-12 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center mb-4 relative z-10 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="relative z-10 flex-1">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-slate-900 text-lg group-hover:text-orange-700">Produktivnost</h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OPS</span>
                </div>
                <p className="text-sm text-slate-500">Planiranje prometa i raspored sati po stanicama.</p>
              </div>
              <div className="mt-auto relative z-10 flex items-center text-sm font-bold text-orange-600 gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                Otvori Planer <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
