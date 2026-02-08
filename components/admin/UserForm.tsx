"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertUser } from "@/app/actions/userActions";
import { User, Shield, CheckSquare, Store, Check, X } from "lucide-react";
import { Kanit } from "next/font/google";

const brandFont = Kanit({ subsets: ["latin"], weight: ["600", "800", "900"] });

const AVAILABLE_PERMISSIONS = [
  { id: 'view_dashboard', label: 'Dashboard', desc: 'Statistika' },
  { id: 'manage_vacations', label: 'Godišnji Odmori', desc: 'Upravljanje' },
  { id: 'view_productivity', label: 'Produktivnost', desc: 'CL Izvještaji' },
  { id: 'view_labor', label: 'Labor Planner', desc: 'Budžet' },
  { id: 'manage_evaluations', label: 'Evaluacije', desc: 'Ocjenjivanje' },
  { id: 'manage_users', label: 'Korisnici', desc: 'Admin' },
];

interface UserFormProps {
    restaurants: any[];
    initialData?: any; 
    onClose?: () => void;
}

export default function UserForm({ restaurants, initialData, onClose }: UserFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // --- 1. RJEŠENJE ZA ODABRANE RESTORANE ---
  // Inicijaliziramo state odmah (Lazy Initialization), bez useEffect-a
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>(() => {
      // Ako je EDIT mode, uzmi iz initialData
      if (initialData?.restaurants) {
          return initialData.restaurants.map((r: any) => r.restaurantId);
      }
      // Ako je NEW mode, probaj uzeti iz localStorage (Client-side check)
      if (typeof window !== 'undefined') {
          const current = localStorage.getItem("selected_restaurant_id");
          return current ? [current] : [];
      }
      return [];
  });

  // --- 2. RJEŠENJE ZA FORMU ---
  // Inicijaliziramo state odmah sa podacima, bez useEffect-a
  const [formData, setFormData] = useState(() => ({
    id: initialData?.id || "",
    name: initialData?.name || "",
    email: initialData?.email || "",
    password: "", // Password uvijek prazan na početku
    role: initialData?.role || "CREW",
    department: initialData?.department || "RL",
    entitlement: initialData?.vacationEntitlement || 20,
    carryover: initialData?.vacationCarryover || 0,
    permissions: initialData?.permissions || {} as Record<string, boolean>
  }));

  const toggleRestaurant = (rId: string) => {
      setSelectedRestaurants(prev => 
          prev.includes(rId) ? prev.filter(id => id !== rId) : [...prev, rId]
      );
  };

  const handlePermissionChange = (permId: string) => {
    setFormData(prev => ({
      ...prev, permissions: { ...prev.permissions, [permId]: !prev.permissions[permId] }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRestaurants.length === 0) {
        alert("Morate odabrati barem jedan restoran!");
        return;
    }

    setIsLoading(true);
    const result = await upsertUser(formData, selectedRestaurants);
    
    if (result.success) {
      alert(initialData ? "Korisnik ažuriran!" : "Korisnik kreiran!");
      if (onClose) {
          onClose(); 
      } else {
          router.push("/admin/users");
      }
      router.refresh();
    } else {
      alert("Greška: " + result.message);
    }
    setIsLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto bg-card rounded-[2rem] shadow-xl border border-border overflow-hidden">
        {/* HEADER */}
        <div className="p-8 border-b border-border flex justify-between items-center bg-muted">
            <div>
                <h2 className={`text-2xl font-black text-[#1a3826] uppercase ${brandFont.className}`}>
                    {initialData ? "Uredi Korisnika" : "Novi Korisnik"}
                </h2>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">
                    {initialData ? `ID: ${initialData.id}` : "Unesite podatke za novog zaposlenika"}
                </p>
            </div>
            {onClose && (
                <button onClick={onClose} className="p-2 bg-card rounded-full hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors">
                    <X className="w-6 h-6"/>
                </button>
            )}
        </div>

      <form onSubmit={handleSubmit}>
        
        {/* 1. OSNOVNO */}
        <div className="p-8 border-b border-border">
            <h3 className="text-sm font-black text-foreground uppercase mb-6 flex items-center gap-2"><User className="text-[#FFC72C]"/> Osnovni Podaci</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Ime i Prezime</label>
                    <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-2 border-border p-3 rounded-xl font-bold text-foreground outline-none focus:border-[#1a3826]"/>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                    <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border-2 border-border p-3 rounded-xl font-bold text-foreground outline-none focus:border-[#1a3826]"/>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Lozinka {initialData && "(Ostaviti prazno ako se ne mijenja)"}</label>
                    <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border-2 border-border p-3 rounded-xl font-bold text-foreground outline-none focus:border-[#1a3826]"/>
                </div>
            </div>
        </div>

        {/* 2. RESTORANI */}
        <div className="p-8 border-b border-border bg-muted/50">
            <h3 className="text-sm font-black text-foreground uppercase mb-4 flex gap-2"><Store className="text-[#FFC72C]"/> Dodijeli Restorane</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {restaurants.map(r => {
                    const isSelected = selectedRestaurants.includes(r.id);
                    return (
                        <div key={r.id} onClick={() => toggleRestaurant(r.id)} 
                             className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${isSelected ? 'border-[#1a3826] bg-[#1a3826] text-white shadow-lg transform scale-[1.02]' : 'border-border bg-card hover:border-border'}`}>
                            <span className="font-bold text-xs">{r.name}</span>
                            {isSelected && <div className="bg-[#FFC72C] text-[#1a3826] rounded-full p-1"><Check size={10} strokeWidth={4}/></div>}
                        </div>
                    )
                })}
            </div>
        </div>

        {/* 3. ULOGA & BENEFITI */}
        <div className="p-8 border-b border-border">
            <h3 className="text-sm font-black text-foreground uppercase mb-6 flex gap-2"><Shield className="text-[#FFC72C]"/> Pozicija & Godišnji</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Uloga</label>
                        <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full border-2 border-border p-3 rounded-xl font-bold text-foreground outline-none focus:border-[#1a3826]">
                            <option value="CREW">Crew (Radnik)</option>
                            <option value="MANAGER">Manager</option>
                            <option value="ADMIN">Admin</option>
                            <option value="SYSTEM_ARCHITECT">System Architect</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Odjel</label>
                        <select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full border-2 border-border p-3 rounded-xl font-bold text-foreground outline-none focus:border-[#1a3826]">
                            <option value="RL">RL</option>
                            <option value="Office">Office</option>
                            <option value="HM">HM</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-4 items-end">
                    <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Pravo GO</label>
                        <input type="number" value={formData.entitlement} onChange={e => setFormData({...formData, entitlement: Number(e.target.value)})} className="w-full border-2 border-border p-3 rounded-xl font-bold text-foreground outline-none focus:border-[#1a3826]"/>
                    </div>
                    <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Preneseno</label>
                        <input type="number" value={formData.carryover} onChange={e => setFormData({...formData, carryover: Number(e.target.value)})} className="w-full border-2 border-border p-3 rounded-xl font-bold text-foreground outline-none focus:border-[#1a3826]"/>
                    </div>
                </div>
            </div>
        </div>

        {/* 4. PERMISIJE */}
        <div className="p-8 bg-muted/50">
            <h3 className="text-sm font-black text-foreground uppercase mb-4 flex gap-2"><CheckSquare className="text-[#FFC72C]"/> Permisije Sistema</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {AVAILABLE_PERMISSIONS.map((perm) => (
                    <div key={perm.id} onClick={() => handlePermissionChange(perm.id)} 
                         className={`p-3 rounded-xl border-2 cursor-pointer flex items-center gap-2 font-bold text-xs transition-all ${formData.permissions[perm.id] ? 'border-[#1a3826] bg-[#1a3826]/10 text-[#1a3826]' : 'border-border text-slate-400 bg-card hover:border-border'}`}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${formData.permissions[perm.id] ? 'bg-[#1a3826] border-[#1a3826]' : 'bg-card border-border'}`}>
                            {formData.permissions[perm.id] && <Check size={10} className="text-white"/>}
                        </div>
                        {perm.label}
                    </div>
                ))}
            </div>
        </div>

        {/* FOOTER */}
        <div className="p-6 bg-card border-t border-border flex justify-end gap-3">
            {onClose ? (
                <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-muted-foreground hover:bg-slate-100">Zatvori</button>
            ) : (
                <button type="button" onClick={() => router.back()} className="px-6 py-3 rounded-xl font-bold text-muted-foreground hover:bg-slate-100">Nazad</button>
            )}
            <button type="submit" disabled={isLoading} className="bg-[#1a3826] text-white px-8 py-3 rounded-xl font-black uppercase text-xs tracking-wider hover:bg-[#142d1f] shadow-lg shadow-[#1a3826]/20 transition-all">
                {isLoading ? "Spremanje..." : (initialData ? "SAČUVAJ IZMJENE" : "KREIRAJ KORISNIKA")}
            </button>
        </div>
      </form>
    </div>
  );
}