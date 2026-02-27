import { notFound } from "next/navigation";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getPartnerById, getPartnerCategories } from "@/app/actions/partnerActions";
import PartnerFormClient from "../../_components/PartnerFormClient";

export default async function EditPartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await tryRequirePermission("partners:manage");
  if (!access.ok) {
    return <NoPermission moduleName="Firmen und Partner" />;
  }

  const { id } = await params;
  const [partner, categories] = await Promise.all([getPartnerById(id), getPartnerCategories()]);

  if (!partner) notFound();

  return (
    <PartnerFormClient
      categories={categories}
      initialData={{
        id: partner.id,
        categoryId: partner.categoryId,
        companyName: partner.companyName,
        logoUrl: partner.logoUrl,
        serviceDescription: partner.serviceDescription,
        notes: partner.notes,
        websiteUrl: partner.websiteUrl,
        priceListPdfUrl: partner.priceListPdfUrl ?? null,
        galleryUrls: partner.galleryUrls ?? [],
        contacts: partner.contacts,
      }}
    />
  );
}
