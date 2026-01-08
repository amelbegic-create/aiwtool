import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// Importujemo TopNavbar
import TopNavbar from "@/components/TopNavbar";

const inter = Inter({ subsets: ["latin"] });

// --- OVDJE SMO PROMIJENILI NAZIV ---
export const metadata: Metadata = {
  title: "AIWTool Enterprise",
  description: "Interni alati za upravljanje restoranom",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900 flex flex-col h-screen overflow-hidden`}>
        
        {/* Navigacija na vrhu */}
        <TopNavbar />

        {/* Glavni sadržaj */}
        <main className="flex-1 overflow-auto w-full relative">
          {children}
        </main>

      </body>
    </html>
  );
}