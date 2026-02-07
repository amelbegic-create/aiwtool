"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { Kanit } from "next/font/google";

const brandFont = Kanit({
  subsets: ["latin"],
  weight: ["600", "800", "900"],
});

const DEFAULT_AFTER_LOGIN = "/dashboard";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get("callbackUrl");
  const safeCallbackUrl =
    callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : DEFAULT_AFTER_LOGIN;

  useEffect(() => {
    if (searchParams.get("error") === "CredentialsSignin") {
      alert("Neispravni podaci. Provjerite email i lozinku.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      // redirect: true = NextAuth šalje 302 + Set-Cookie u istom odgovoru (pouzdano na Vercelu)
      await signIn("credentials", {
        email,
        password,
        callbackUrl: safeCallbackUrl,
        redirect: true,
      });
    } catch {
      alert("Greška pri prijavi. Pokušajte ponovo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel – brand */}
      <div
        className="hidden md:flex md:w-[44%] lg:w-[42%] flex-col justify-between bg-[#1a3826] p-10 lg:p-14"
        style={{
          backgroundImage: `linear-gradient(135deg, #1a3826 0%, #0c1f15 100%)`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div>
          <div className={`${brandFont.className} text-3xl font-black text-white tracking-tight`}>
            AIW <span className="text-[#FFC72C]">Services</span>
          </div>
          <div className="mt-12 space-y-8">
            <p className="text-emerald-100/90 text-lg font-medium leading-relaxed max-w-sm">
              Enterprise Management System za McDonald&apos;s operacije.
            </p>
            <div className="h-px w-16 bg-[#FFC72C]/40 rounded-full" />
            <p className="text-emerald-200/60 text-sm font-medium">
              Prijavite se sa službenim pristupnim podacima.
            </p>
          </div>
        </div>
        <p className="text-emerald-200/40 text-xs font-medium">
          © {new Date().getFullYear()} AIW Services
        </p>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="md:hidden text-center mb-10">
            <div className={`${brandFont.className} text-3xl font-black text-[#1a3826] tracking-tight`}>
              AIW <span className="text-[#FFC72C]">Services</span>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Dobrodošli
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Prijavite se na svoj račun
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  size={18}
                  strokeWidth={2}
                />
                <input
                  id="email"
                  type="email"
                  placeholder="ime@mcdonalds.ba"
                  required
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 min-h-[44px] rounded-lg
                             bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400
                             text-[15px] font-medium
                             focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826]
                             transition-shadow transition-colors duration-150
                             disabled:opacity-50 disabled:cursor-not-allowed
                             shadow-sm hover:border-slate-300"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Lozinka
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  size={18}
                  strokeWidth={2}
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 min-h-[44px] rounded-lg
                             bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400
                             text-[15px] font-medium
                             focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826]
                             transition-shadow transition-colors duration-150
                             disabled:opacity-50 disabled:cursor-not-allowed
                             shadow-sm hover:border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md
                             text-slate-400 hover:text-slate-600 hover:bg-slate-100
                             transition-colors"
                  aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link
                href="/login/zaboravljena-lozinka"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#1a3826] transition-colors"
              >
                <KeyRound size={14} />
                Zaboravljena lozinka?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 min-h-[44px] rounded-lg
                         bg-[#1a3826] text-white font-semibold text-[15px]
                         hover:bg-[#0c1f15] active:scale-[0.99]
                         focus:outline-none focus:ring-2 focus:ring-[#1a3826]/30 focus:ring-offset-2
                         transition-all duration-150
                         disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100
                         shadow-md shadow-emerald-900/20 hover:shadow-lg hover:shadow-emerald-900/25"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  Prijavljivanje…
                </span>
              ) : (
                "Prijavi se"
              )}
            </button>
          </form>

          <p className="mt-10 text-xs text-slate-400 text-center">
            Koristi službene pristupne podatke
          </p>
        </div>
      </div>
    </div>
  );
}
