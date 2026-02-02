/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from 'next/navigation';
import PDSFormClient from './PDSFormClient';

export default async function PDSDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return redirect("/");

  const currentUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  
  const pds = await (prisma as any).pDS.findUnique({
    where: { id: params.id },
    include: { user: true }
  });

  if (!pds) return <div className="p-10 text-center font-bold text-slate-500 uppercase tracking-widest">PDS dokument nije pronađen.</div>;

  const isManager = ['ADMIN', 'MANAGER', 'SUPER_ADMIN', 'SYSTEM_ARCHITECT'].includes(currentUser?.role || '');
  const safePds = JSON.parse(JSON.stringify(pds));

  // FIX: Ne šaljemo više currentUserEmail
  return <PDSFormClient pds={safePds} isManager={isManager} />;
}