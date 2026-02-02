import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { getRules, getCategories } from "@/app/actions/ruleActions";
import AdminView from "./_components/AdminView";
import UserView from "./_components/UserView";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";

// FIX: Await searchParams in Next.js 15
export default async function RulesPage({ searchParams }: { searchParams: Promise<{ restaurantId?: string }> }) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
      return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Molimo prijavite se.</div>;
  }

  const accessResult = await tryRequirePermission("rules:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="Pravila i procedure" />;
  }

  const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true, id: true }
  });

  if (!user) return <div>Greška: Korisnik nije pronađen.</div>;

  // FIX: Cast role to string or any to avoid TS Enum issues
  const userRole = user.role as string;
  const adminRoles = ['SYSTEM_ARCHITECT', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'];
  const isAdmin = adminRoles.includes(userRole);

  // FIX: Await params
  const params = await searchParams;

  const [rules, categories, restaurants] = await Promise.all([
      getRules(params.restaurantId),
      getCategories(),
      prisma.restaurant.findMany({ select: { id: true, name: true } })
  ]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
        {isAdmin ? (
            <AdminView 
                initialRules={rules} 
                categories={categories} 
                restaurants={restaurants} 
                userId={user.id} 
            />
        ) : (
            <UserView 
                initialRules={rules} 
                categories={categories} 
                userId={user.id} 
            />
        )}
    </div>
  );
}