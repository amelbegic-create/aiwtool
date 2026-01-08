import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import TopNavbar from "@/components/TopNavbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AIWTool Enterprise",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-slate-900`}>
        <Providers>
          <div className="flex flex-col h-screen overflow-hidden">
            <TopNavbar />
            <main className="flex-1 overflow-y-auto bg-white">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}