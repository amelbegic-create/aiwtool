import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { getSitzplanForUser } from "@/app/actions/sitzplanActions";
import SitzplanClient from "./SitzplanClient";

export default async function SitzplanPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const data = await getSitzplanForUser();

  return (
    <SitzplanClient
      sitzplanPdfUrl={data?.sitzplanPdfUrl ?? null}
      restaurantName={data?.restaurantName ?? "Restaurant"}
    />
  );
}
