/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AdminControlsClient from './components/AdminControlsClient';
import PDSListClient from './components/PDSListClient';
import { cookies } from 'next/headers';
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getTemplateForRestaurantAndYear } from '@/app/actions/pdsActions';

const db = prisma as any;

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

export default async function PDSDashboard(props: { searchParams: Promise<{ year?: string; restaurantId?: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return redirect("/");

  const accessResult = await tryRequirePermission("pds:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="PDS (Beurteilung)" />;
  }

  const searchParams = await props.searchParams;
  const cookieStore = await cookies();
  const activeRestaurantIdFromCookie = cookieStore.get('activeRestaurantId')?.value;
  const restaurantIdFromUrl = searchParams.restaurantId;

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { restaurants: { select: { restaurantId: true } } },
  });
  const isAdminOrGod = ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ARCHITECT'].includes(currentUser?.role || '');
  const isManager = currentUser?.role === 'MANAGER';
  const managerRestaurantIds = (currentUser?.restaurants ?? []).map((r) => r.restaurantId);

  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' }
  });
  const allRestaurantIds = restaurants.map((r) => r.id);
  const availableRestaurantIds = isAdminOrGod ? allRestaurantIds : managerRestaurantIds;

  const allowedRestaurantId =
    (restaurantIdFromUrl && (availableRestaurantIds.length === 0 || availableRestaurantIds.includes(restaurantIdFromUrl)))
      ? restaurantIdFromUrl
      : (activeRestaurantIdFromCookie && (availableRestaurantIds.length === 0 || availableRestaurantIds.includes(activeRestaurantIdFromCookie)))
        ? activeRestaurantIdFromCookie
        : availableRestaurantIds.length > 0
          ? availableRestaurantIds[0]
          : null;

  if (!allowedRestaurantId) {
    return <div className="p-10 text-center text-slate-600">Bitte wählen Sie ein Restaurant.</div>;
  }

  const selectedYear = searchParams.year ? parseInt(searchParams.year) : new Date().getFullYear();

  const template = await getTemplateForRestaurantAndYear(allowedRestaurantId, selectedYear);

  // Admin/SuperAdmin/System Architect: vide sve PDS-eve za restoran i godinu.
  // Svi ostali (MANAGER, CREW, ...) vide samo svoj PDS za tu godinu.
  const EXCLUDED_PDS_ROLES = ['SYSTEM_ARCHITECT', 'SUPER_ADMIN', 'ADMIN'] as const;
  const pdsList = await db.pDS.findMany({
    where: isAdminOrGod
      ? {
          year: selectedYear,
          restaurantId: allowedRestaurantId,
          user: { role: { notIn: [...EXCLUDED_PDS_ROLES] } },
        }
      : { userId: currentUser!.id, year: selectedYear },
    include: { user: { include: { supervisor: { select: { name: true } } } } },
    orderBy: { user: { name: 'asc' } },
  });

  const safeTemplate = template ? JSON.parse(JSON.stringify(template)) : null;
  const safePdsList = JSON.parse(JSON.stringify(pdsList));

  return (
    <div className="min-h-screen bg-background p-6 md:p-8 font-sans text-foreground">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER – unificirani stil kao ADMIN URLAUB */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between print:hidden">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
              PDS <span className="text-[#FFC72C]">BEURTEILUNG</span>
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Mitarbeiterbeurteilung und -entwicklung
            </p>
          </div>

          <div className="flex flex-col items-end gap-4">
            {/* GODINE */}
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 max-w-[320px] md:max-w-none overflow-x-auto">
              {YEARS.map(y => (
                <Link 
                  key={y} 
                  href={`/tools/PDS?year=${y}${allowedRestaurantId ? `&restaurantId=${allowedRestaurantId}` : ''}`} 
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    selectedYear === y 
                    ? 'bg-[#1a3826] text-white shadow-sm' 
                    : 'text-slate-500 hover:text-[#1a3826] hover:bg-slate-50'
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
            
            {/* ADMIN KONTROLE – samo ADMIN/God mogu generisati PDS; Manager samo vidi i popunjava */}
            {isAdminOrGod && (
              <AdminControlsClient 
                selectedYear={selectedYear} 
                template={safeTemplate} 
                currentUserId={currentUser!.id}
                restaurants={restaurants.map((r) => ({ id: r.id, name: r.name ?? r.code, code: r.code }))}
                pdsList={safePdsList}
              />
            )}
          </div>
        </div>

        {/* LISTA ZAPOSLENIKA (Klijentska komponenta za search) – manager vidi samo sebe, admini vide sve */}
        <PDSListClient 
            data={safePdsList} 
            year={selectedYear} 
            isManager={isAdminOrGod} 
        />
      </div>
    </div>
  );
}