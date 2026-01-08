"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, AlertCircle } from "lucide-react";
import { loginUser } from "@/app/actions/auth"; // Importujemo akciju

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    
    // Pozivamo Server Action
    const result = await loginUser(formData);

    if (result.success && result.user) {
      // --- KLJUČNI DIO: SPREMAMO PODATKE O KORISNIKU ---
      localStorage.setItem("user_id", result.user.id);
      localStorage.setItem("user_role", result.user.role);
      localStorage.setItem("user_name", result.user.name || "");
      localStorage.setItem("user_dept", result.user.department || "");
      
      // Spremamo listu dozvoljenih restorana kao JSON string
      localStorage.setItem("allowed_restaurants", JSON.stringify(result.user.allowedRestaurants));

      // Preusmjeri
      router.push("/select-restaurant");
    } else {
      setError(result.error || "Greška pri prijavi.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a3826] flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Dekoracija */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[#FFC72C] rounded-full blur-[150px] opacity-10"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-emerald-400 rounded-full blur-[150px] opacity-5"></div>
      </div>

      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl relative z-10">
        
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="AIWTool Logo" className="h-48 w-auto object-contain mb-6" />
          <h1 className="text-3xl font-black text-[#1a3826] uppercase tracking-tight">AIWTool</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Enterprise Login</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2">
              <AlertCircle size={18}/> {error}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Email Adresa</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input name="email" type="email" required className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1a3826]" placeholder="ime@mcd.ba" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Lozinka</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input name="password" type="password" required className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1a3826]" placeholder="••••••••" />
            </div>
          </div>

          <button disabled={loading} className="w-full bg-[#1a3826] hover:bg-[#234a33] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <>Prijavi se <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6 font-medium">© 2026 AIWTool Enterprise.</p>
      </div>
    </div>
  );
}