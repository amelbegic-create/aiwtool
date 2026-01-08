import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import TopNavbar from "@/components/TopNavbar";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} bg-white text-slate-900 flex flex-col h-screen overflow-hidden`}>
        <Providers>
          {/* Gornja navigacija sa tvojim kategorijama */}
          <TopNavbar />

          <main className="flex-1 overflow-auto w-full relative bg-white">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}