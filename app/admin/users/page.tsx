"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, User, Briefcase, Store, Check, Lock, X } from "lucide-react";
import { getAllUsers, createUser, deleteUser, updateUser } from "@/app/actions/adminUsers";
import { getRestaurants } from "@/app/actions/getRestaurants";

const DEPARTMENTS = [
  { id: 'RL', name: 'Odjel RL (Radnici/Line)' },
  { id: 'Office', name: 'Odjel Office (Ured/Mng)' },
  { id: 'HM', name: 'Odjel HM (Host/Maintenance)' }
];

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // State da znamo koga uređujemo (null znači da pravimo novog)
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "mcdonalds2025", 
    role: "CREW",
    department: "RL",
    restaurantIds: [] as string[]
  });

  // SIGURNOSNA PROVJERA
  useEffect(() => {
    const role = localStorage.getItem("user_role");
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      router.push("/");
    } else {
      loadData();
    }
  }, [router]);

  const loadData = async () => {
    try {
      const [u, r] = await Promise.all([getAllUsers(), getRestaurants()]);
      setUsers(u || []);
      setRestaurants(r || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUserId(null); 
    setFormData({
      name: "", email: "", password: "mcdonalds2025", 
      role: "CREW", department: "RL", restaurantIds: []
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setEditingUserId(user.id);
    
    // Izvuci ID-eve restorana
    const currentRestIds = user.restaurants ? user.restaurants.map((ur: any) => ur.restaurantId) : [];

    setFormData({
      name: user.name || "",
      email: user.email || "",
      password: "", // Prazno kod edita
      role: user.role,
      department: user.department || "RL",
      restaurantIds: currentRestIds
    });
    setIsModalOpen(true);
  };

  const toggleRestaurant = (id: string) => {
    setFormData(prev => {
      const exists = prev.restaurantIds.includes(id);
      if (exists) {
        return { ...prev, restaurantIds: prev.restaurantIds.filter(r => r !== id) };
      } else {
        return { ...prev, restaurantIds: [...prev.restaurantIds, id] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.restaurantIds.length === 0) {
      alert("Morate odabrati barem jedan restoran!");
      return;
    }

    const data = new FormData();
    data.append("name", formData.name);
    data.append("email", formData.email);
    data.append("role", formData.role);
    data.append("department", formData.department);
    data.append("restaurantIds", JSON.stringify(formData.restaurantIds));
    data.append("password", formData.password);

    if (editingUserId) {
      data.append("id", editingUserId);
      await updateUser(data);
      alert("Korisnik ažuriran!");
    } else {
      await createUser(data);
      alert("Korisnik kreiran!");
    }
    
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if(confirm("Sigurno obrisati korisnika?")) {
      await deleteUser(id);
      loadData();
    }
  };

  if (loading) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-black text-[#1a3826]">Upravljanje Korisnicima</h1>
          <p className="text-slate-500 text-sm">Dodaj, uredi ili obriši pristup sistemu.</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-[#1a3826] hover:bg-[#264f36] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all"
        >
          <Plus size={20} /> Novi Korisnik
        </button>
      </div>

      {/* TABELA KORISNIKA */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-400 font-bold">
            <tr>
              <th className="p-4 pl-6">Korisnik</th>
              <th className="p-4">Uloga</th>
              <th className="p-4">Odjel</th>
              <th className="p-4">Restorani</th>
              <th className="p-4 text-right">Akcije</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 pl-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                      {user.name?.charAt(0) || "U"}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{user.name}</div>
                      <div className="text-xs text-slate-400">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-4">
                  <span className="font-bold text-slate-600 flex items-center gap-2">
                    <Briefcase size={14} className="text-slate-400"/> 
                    {DEPARTMENTS.find(d => d.id === user.department)?.name || user.department || "Nije dodijeljen"}
                  </span>
                </td>
                <td className="p-4 text-slate-600 font-medium">
                   {user.restaurants && user.restaurants.length > 0 ? (
                     <div className="flex flex-wrap gap-1">
                       {user.restaurants.map((ur: any) => (
                         <span key={ur.id} className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold">
                           {ur.restaurant.name}
                         </span>
                       ))}
                     </div>
                   ) : (
                     <span className="text-slate-400 text-xs italic">Nema pristupa</span>
                   )}
                </td>
                <td className="p-4 text-right pr-6 flex justify-end gap-2">
                  <button onClick={() => openEditModal(user)} className="text-blue-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors">
                    <Pencil size={18} />
                  </button>
                  <button onClick={() => handleDelete(user.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-[#1a3826]">
                    {editingUserId ? "Uredi Korisnika" : "Novi Korisnik"}
                </h2>
                <button onClick={() => setIsModalOpen(false)}><X size={24}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Ime</label>
                  <input required type="text" className="w-full border rounded-lg p-3 text-sm font-bold"
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Email</label>
                  <input required type="email" className="w-full border rounded-lg p-3 text-sm font-bold"
                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    <Lock size={12}/> {editingUserId ? "Nova Lozinka (Opcionalno)" : "Lozinka"}
                  </label>
                  <input 
                    required={!editingUserId} 
                    type="text" 
                    className="w-full border-2 rounded-lg p-3 text-sm font-bold"
                    placeholder={editingUserId ? "Prazno za staru šifru" : "Unesite lozinku"}
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Uloga</label>
                  <select className="w-full border rounded-lg p-3 text-sm font-bold"
                    value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="CREW">Radnik</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#1a3826] uppercase block mb-1">Odjel</label>
                  <select className="w-full border rounded-lg p-3 text-sm font-bold"
                    value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}
                  >
                    {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Restorani</label>
                <div className="grid grid-cols-1 gap-2 border rounded-xl p-3 bg-slate-50 max-h-40 overflow-y-auto">
                  {restaurants.map(rest => {
                    const isSelected = formData.restaurantIds.includes(rest.id);
                    return (
                      <div key={rest.id} onClick={() => toggleRestaurant(rest.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${isSelected ? 'bg-[#1a3826] text-white' : 'bg-white'}`}
                      >
                        <span className="text-sm font-bold">{rest.name}</span>
                        {isSelected && <Check size={16} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Odustani</button>
                <button type="submit" className="flex-1 py-3 bg-[#1a3826] text-white font-bold rounded-xl shadow-lg">{editingUserId ? "Sačuvaj" : "Kreiraj"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}