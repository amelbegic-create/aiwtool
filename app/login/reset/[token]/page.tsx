"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { Kanit } from "next/font/google";

const brandFont = Kanit({ subsets: ["latin"], weight: ["600", "800", "900"] });

export default function ResetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password.length < 6) {
      setError("Lozinka mora imati najmanje 6 znakova.");
      return;
    }
    if (password !== confirm) {
      setError("Lozinke se ne podudaraju.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Greška. Link možda ističe. Zatražite novi reset.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Greška pri povezivanju. Pokušajte ponovo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0c1f15]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[400px] w-[400px] rounded-full bg-[#FFC72C]/10 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-[420px]">
          <Link
            href="/login"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-200/80 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} /> Nazad na prijavu
          </Link>

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-xl">
            <div className="text-center mb-6">
              <div className={`${brandFont.className} text-4xl font-black text-white`}>AIW</div>
              <p className="text-[#FFC72C] text-lg font-bold tracking-wider uppercase mt-1">Services</p>
              <p className="mt-4 text-sm font-medium text-emerald-100/80 uppercase tracking-widest">
                Nova lozinka
              </p>
            </div>

            {success ? (
              <div className="text-center py-4">
                <CheckCircle className="mx-auto mb-4 text-emerald-400" size={48} />
                <p className="text-white font-medium mb-2">Lozinka je uspješno promijenjena.</p>
                <p className="text-sm text-emerald-200/70">Preusmjeravanje na prijavu…</p>
                <Link
                  href="/login"
                  className="mt-6 inline-block rounded-xl bg-[#FFC72C] text-[#0c1f15] px-6 py-3 font-bold text-sm hover:bg-[#FFD54F] transition-colors"
                >
                  Prijavi se
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-200/70 uppercase tracking-wider mb-2">
                    Nova lozinka (min. 6 znakova)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                    <input
                      type="password"
                      placeholder="••••••••"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 font-medium focus:outline-none focus:border-[#FFC72C]/50 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-200/70 uppercase tracking-wider mb-2">
                    Potvrdi lozinku
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                    <input
                      type="password"
                      placeholder="••••••••"
                      required
                      minLength={6}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      disabled={loading}
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 font-medium focus:outline-none focus:border-[#FFC72C]/50 disabled:opacity-50"
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-red-400 font-medium">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-[#FFC72C] text-[#0c1f15] font-bold hover:bg-[#FFD54F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Spremanje…
                    </>
                  ) : (
                    "Postavi novu lozinku"
                  )}
                </button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-[10px] text-emerald-50/40">
            © {new Date().getFullYear()} AIW Services
          </p>
        </div>
      </div>
    </div>
  );
}
