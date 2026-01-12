import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
// Putanja mora biti točna. Ako je components u rootu:
import LoginForm from "../components/LoginForm"; 

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/tools/PDS");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <LoginForm />
    </main>
  );
}