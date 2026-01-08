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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <TopNavbar />
          <main className="h-screen overflow-hidden">{children}</main>
        </Providers>
      </body>
    </html>
  );
}