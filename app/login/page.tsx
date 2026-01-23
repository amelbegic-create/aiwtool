"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, Loader2, Eye, EyeOff, Sparkles } from "lucide-react";
import { Kanit } from "next/font/google";

const brandFont = Kanit({
  subsets: ["latin"],
  weight: ["600", "800", "900"],
});

// ✅ Postavi novi default landing nakon logina
const DEFAULT_AFTER_LOGIN = "/dashboard"; // ili "/profile"

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // UI-only (ne dira logiku)
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      alert("Neispravni podaci. Provjerite email i lozinku.");
      setLoading(false);
      return;
    }

    // ✅ Uhvati callbackUrl ako postoji
    const rawCb = searchParams.get("callbackUrl");
    const decodedCb = rawCb ? decodeURIComponent(rawCb) : "";

    // ✅ Ako je stari /select-restaurant (legacy), preusmjeri na novi landing
    const target =
      !decodedCb || decodedCb.startsWith("/select-restaurant")
        ? DEFAULT_AFTER_LOGIN
        : decodedCb;

    // ✅ replace (bolje nego push) da ne ostane /login u historiji
    router.replace(target);
    router.refresh();
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0c1f15]">
      {/* Background: soft gradients + subtle grid */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -bottom-48 -right-48 h-[620px] w-[620px] rounded-full bg-yellow-400/12 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#ffffff1a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff1a_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-[460px]">
          {/* Top brand badge */}
          <div className="mb-4 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.25em] text-emerald-50/80">
              <Sparkles size={14} className="text-yellow-300/90" />
              Secure Sign-In
            </div>
          </div>

          {/* Card */}
          <div className="relative rounded-[2.5rem] border border-white/10 bg-white/7 backdrop-blur-xl shadow-[0_30px_90px_-35px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* Card shine */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-24 left-1/2 h-48 w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute inset-0 opacity-[0.18] [background:radial-gradient(1200px_500px_at_20%_-10%,rgba(255,255,255,0.18),transparent_55%)]" />
            </div>

            <div className="relative z-10 p-8 md:p-10">
              {/* Header */}
              <div className="text-center mb-8">
                <div className={`flex flex-col items-center leading-none select-none ${brandFont.className}`}>
                  <h1 className="text-7xl md:text-7xl font-[900] tracking-tighter text-white drop-shadow-sm">
                    AIW
                  </h1>
                  <p className="text-3xl md:text-[32px] text-[#FFC72C] font-[800] tracking-widest uppercase mt-0 drop-shadow-sm">
                    Services
                  </p>
                </div>

                <p className="mt-5 text-[11px] text-emerald-50/55 font-bold uppercase tracking-[0.35em]">
                  Prijava na sistem
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div className="group relative">
                  <div className="absolute inset-0 rounded-2xl bg-white/5 opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <Mail
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35 group-focus-within:text-[#FFC72C] transition-colors"
                    size={20}
                  />
                  <input
                    type="email"
                    placeholder="Email adresa"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="relative w-full pl-12 pr-4 py-4 rounded-2xl outline-none
                               bg-white/5 border border-white/10
                               text-white placeholder:text-white/35 font-bold
                               focus:border-[#FFC72C]/70 focus:bg-white/7
                               transition-all disabled:opacity-50"
                  />
                </div>

                {/* Password */}
                <div className="group relative">
                  <div className="absolute inset-0 rounded-2xl bg-white/5 opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35 group-focus-within:text-[#FFC72C] transition-colors"
                    size={20}
                  />

                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Lozinka"
                    required
                    disabled={loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="relative w-full pl-12 pr-12 py-4 rounded-2xl outline-none
                               bg-white/5 border border-white/10
                               text-white placeholder:text-white/35 font-bold
                               focus:border-[#FFC72C]/70 focus:bg-white/7
                               transition-all disabled:opacity-50"
                  />

                  {/* show/hide (UI only) */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2
                               h-10 w-10 rounded-xl border border-white/10
                               bg-white/5 hover:bg-white/10 transition
                               flex items-center justify-center
                               text-white/60 hover:text-white"
                    aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full relative overflow-hidden rounded-2xl py-4
                             bg-[#FFC72C] text-[#0c1f15]
                             font-black uppercase text-xs tracking-[0.18em]
                             shadow-[0_14px_40px_-18px_rgba(255,199,44,0.85)]
                             hover:shadow-[0_18px_60px_-20px_rgba(255,199,44,0.95)]
                             hover:translate-y-[-1px] active:translate-y-[0px]
                             transition-all disabled:opacity-60 disabled:cursor-not-allowed
                             flex items-center justify-center gap-2"
                >
                  <span className="absolute inset-0 opacity-30 [background:linear-gradient(110deg,transparent,rgba(255,255,255,0.7),transparent)] translate-x-[-120%] hover:translate-x-[120%] transition-transform duration-700" />
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Prijavljivanje…</span>
                    </>
                  ) : (
                    "Prijavi se"
                  )}
                </button>

                {/* Small helper */}
                <div className="pt-2 text-center">
                  <p className="text-[11px] text-white/40 font-semibold">
                    Koristi službene pristupne podatke za pristup sistemu.
                  </p>
                </div>
              </form>

              {/* Footer */}
              <div className="mt-8 text-center">
                <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest">
                  Powered by AIWTool Enterprise
                </p>
              </div>
            </div>
          </div>

          {/* Bottom tiny note */}
          <div className="mt-5 text-center">
            <p className="text-[10px] text-emerald-50/30 font-bold tracking-wide">
              © {new Date().getFullYear()} AIW Services
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
