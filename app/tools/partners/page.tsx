import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
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

  const access = await tryRequirePermission("partners:access");
  if (!access.ok) {
    return <NoPermission moduleName="Firmen und Partner" />;
  }

  const [partners, categories] = await Promise.all([getPartners(), getPartnerCategories()]);
  return (
    <div className="min-h-screen bg-background">
      <PartnersToolClient initialPartners={partners} initialCategories={categories} />
    </div>
  );
}
