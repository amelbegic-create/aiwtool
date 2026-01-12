"use client";

import { useState } from "react";
import { Plus, Trash2, Shield, Pencil } from "lucide-react";
import { createUser, deleteUser, updateUser } from "@/app/actions/adminActions";
import { SYSTEM_PERMISSIONS } from "@/lib/constants"; 
import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";

// 1. Definišemo interfejse
interface UserProps {
    id: string;
    name: string | null;
    email: string | null;
    role: Role;
    department: string | null;
    permissions: string[];
    restaurantIds?: string[];
    vacationEntitlement: number;
    vacationCarryover: number;
}

interface RestaurantProps {
    id: string;
    name: string;
}

interface UserClientProps {
    users: UserProps[];
    restaurants: RestaurantProps[];
}

const AVAILABLE_PERMISSIONS = [
    { id: SYSTEM_PERMISSIONS.USERS_VIEW, label: "Pregled Korisnika" },
    { id: SYSTEM_PERMISSIONS.USERS_MANAGE, label: "Upravljanje Korisnicima" },
    { id: SYSTEM_PERMISSIONS.VACATION_VIEW_ALL, label: "Pregled Svih Godišnjih" },
    { id: SYSTEM_PERMISSIONS.VACATION_APPROVE, label: "Odobravanje Godišnjih" },
    { id: SYSTEM_PERMISSIONS.SETTINGS_MANAGE, label: "Pristup Postavkama" },
];

