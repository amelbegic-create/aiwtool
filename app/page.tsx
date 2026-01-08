import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";

export default async function Home() {
  // Provjeravamo da li je korisnik već prijavljen
  const session = await getServerSession(authOptions);

  if (session) {
    // Ako JESTE prijavljen -> šaljemo ga odmah na Dashboard
    redirect("/dashboard");
  } else {
    // Ako NIJE prijavljen -> šaljemo ga na Login
    redirect("/login");
  }
}