import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getSitzplanForUser } from "@/app/actions/sitzplanActions";
import SitzplanClient from "./SitzplanClient";

export default async function SitzplanPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const data = await getSitzplanForUser();
  const pdfs = data?.sitzplanPdfs ?? [];

  if (pdfs.length > 1) {
    redirect("/tools/sitzplan/waehlen");
  }

  return (
    <SitzplanClient
      sitzplanPdfUrl={pdfs[0]?.url ?? null}
      restaurantName={data?.restaurantName ?? "Restaurant"}
    />
  );
}
