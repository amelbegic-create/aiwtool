import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getPartners, getPartnerCategories } from "@/app/actions/partnerActions";
import PartnersToolClient from "./PartnersToolClient";

export default async function PartnersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-muted-foreground">
        Prijavite se.
      </div>
    );
  }

  // Pristup imaju svi prijavljeni korisnici (lista partnera je vidljiva svima)
  const [partners, categories] = await Promise.all([getPartners(), getPartnerCategories()]);
  return (
    <div className="min-h-screen bg-background">
      <PartnersToolClient initialPartners={partners} initialCategories={categories} />
    </div>
  );
}
