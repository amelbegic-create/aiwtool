import prisma from "@/lib/prisma";
import UserForm from "@/components/admin/UserForm"; 

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { code: 'asc' },
    select: { id: true, name: true, code: true }
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-12 text-[#0F172A]">
        {/* Šaljemo sve restorane formi */}
        <UserForm restaurants={restaurants} />
    </div>
  );
}