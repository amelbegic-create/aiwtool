import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import {
  getPartnerForDetail,
  getPartnerCategories,
  getPartnerComments,
} from "@/app/actions/partnerActions";
import PartnerDetailClient from "./PartnerDetailClient";
import prisma from "@/lib/prisma";

function normalizeWebsiteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const COMMENT_ROLES = ["SYSTEM_ARCHITECT", "ADMIN", "MANAGER"] as const;
const COMMENT_DELETE_ROLES = ["SYSTEM_ARCHITECT", "ADMIN"] as const;

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

  // Fetch user role for comment access control
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  const userRole = dbUser?.role ?? "MITARBEITER";
  const canSeeComments = COMMENT_ROLES.includes(
    userRole as (typeof COMMENT_ROLES)[number]
  );
  const canDeleteComments = COMMENT_DELETE_ROLES.includes(
    userRole as (typeof COMMENT_DELETE_ROLES)[number]
  );

  const [partner, _categories, initialComments] = await Promise.all([
    getPartnerForDetail(params.id),
    getPartnerCategories(),
    canSeeComments ? getPartnerComments(params.id) : Promise.resolve([]),
  ]);
  if (!partner) notFound();

  const websiteUrl = normalizeWebsiteUrl((partner as { websiteUrl?: string | null }).websiteUrl);
  const galleryUrls: string[] = Array.isArray((partner as { galleryUrls?: string[] }).galleryUrls)
    ? (partner as { galleryUrls: string[] }).galleryUrls
    : [];
  const priceListPdfUrl = (partner as { priceListPdfUrl?: string | null }).priceListPdfUrl ?? null;
  const documents = Array.isArray(
    (partner as { documents?: Array<{ fileUrl: string; fileName: string; fileType: string }> }).documents
  )
    ? (partner as { documents: Array<{ fileUrl: string; fileName: string; fileType: string }> }).documents
    : [];

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
    documents,
    contacts: partner.contacts,
  };

  return (
    <PartnerDetailClient
      partner={partnerData}
      canSeeComments={canSeeComments}
      canDeleteComments={canDeleteComments}
      initialComments={initialComments}
    />
  );
}
