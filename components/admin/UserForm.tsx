"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Check, AlertCircle, Loader2, User, Store, Trash2 } from "lucide-react";
import Link from "next/link";

// Definicija modula za permisije
const MODULES = [
  { id: "evaluations", label: "Evaluacije", actions: ["view", "create", "submit", "approve"] },
  { id: "vacations", label: "Godišnji Odmori", actions: ["view_own", "view_all", "request", "approve"] },
  { id: "rules", label: "Baza Znanja", actions: ["view", "create", "edit", "publish"] },
  { id: "users", label: "Administracija", actions: ["view", "create", "edit", "delete"] },
];

type Props = {
  initialData?: any; // Ako postoji, onda je EDIT mode
  restaurants: any[]; // Lista svih restorana za odabir
};

export default function UserForm({ initialData, restaurants }: Props) {
  const router = useRouter();
  const isEditMode = !!initialData;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  // Inicijalno stanje (prazno ili popunjeno)
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    email: initialData?.email || "",
    password: "", // Lozinku ne prikazujemo
    role: initialData?.role || "MANAGER",
    isActive: initialData?.isActive ?? true,
  });

  const [permissions, setPermissions] = useState<Record<string, string[]>>(initialData?.permissions || {});
  
  // Za restorane: izvuci ID-eve iz initialData ako postoje
  const initialRestaurantIds = initialData?.restaurants?.map((r: any) => r.restaurantId) || [];
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>(initialRestaurantIds);

  const togglePermission = (moduleId: string, action: string) => {
    setPermissions(prev => {
      const current = prev[moduleId] || [];
      const updated = current.includes(action) ? current.filter(a => a !== action) : [...current, action];
      return { ...prev, [moduleId]: updated };
    });
  };

  const toggleRestaurant = (id: string) => {
    setSelectedRestaurants(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    // Ako je Edit mode, ne šaljemo password ako je prazan
    const payload: any = { ...formData, permissions, restaurantIds: selectedRestaurants };
    if (isEditMode && !payload.password) delete payload.password;

    try {
      const url = isEditMode ? `/api/admin/users/${initialData.id}` : "/api/admin/users";
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      
      router.push("/admin/users");
      router.refresh();
    } catch (err: any) {
      setError("Greška: " + (err.message || "Provjerite podatke."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if(!confirm("Da li ste sigurni da želite obrisati ovog korisnika?")) return;
    setIsDeleting(true);
    try {
        await fetch(`/api/admin/users/${initialData.id}`, { method: "DELETE" });
        router.push("/admin/users");
        router.refresh();
    } catch (err) {
        alert("Greška pri brisanju");
        setIsDeleting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
              <Link href="/admin/users" className="h-10 w-10 flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-600">
                  <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                  <h1 className="text-2xl font-bold text-slate-900">{isEditMode ? `Uredi: ${initialData.name}` : "Novi Korisnik"}</h1>
                  <p className="text-slate-500 text-sm">{isEditMode ? "Izmjena podataka i pristupa" : "Kreiranje naloga i dodjela prava"}</p>
              </div>
          </div>
          
          {isEditMode && (
             <button onClick={handleDelete} disabled={isDeleting} className="px-4 py-2 bg-red-50 text-red-600 rounded-md text-sm font-bold border border-red-100 hover:bg-red-100 flex items-center gap-2">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>} Obriši Korisnika
             </button>
          )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LIJEVA KOLONA - OSNOVNO */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 pb-4 border-b border-slate-100">
                        <User className="w-5 h-5 text-[#1a3826]" /> Osnovne Informacije
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Ime i Prezime</label>
                            <input required type="text" className="w-full h-10 px-3 rounded-md border border-slate-200 focus:ring-1 focus:ring-[#1a3826] outline-none" 
                                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Email</label>
                            <input required type="email" disabled={isEditMode} className="w-full h-10 px-3 rounded-md border border-slate-200 focus:ring-1 focus:ring-[#1a3826] outline-none disabled:bg-slate-100 disabled:text-slate-400" 
                                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">{isEditMode ? "Nova Lozinka (Opcionalno)" : "Lozinka"}</label>
                            <input type={isEditMode ? "text" : "password"} required={!isEditMode} className="w-full h-10 px-3 rounded-md border border-slate-200 focus:ring-1 focus:ring-[#1a3826] outline-none font-mono" 
                                placeholder={isEditMode ? "Ostavite prazno ako ne mijenjate" : ""}
                                value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Uloga</label>
                            <select className="w-full h-10 px-3 rounded-md border border-slate-200 focus:ring-1 focus:ring-[#1a3826] outline-none bg-white"
                                value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                                <option value="MANAGER">Manager</option>
                                <option value="SWING">Swing</option>
                                <option value="CREW">Crew</option>
                                <option value="ADMIN">Admin</option>
                                <option value="SUPER_ADMIN">Super Admin</option>
                            </select>
                        </div>
                         <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Status Naloga</label>
                            <div className="flex items-center gap-4 mt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={formData.isActive} onChange={() => setFormData({...formData, isActive: true})} />
                                    <span className="text-sm font-medium text-emerald-700">Aktivan</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={!formData.isActive} onChange={() => setFormData({...formData, isActive: false})} />
                                    <span className="text-sm font-medium text-red-700">Blokiran</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PERMISIJE */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                    <h3 className="text-lg font-bold mb-6 pb-4 border-b border-slate-100">Matrica Permisija</h3>
                    <div className="space-y-6">
                        {MODULES.map((mod) => (
                            <div key={mod.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2 border-b border-slate-50 last:border-0 items-center">
                                <div className="font-bold text-slate-700">{mod.label}</div>
                                <div className="md:col-span-3 flex flex-wrap gap-3">
                                    {mod.actions.map(act => (
                                        <label key={act} className={`flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer select-none text-xs font-bold uppercase transition-all
                                            ${permissions[mod.id]?.includes(act) ? 'bg-[#1a3826] border-[#1a3826] text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                            <input type="checkbox" className="hidden" checked={permissions[mod.id]?.includes(act) || false} onChange={() => togglePermission(mod.id, act)} />
                                            {permissions[mod.id]?.includes(act) && <Check className="w-3 h-3" />}
                                            {act.replace('_', ' ')}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* DESNA KOLONA - RESTORANI */}
            <div className="space-y-6">
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sticky top-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 pb-4 border-b border-slate-100">
                        <Store className="w-5 h-5 text-[#1a3826]" /> Dodjela Restorana
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Odaberite restorane kojima korisnik ima pristup.</p>
                    
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {restaurants.map(r => (
                            <label key={r.id} className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-all ${selectedRestaurants.includes(r.id) ? 'border-[#1a3826] bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" className="rounded text-[#1a3826] focus:ring-[#1a3826]" 
                                        checked={selectedRestaurants.includes(r.id)}
                                        onChange={() => toggleRestaurant(r.id)} />
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{r.name}</p>
                                        <p className="text-xs text-slate-500 font-mono">#{r.code}</p>
                                    </div>
                                </div>
                                {selectedRestaurants.includes(r.id) && <Check className="w-4 h-4 text-[#1a3826]" />}
                            </label>
                        ))}
                        {restaurants.length === 0 && <p className="text-sm text-slate-400 italic">Nema dostupnih restorana.</p>}
                    </div>
                </div>
            </div>

          </div>

          {error && <div className="p-4 bg-red-50 text-red-600 rounded-md flex items-center gap-2 text-sm font-bold border border-red-100"><AlertCircle className="w-4 h-4"/> {error}</div>}

          <div className="flex justify-end gap-4 py-4 border-t border-slate-200 mt-8">
              <Link href="/admin/users" className="px-6 py-2.5 rounded-md border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">Odustani</Link>
              <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 rounded-md bg-[#1a3826] text-white font-bold hover:bg-[#264f36] flex items-center gap-2 shadow-lg shadow-[#1a3826]/20">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} {isEditMode ? "Sačuvaj Promjene" : "Kreiraj Korisnika"}
              </button>
          </div>
      </form>
    </div>
  );
}