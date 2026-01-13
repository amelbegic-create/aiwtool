"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Camera, Lock, Mail, User, Save, Building, ShieldCheck } from "lucide-react";

export default function ProfilePage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  
  // Ref za skriveni file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // POPRAVAK LOOP GRESKE:
  // Provjeravamo da li se slika promijenila prije nego sto pozovemo setPreviewImage
  useEffect(() => {
    if (session?.user?.image && previewImage !== session.user.image) {
        setPreviewImage(session.user.image);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]); 

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Ova funkcija otvara prozor za biranje fajlova
  const handleImageClick = () => {
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const objectUrl = URL.createObjectURL(file);
        setPreviewImage(objectUrl);
        // Ovdje kasnije dodaj logiku za upload na server
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
        alert("Nove lozinke se ne podudaraju!");
        return;
    }
    setIsLoading(true);
    // Simulacija API poziva
    setTimeout(() => {
        setIsLoading(false);
        setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        alert("Podaci su uspješno ažurirani!");
    }, 1500);
  };

  // Helper za prikaz role (boje i tekst)
  const getRoleBadge = (role: string | undefined) => {
    const r = role || "CREW";
    switch (r) {
        case "SUPER_ADMIN":
        case "SYSTEM_ARCHITECT":
            return { label: "System Admin", bg: "bg-purple-100", text: "text-purple-700" };
        case "ADMIN":
            return { label: "Administrator", bg: "bg-emerald-100", text: "text-emerald-700" };
        case "MANAGER":
            return { label: "Manager", bg: "bg-blue-100", text: "text-blue-700" };
        default:
            return { label: "Zaposlenik", bg: "bg-slate-100", text: "text-slate-600" };
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole = (session?.user as any)?.role;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userDepartment = (session?.user as any)?.department || "Opći Odjel";
  const roleStyle = getRoleBadge(userRole);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto">
        
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#1a3826] uppercase tracking-tighter">Moj Profil</h1>
            <p className="text-slate-500 font-medium">Upravljajte svojim ličnim podacima i sigurnošću.</p>
          </div>
          <div className={`px-4 py-2 rounded-xl flex items-center gap-2 ${roleStyle.bg} ${roleStyle.text} font-bold text-sm uppercase tracking-wide`}>
            <ShieldCheck size={18} />
            {roleStyle.label}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
          {/* LIJEVA STRANA - KARTICA PROFILA */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-slate-50 to-white z-0"></div>
                
                {/* OMOTAČ ZA SLIKU - KLIKABILAN */}
                <div 
                    onClick={handleImageClick}
                    className="relative group cursor-pointer mb-6 w-32 h-32 z-10"
                >
                    <div className="w-full h-full rounded-full bg-white border-4 border-white shadow-xl overflow-hidden flex items-center justify-center relative">
                        {previewImage ? (
                            <img src={previewImage} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={48} className="text-slate-300" />
                        )}
                    </div>
                    
                    {/* OVERLAY KOJI SE POJAVI NA HOVER */}
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm">
                        <Camera className="text-white" size={24} />
                    </div>

                    {/* SKRIVENI INPUT */}
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*"
                        className="hidden" 
                        onChange={handleFileChange}
                    />
                    <div className="absolute bottom-0 right-0 bg-[#FFC72C] p-2 rounded-full border-4 border-white shadow-sm">
                        <Camera size={14} className="text-[#1a3826]" />
                    </div>
                </div>

                <h2 className="text-xl font-black text-slate-800 mb-1">{session?.user?.name || "Korisnik"}</h2>
                <p className="text-sm text-slate-400 font-medium mb-6">{session?.user?.email}</p>
                
                <div className="w-full pt-6 border-t border-slate-50 space-y-3">
                    <div className="flex items-center justify-between text-sm p-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2 text-slate-500">
                            <Building size={16} />
                            <span className="font-bold text-xs uppercase">Odjel</span>
                        </div>
                        <span className="font-black text-slate-700">{userDepartment}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm p-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2 text-slate-500">
                            <ShieldCheck size={16} />
                            <span className="font-bold text-xs uppercase">Status</span>
                        </div>
                        <span className="font-black text-emerald-600">Aktivan</span>
                    </div>
                </div>
            </div>
          </div>

          {/* DESNA STRANA - FORMA */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSave} className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 h-full">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-50">
                    <div className="p-3 bg-[#1a3826] rounded-xl text-white">
                        <Lock size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Sigurnost Računa</h3>
                        <p className="text-xs text-slate-400 font-medium">Ažurirajte lozinku i lične podatke</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Ime i Prezime</label>
                            <div className="relative group">
                                <User size={18} className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-[#1a3826] transition-colors" />
                                <input type="text" disabled value={session?.user?.name || ""} className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-slate-500 text-sm font-bold focus:outline-none cursor-not-allowed opacity-70"/>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Email Adresa</label>
                            <div className="relative group">
                                <Mail size={18} className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-[#1a3826] transition-colors" />
                                <input type="email" disabled value={session?.user?.email || ""} className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-slate-500 text-sm font-bold focus:outline-none cursor-not-allowed opacity-70"/>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100 my-2"></div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Trenutna Lozinka</label>
                        <input 
                            type="password" 
                            value={formData.currentPassword} 
                            onChange={(e) => setFormData({...formData, currentPassword: e.target.value})} 
                            className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-slate-800 text-sm font-bold focus:border-[#1a3826] focus:ring-0 outline-none transition-all placeholder:text-slate-300 placeholder:font-normal" 
                            placeholder="Unesite vašu trenutnu lozinku za potvrdu"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Nova Lozinka</label>
                            <input 
                                type="password" 
                                value={formData.newPassword} 
                                onChange={(e) => setFormData({...formData, newPassword: e.target.value})} 
                                className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-slate-800 text-sm font-bold focus:border-[#FFC72C] focus:ring-0 outline-none transition-all placeholder:text-slate-300 placeholder:font-normal" 
                                placeholder="Min. 8 karaktera"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Potvrdi Lozinku</label>
                            <input 
                                type="password" 
                                value={formData.confirmPassword} 
                                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} 
                                className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-slate-800 text-sm font-bold focus:border-[#FFC72C] focus:ring-0 outline-none transition-all placeholder:text-slate-300 placeholder:font-normal" 
                                placeholder="Ponovite novu lozinku"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-10 flex justify-end">
                    <button type="submit" disabled={isLoading} className="flex items-center gap-2 bg-[#1a3826] text-white px-8 py-3.5 rounded-xl font-black uppercase text-xs tracking-wider hover:bg-[#142d1f] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed">
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Spremanje...
                            </span>
                        ) : (
                            <><Save size={18} /> Sačuvaj Promjene</>
                        )}
                    </button>
                </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}