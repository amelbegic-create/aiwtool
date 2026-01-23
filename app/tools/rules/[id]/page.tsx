// app/tools/rules/[id]/page.tsx
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import RuleDetailClient from "./RuleDetailClient";
import { notFound } from "next/navigation";

// Next.js 15: params is a Promise
export default async function RuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return <div className="p-10 text-center font-bold">Molimo prijavite se.</div>;

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user)
    return (
      <div className="p-10 text-center font-bold">Korisnik nije pronađen.</div>
    );

  const rule = await prisma.rule.findUnique({
    where: { id },
    include: {
      category: true,
      images: true,
      restaurants: true,
      readReceipts: { where: { userId: user.id } },
    },
  });

  if (!rule) return notFound();

  const formattedRule = {
    ...rule,
    isRead: rule.readReceipts.length > 0,
  };

  return <RuleDetailClient rule={formattedRule} userId={user.id} />;
}
