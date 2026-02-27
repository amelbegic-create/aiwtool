"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { Kanit } from "next/font/google";
import { dict } from "@/translations";
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

  const timeoutLogout =
    searchParams.get("timeout") === "true" ||
    searchParams.get("reason") === "inactivity" ||
    searchParams.get("error") === "SessionRequired";
  const [dismissTimeoutAlert, setDismissTimeoutAlert] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "CredentialsSignin") {
      alert(dict.login_error_credentials);
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
      alert(dict.login_error_generic);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel – brand */}
      <div
        className="hidden md:flex md:w-[44%] lg:w-[42%] flex-col justify-between bg-[#1a3826] p-10 lg:p-14"
        style={{
          backgroundImage: `linear-gradient(135deg, #1a3826 0%, #0c1f15 100%)`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div>
          <div
            className={`${brandFont.className} aiw-logo-enter text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-white tracking-tight`}
            suppressHydrationWarning
          >
            AIW <span className="text-[#FFC72C]">Services</span>
          </div>
        </div>
        <p className="text-emerald-200/40 text-xs font-medium" suppressHydrationWarning>
          © {new Date().getFullYear()} AIW Services
        </p>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="md:hidden text-center mb-10" suppressHydrationWarning>
            <div className={`${brandFont.className} aiw-logo-enter text-3xl font-black text-[#1a3826] dark:text-white tracking-tight`}>
              AIW <span className="text-[#FFC72C]">Services</span>
            </div>
          </div>

          {timeoutLogout && !dismissTimeoutAlert && (
            <div
              role="alert"
              className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/60 px-4 py-4 shadow-sm"
            >
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                {dict.login_timeout_title}
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                {dict.login_timeout_subtitle}
              </p>
              <button
                type="button"
                onClick={() => setDismissTimeoutAlert(true)}
                className="mt-3 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {dict.login_timeout_button}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                E-Mail-Adresse
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
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
                             bg-card border border-border text-foreground placeholder:text-muted-foreground
                             text-[15px] font-medium
                             focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826]
                             transition-shadow transition-colors duration-150
                             disabled:opacity-50 disabled:cursor-not-allowed
                             shadow-sm hover:border-border"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Passwort
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
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
                             bg-card border border-border text-foreground placeholder:text-muted-foreground
                             text-[15px] font-medium
                             focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826]
                             transition-shadow transition-colors duration-150
                             disabled:opacity-50 disabled:cursor-not-allowed
                             shadow-sm hover:border-border"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md
                             text-muted-foreground hover:text-foreground hover:bg-accent
                             transition-colors"
                  aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link
                href="/login/zaboravljena-lozinka"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <KeyRound size={14} />
                Passwort vergessen?
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
                  {dict.login_btn_loading}
                </span>
              ) : (
                dict.login_btn_label
              )}
            </button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            Verwenden Sie Ihre offiziellen Zugangsdaten
          </p>
        </div>
      </div>
    </div>
  );
}
