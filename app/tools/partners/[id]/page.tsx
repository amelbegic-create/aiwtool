import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import Image from "next/image";
import { authOptions } from "@/lib/authOptions";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getPartners, getPartnerCategories } from "@/app/actions/partnerActions";
import {
  Building2,
  Phone,
  Mail,
  Globe,
  ChevronRight,
  UserCircle,
  ArrowLeft,
  FileText,
  Download,
  Share2,
} from "lucide-react";
import PartnerDetailClient from "./PartnerDetailClient";

function normalizeWebsiteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default async function PartnerDetailPage({ params }: { params: { id: string } }) {
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

  const [partners] = await Promise.all([getPartners(), getPartnerCategories()]);
  const partner = partners.find((p) => p.id === params.id);
  if (!partner) notFound();

  const websiteUrl = normalizeWebsiteUrl((partner as { websiteUrl?: string | null }).websiteUrl);
  const galleryUrls: string[] = Array.isArray((partner as { galleryUrls?: string[] }).galleryUrls)
    ? (partner as { galleryUrls: string[] }).galleryUrls
    : [];
  const priceListPdfUrl = (partner as { priceListPdfUrl?: string | null }).priceListPdfUrl ?? null;

  const partnerData = {
    id: partner.id,
    companyName: partner.companyName,
    category: partner.category,
    logoUrl: partner.logoUrl,
    serviceDescription: partner.serviceDescription,
    notes: partner.notes,
    websiteUrl,
    galleryUrls,
    priceListPdfUrl,
    contacts: partner.contacts,
  };

  return <PartnerDetailClient partner={partnerData} />;
}
