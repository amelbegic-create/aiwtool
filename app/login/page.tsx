"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2 } from "lucide-react";

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
      alert("Neispravni podaci za prijavu. Pokušajte ponovo.");
      setLoading(false);
    } else {
      router.push("/select-restaurant");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-[#1a3826] flex items-center justify-center p-4">
      {/* Centralna karta logina */}
      <div className="bg-white p-8 md:p-12 rounded-[3rem] w-full max-w-[450px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in duration-500">
        
        {/* Logo i Naslov */}
        <div className="text-center mb-10">
          <div className="inline-block p-3 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
            <img src="/logo.png" className="h-14 w-auto object-contain" alt="Logo" />
          </div>
          <h1 className="text-2xl font-black text-[#1a3826] uppercase tracking-tighter">
            AIWTool <span className="text-[#FFC72C]">Enterprise</span>
          </h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">
            Autorizovani Pristup Sistemu
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Polje */}
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#1a3826] transition-colors">
              <Mail size={18} />
            </div>
            <input 
              type="email" 
              placeholder="Email Adresa" 
              required 
              className="w-full pl-14 pr-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#1a3826]/10 focus:bg-white font-bold text-slate-700 transition-all" 
              onChange={e => setEmail(e.target.value)} 
            />
          </div>

          {/* Password Polje */}
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#1a3826] transition-colors">
              <Lock size={18} />
            </div>
            <input 
              type="password" 
              placeholder="Lozinka" 
              required 
              className="w-full pl-14 pr-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-[#1a3826]/10 focus:bg-white font-bold text-slate-700 transition-all" 
              onChange={e => setPassword(e.target.value)} 
            />
          </div>

          {/* Dugme za prijavu */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#1a3826] text-white font-black py-4 rounded-2xl uppercase text-xs tracking-[0.2em] hover:bg-[#FFC72C] hover:text-[#1a3826] transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              "Prijavi se na sistem"
            )}
          </button>
        </form>

        {/* Footer logina */}
        <div className="mt-10 text-center">
          <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">
            © 2024 AIWTool Systems • Sva prava pridržana
          </p>
        </div>
      </div>
    </div>
  );
}