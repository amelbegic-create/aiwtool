import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getSitzplanForUser } from "@/app/actions/sitzplanActions";
import SitzplanWaehlenClient from "./SitzplanWaehlenClient";

export default async function SitzplanWaehlenPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const data = await getSitzplanForUser();
  const pdfs = Array.isArray(data?.sitzplanPdfs) ? data.sitzplanPdfs : [];

  if (pdfs.length <= 1) {
    redirect("/tools/sitzplan");
  }

  return (
    <SitzplanWaehlenClient
      pdfs={pdfs}
      restaurantName={data?.restaurantName ?? "Restaurant"}
    />
  );
}
