/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth";
import PDSFormClient from './PDSFormClient'; 
import { redirect } from 'next/navigation';
import { authOptions } from "@/lib/authOptions";

const prisma = new PrismaClient();

export default async function PDSDetailsPage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return redirect("/");

  const params = await props.params;

  if (!params.id) return redirect("/tools/PDS");

  const pds = await (prisma as any).pDS.findUnique({
    where: { id: params.id },
    include: { user: true }
  });

  if (!pds) return <div className="p-10 text-center font-bold text-slate-500 uppercase tracking-widest">PDS dokument nije pronađen.</div>;

  const safePds = JSON.parse(JSON.stringify(pds));
  const isManager = ['ADMIN', 'MANAGER', 'SUPER_ADMIN', 'SYSTEM_ARCHITECT'].includes((session.user as any).role);

  return <PDSFormClient pds={safePds} isManager={isManager} />;
}