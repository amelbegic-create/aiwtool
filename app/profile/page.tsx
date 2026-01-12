"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Camera, Lock, Mail, User, Save, Building } from "lucide-react";

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
    setTimeout(() => {
        setIsLoading(false);
        setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        alert("Podaci su spašeni!");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#1a3826] uppercase tracking-tight">Moj Profil</h1>
          <p className="text-slate-500">Upravljajte svojim postavkama i sigurnošću.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
          {/* LIJEVA STRANA - SLIKA */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center text-center">
                
                {/* OMOTAČ ZA SLIKU - KLIKABILAN */}
                <div 
                    onClick={handleImageClick}
                    className="relative group cursor-pointer mb-4 w-32 h-32"
                >
                    <div className="w-full h-full rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center relative z-0">
                        {previewImage ? (
                            <img src={previewImage} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={48} className="text-slate-300" />
                        )}
                    </div>
                    
                    {/* OVERLAY KOJI SE POJAVI NA HOVER */}
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Camera className="text-white" size={24} />
                    </div>

                    {/* SKRIVENI INPUT - OVO JE KLJUCNO */}
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*"
                        className="hidden" 
                        onChange={handleFileChange}
                    />
                </div>

                <h2 className="text-xl font-bold text-[#1a3826]">{session?.user?.name || "Korisnik"}</h2>
                <p className="text-sm text-slate-400 font-medium mb-4">{session?.user?.email}</p>
                
                <div className="w-full pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-3 text-sm text-slate-600 mb-2">
                        <Building size={14} className="text-[#FFC72C]" />
                        <span className="font-bold">McDonald&apos;s Sarajevo</span>
                    </div>
                    <div className="inline-flex px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                        Administrator
                    </div>
                </div>
            </div>
          </div>

          {/* DESNA STRANA - FORMA */}
          <div className="md:col-span-2">
            <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                <h3 className="text-lg font-black text-[#1a3826] uppercase mb-6 flex items-center gap-2">
                    <Lock size={20} className="text-[#FFC72C]" />
                    Sigurnost i Lozinka
                </h3>

                <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Ime i Prezime</label>
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input type="text" disabled value={session?.user?.name || ""} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-sm font-medium focus:outline-none cursor-not-allowed"/>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Email Adresa</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input type="email" disabled value={session?.user?.email || ""} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-sm font-medium focus:outline-none cursor-not-allowed"/>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 my-6"></div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase">Trenutna Lozinka</label>
                        <input type="password" value={formData.currentPassword} onChange={(e) => setFormData({...formData, currentPassword: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-[#FFC72C] outline-none transition-all" placeholder="Unesite trenutnu lozinku"/>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 uppercase">Nova Lozinka</label>
                            <input type="password" value={formData.newPassword} onChange={(e) => setFormData({...formData, newPassword: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-[#FFC72C] outline-none transition-all" placeholder="Nova lozinka"/>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 uppercase">Potvrdi Novu Lozinku</label>
                            <input type="password" value={formData.confirmPassword} onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-[#FFC72C] outline-none transition-all" placeholder="Ponovite lozinku"/>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button type="submit" disabled={isLoading} className="flex items-center gap-2 bg-[#1a3826] text-white px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-[#142d1f] transition-all shadow-lg hover:shadow-xl disabled:opacity-70">
                        {isLoading ? "Spremanje..." : (<><Save size={16} /> Sačuvaj Promjene</>)}
                    </button>
                </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}