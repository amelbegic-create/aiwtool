"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2 } from "lucide-react";
// Uvozimo Google Font direktno kroz Next.js
import { Kanit } from "next/font/google";

// Konfiguracija fonta (koristimo deblje varijante 600 i 900)
const brandFont = Kanit({ 
  subsets: ["latin"], 
  weight: ["600", "800", "900"] 
});

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await signIn("credentials", { 
      email, 
      password, 
      redirect: false 
    });

    if (result?.error) {
      alert("Neispravni podaci. Provjerite email i lozinku.");
      setLoading(false);
    } else {
      router.push("/select-restaurant"); 
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-[#1a3826] flex items-center justify-center p-4">
      <div className="bg-white p-8 md:p-12 rounded-[2.5rem] w-full max-w-[420px] shadow-2xl animate-in zoom-in duration-300 border-4 border-[#1a3826]/5 relative overflow-hidden">
        
        {/* HEADER - NOVI FONT I VELIČINA */}
        <div className="text-center mb-10 relative z-10">
          <div className={`flex flex-col items-center leading-none select-none ${brandFont.className}`}>
             {/* AIW TEKST */}
             <h1 className="text-7xl font-[900] tracking-tighter text-[#1a3826] drop-shadow-sm">
                AIW
             </h1>
             {/* SERVICES TEKST - POVEĆAN */}
             <p className="text-3xl text-[#FFC72C] font-[800] tracking-widest uppercase mt-0 drop-shadow-sm">
                Services
             </p>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-6 font-sans">
            Prijava na sistem
          </p>
        </div>

        {/* LOGIN FORMA */}
        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#1a3826] transition-colors" size={20} />
            <input 
                type="email" 
                placeholder="Email adresa" 
                required 
                disabled={loading}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-[#FFC72C] focus:bg-white text-slate-700 font-bold transition-all disabled:opacity-50" 
            />
          </div>
          
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#1a3826] transition-colors" size={20} />
            <input 
                type="password" 
                placeholder="Lozinka" 
                required 
                disabled={loading}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-[#FFC72C] focus:bg-white text-slate-700 font-bold transition-all disabled:opacity-50" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-[#1a3826] text-white font-black py-4 rounded-2xl uppercase text-xs tracking-[0.15em] hover:bg-[#142d1f] hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : "Prijavi se"}
          </button>
        </form>

        <div className="mt-8 text-center">
             <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Powered by AIWTool Enterprise</p>
        </div>

      </div>
    </div>
  );
}