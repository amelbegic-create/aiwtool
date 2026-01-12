import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";

// OVO JE KLJUČNO: ./ znači "traži u ovom istom folderu"
import LoginForm from "./LoginForm"; 

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/tools/productivity");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <LoginForm />
    </main>
  );
}