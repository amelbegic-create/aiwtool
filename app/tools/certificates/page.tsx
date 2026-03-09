import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getCertificatesForUser } from "@/app/actions/certificateActions";
import CertificatesPageClient from "./CertificatesPageClient";

type SessionUser = { id?: string };

export default async function CertificatesPage() {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as SessionUser)?.id;

  if (!sessionUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-muted-foreground">
        Bitte melden Sie sich an.
      </div>
    );
  }

  const result = await getCertificatesForUser(sessionUserId);
  const certificates = result.ok ? result.data : [];

  return (
    <div className="min-h-screen bg-background">
      <CertificatesPageClient certificates={certificates} />
    </div>
  );
}