// 2. Koristimo definisane tipove umjesto 'any'
export default function UserClient({ users = [], restaurants = [] }: UserClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
      id: "",
      name: "", email: "", password: "", 
      role: "CREW" as Role, department: "RL",
      vacationEntitlement: 20, vacationCarryover: 0,
      restaurantIds: [] as string[], permissions: [] as string[]
  });

  const resetForm = () => {
      setFormData({
          id: "", name: "", email: "", password: "", 
          role: "CREW", department: "RL",
          vacationEntitlement: 20, vacationCarryover: 0,
          restaurantIds: [], permissions: []
      });
      setIsEditing(false);
  };

  const handleOpenCreate = () => {
      resetForm();
      setIsModalOpen(true);
  };

  // FIX: Strogo tipiziran parametar 'user'
  const handleOpenEdit = (user: UserProps) => {
      setIsEditing(true);
      setFormData({
          id: user.id,
          name: user.name || "",
          email: user.email || "",
          password: "", 
          role: user.role,
          department: user.department || "RL",
          vacationEntitlement: user.vacationEntitlement,
          vacationCarryover: user.vacationCarryover,
          restaurantIds: user.restaurantIds || [], 
          permissions: user.permissions
      });
      setIsModalOpen(true);
  };

  const handlePermChange = (permId: string) => {
      setFormData(prev => {
          if (prev.permissions.includes(permId)) return { ...prev, permissions: prev.permissions.filter(p => p !== permId) };
          return { ...prev, permissions: [...prev.permissions, permId] };
      });
  };

  const handleRestChange = (restId: string) => {
    setFormData(prev => {
        if (prev.restaurantIds.includes(restId)) return { ...prev, restaurantIds: prev.restaurantIds.filter(r => r !== restId) };
        return { ...prev, restaurantIds: [...prev.restaurantIds, restId] };
    });
  };

  const handleSubmit = async () => {
      try {
          if (isEditing) {
              await updateUser(formData);
              alert("Korisnik ažuriran!");
          } else {
              await createUser(formData);
              alert("Korisnik kreiran!");
          }
          setIsModalOpen(false);
          router.refresh();
      } catch (error) {
          if (error instanceof Error) alert("Greška: " + error.message);
      }
  };

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen">
       <div className="flex justify-between items-center mb-8">
           <h1 className="text-3xl font-black text-[#1a3826]">KORISNICI & PERMISIJE</h1>
           <button onClick={handleOpenCreate} className="bg-[#1a3826] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-[#142d1f]">
               <Plus size={18}/> NOVI KORISNIK
           </button>
       </div>

       <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
           <table className="w-full text-left">
               <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                   <tr>
                       <th className="p-4">Ime</th>
                       <th className="p-4">Rola</th>
                       <th className="p-4">Odjel</th>
                       <th className="p-4">Restorani</th>
                       <th className="p-4 text-right">Akcije</th>
                   </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                   {/* FIX: Strogo tipiziran 'u' */}
                   {users.map((u: UserProps) => (
                       <tr key={u.id} className="hover:bg-slate-50">
                           <td className="p-4"><div className="font-bold text-slate-800">{u.name}</div><div className="text-xs text-slate-400">{u.email}</div></td>
                           <td className="p-4"><span className="px-2 py-1 rounded text-[10px] font-black uppercase bg-slate-100">{u.role}</span></td>
                           <td className="p-4 font-bold text-slate-600">{u.department}</td>
                           <td className="p-4">
                               <div className="flex gap-1 flex-wrap">
                                   {/* FIX: Strogo tipiziran 'rid' i 'r' */}
                                   {u.restaurantIds?.map((rid: string) => {
                                       const rName = restaurants.find((r: RestaurantProps) => r.id === rid)?.name;
                                       return <span key={rid} className="text-[10px] bg-green-50 text-green-700 px-1 rounded border border-green-100">{rName || rid}</span>
                                   })}
                               </div>
                           </td>
                           <td className="p-4 text-right flex justify-end gap-2">
                               <button onClick={() => handleOpenEdit(u)} className="text-blue-400 hover:text-blue-600 p-2"><Pencil size={16}/></button>
                               <button onClick={() => { if(confirm("Brisanje?")) deleteUser(u.id).then(() => router.refresh()) }} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16}/></button>
                           </td>
                       </tr>
                   ))}
               </tbody>
           </table>
       </div>
       
       {isModalOpen && (
           <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
               <div className="bg-white rounded-3xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
                   <h2 className="text-2xl font-black text-slate-800 mb-6">{isEditing ? "Uredi Korisnika" : "Novi Korisnik"}</h2>
                   <div className="grid grid-cols-2 gap-4 mb-4">
                       <input value={formData.name} placeholder="Ime" className="border p-3 rounded-xl" onChange={e => setFormData({...formData, name: e.target.value})} />
                       <input value={formData.email} placeholder="Email" className="border p-3 rounded-xl" onChange={e => setFormData({...formData, email: e.target.value})} />
                       <input value={formData.password} placeholder={isEditing ? "Nova Lozinka (opcionalno)" : "Lozinka"} type="password" className="border p-3 rounded-xl" onChange={e => setFormData({...formData, password: e.target.value})} />
                       <select value={formData.role} className="border p-3 rounded-xl font-bold" onChange={e => setFormData({...formData, role: e.target.value as Role})}>
                           <option value="CREW">Crew</option><option value="MANAGER">Manager</option><option value="ADMIN">Admin</option><option value="SYSTEM_ARCHITECT">Architect</option>
                       </select>
                   </div>
                   
                   <div className="mb-6">
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Restorani</h3>
                        <div className="flex flex-wrap gap-2">
                            {/* FIX: Strogo tipiziran 'r' */}
                            {restaurants.map((r: RestaurantProps) => (
                                <button type="button" key={r.id} onClick={() => handleRestChange(r.id)} className={`px-3 py-1 text-xs font-bold rounded-lg border ${formData.restaurantIds.includes(r.id) ? 'bg-[#1a3826] text-white' : 'bg-white'}`}>{r.name}</button>
                            ))}
                        </div>
                   </div>
                   
                   <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-6">
                       <h3 className="text-xs font-bold text-orange-600 uppercase mb-3">Godišnji Odmor</h3>
                       <div className="flex gap-4">
                           <div><label className="text-[10px] font-bold text-slate-500">PRAVO</label><input type="number" value={formData.vacationEntitlement} onChange={e => setFormData({...formData, vacationEntitlement: Number(e.target.value)})} className="w-full border p-2 rounded-lg"/></div>
                           <div><label className="text-[10px] font-bold text-slate-500">PRENESENO</label><input type="number" value={formData.vacationCarryover} onChange={e => setFormData({...formData, vacationCarryover: Number(e.target.value)})} className="w-full border p-2 rounded-lg"/></div>
                       </div>
                   </div>

                   <div className="mb-6">
                       <h3 className="text-sm font-bold text-slate-800 mb-3"><Shield size={16}/> Permisije</h3>
                       <div className="grid grid-cols-2 gap-2">
                           {AVAILABLE_PERMISSIONS.map(perm => (
                               <label key={perm.id} className="flex items-center gap-2 p-3 border rounded-xl"><input type="checkbox" checked={formData.permissions.includes(perm.id)} onChange={() => handlePermChange(perm.id)} className="accent-[#1a3826]"/> <span className="text-xs font-bold">{perm.label}</span></label>
                           ))}
                       </div>
                   </div>

                   <div className="flex gap-4">
                       <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 font-bold bg-slate-100 rounded-xl">Odustani</button>
                       <button onClick={handleSubmit} className="flex-1 py-3 font-bold text-white bg-[#1a3826] rounded-xl">Sačuvaj</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
}