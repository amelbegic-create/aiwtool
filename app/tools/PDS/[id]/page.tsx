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
    include: { user: { include: { supervisor: { select: { name: true, email: true } } } } }
  });

  if (!pds) return <div className="p-10 text-center font-bold text-slate-500 uppercase tracking-widest">PDS-Dokument nicht gefunden.</div>;

  const isAdminOrGod = ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ARCHITECT'].includes(currentUser?.role || '');

  // Zaštita: korisnici koji nisu admini ne smiju otvarati tuđe PDS zapise.
  if (!isAdminOrGod && pds.userId !== currentUser?.id) {
    return <div className="p-10 text-center font-bold text-slate-500 uppercase tracking-widest">Kein Zugriff auf dieses PDS-Dokument.</div>;
  }

  // \"Menadžerska\" strana (desni dio) dostupna je samo ADMIN / SUPER_ADMIN / SYSTEM_ARCHITECT.
  const isManager = isAdminOrGod;
  const safePds = JSON.parse(JSON.stringify(pds));

  // FIX: Ne šaljemo više currentUserEmail
  return <PDSFormClient pds={safePds} isManager={isManager} />;
}