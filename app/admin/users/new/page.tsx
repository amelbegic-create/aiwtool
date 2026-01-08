import prisma from "@/lib/prisma";
import UserForm from "@/components/admin/UserForm"; // Importujemo novu komponentu

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  // Dohvatamo restorane Server-Side
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { code: 'asc' },
    select: { id: true, name: true, code: true }
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-8 text-[#0F172A]">
        <UserForm restaurants={restaurants} />
    </div>
  );
}