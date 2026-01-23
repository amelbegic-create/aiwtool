/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  ShieldCheck,
  Search,
  X,
  Check,
  Building2,
  Eraser,
  Layers,
  ChevronRight,
} from "lucide-react";
import { createUser, deleteUser, updateUser } from "@/app/actions/adminActions";
import { PERMISSIONS, ALL_PERMISSION_KEYS, GOD_MODE_ROLES } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";

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

const roles: Role[] = ["SYSTEM_ARCHITECT", "SUPER_ADMIN", "ADMIN", "MANAGER", "CREW"];

function isGodMode(role: Role) {
  return GOD_MODE_ROLES.has(String(role));
}

export default function UserClient({ users = [], restaurants = [] }: UserClientProps) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)
    );
  }, [users, query]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "CREW" as Role,
    department: "RL",
    vacationEntitlement: 20,
    vacationCarryover: 0,
    restaurantIds: [] as string[],
    primaryRestaurantId: "" as string,
    permissions: [] as string[],
  });

  // ✅ Permissions UI state
  const [moduleQuery, setModuleQuery] = useState("");
  const [permQuery, setPermQuery] = useState("");
  const [activeModuleId, setActiveModuleId] = useState<string>(PERMISSIONS[0]?.id || "rules");

  useEffect(() => {
    // Kad otvoriš modal, resetuj filtere da bude uredno
    if (isModalOpen) {
      setModuleQuery("");
      setPermQuery("");
      setActiveModuleId(PERMISSIONS[0]?.id || "rules");
    }
  }, [isModalOpen]);

  const openCreate = () => {
    setIsEditing(false);
    setFormData({
      id: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "CREW",
      department: "RL",
      vacationEntitlement: 20,
      vacationCarryover: 0,
      restaurantIds: [],
      primaryRestaurantId: "",
      permissions: [],
    });
    setIsModalOpen(true);
  };

  const openEdit = (u: UserProps) => {
    setIsEditing(true);

    const full = (u.name || "").trim();
    const parts = full.split(/\s+/);
    const firstName = parts.shift() || "";
    const lastName = parts.join(" ");

    setFormData({
      id: u.id,
      firstName,
      lastName,
      email: u.email || "",
      password: "",
      role: u.role,
      department: u.department || "RL",
      vacationEntitlement: u.vacationEntitlement,
      vacationCarryover: u.vacationCarryover,
      restaurantIds: u.restaurantIds || [],
      primaryRestaurantId: (u as any)?.restaurants?.find?.((x: any) => x.isPrimary)?.restaurantId || "",
      permissions: u.permissions || [],
    });

    setIsModalOpen(true);
  };

  const togglePerm = (key: string) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(key);
      const next = exists ? prev.permissions.filter((p) => p !== key) : [...prev.permissions, key];
      return { ...prev, permissions: next };
    });
  };

  const setMany = (keys: string[], value: boolean) => {
    setFormData((prev) => {
      const current = new Set(prev.permissions);
      keys.forEach((k) => (value ? current.add(k) : current.delete(k)));
      return { ...prev, permissions: Array.from(current) };
    });
  };

  const handleSubmit = async () => {
    const composedName = `${formData.firstName} ${formData.lastName}`.trim();

    const payload = {
      id: formData.id,
      name: composedName,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      department: formData.department,
      vacationEntitlement: formData.vacationEntitlement,
      vacationCarryover: formData.vacationCarryover,
      restaurantIds: formData.restaurantIds,
      primaryRestaurantId: formData.primaryRestaurantId,
      permissions: formData.permissions,
    };

    if (!payload.name || !formData.firstName || !formData.lastName || !payload.email) {
      return alert("Ime, Prezime i Email su obavezni.");
    }

    try {
      if (!isEditing) {
        if (!payload.password) return alert("Lozinka je obavezna kod kreiranja.");
        await createUser(payload as any);
      } else {
        await updateUser(payload as any);
      }
      setIsModalOpen(false);
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Greška");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sigurno obrisati korisnika?")) return;
    try {
      await deleteUser(id);
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Greška");
    }
  };

  const godMode = isGodMode(formData.role);

  // ✅ Filtered module list (left)
  const modulesFiltered = useMemo(() => {
    const q = moduleQuery.trim().toLowerCase();
    if (!q) return PERMISSIONS;
    return PERMISSIONS.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        (g.subtitle || "").toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q)
    );
  }, [moduleQuery]);

  const activeModule = useMemo(() => {
    return PERMISSIONS.find((g) => g.id === activeModuleId) || PERMISSIONS[0];
  }, [activeModuleId]);

  // ✅ Filter permissions inside active module (right)
  const activeItemsFiltered = useMemo(() => {
    const q = permQuery.trim().toLowerCase();
    const items = activeModule?.items || [];
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.key.toLowerCase().includes(q));
  }, [permQuery, activeModule]);

  const moduleStats = (groupId: string) => {
    const g = PERMISSIONS.find((x) => x.id === groupId);
    if (!g) return { selected: 0, total: 0 };
    const total = g.items.length;
    const selected = g.items.filter((i) => formData.permissions.includes(i.key)).length;
    return { selected, total };
  };

  const activeKeys = activeModule?.items?.map((i) => i.key) || [];
  const activeSelected = activeKeys.filter((k) => formData.permissions.includes(k)).length;
  const activeAllOn = activeSelected === activeKeys.length && activeKeys.length > 0;

  const globalSelected = formData.permissions.length;
  const globalTotal = ALL_PERMISSION_KEYS.length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter">
              ADMIN <span className="text-[#FFC72C]">KORISNICI</span>
            </h1>
            <p className="text-slate-600 text-sm font-semibold">Kreiranje korisnika i dodjela permisija</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#1a3826] hover:bg-[#142e1e] text-white rounded-xl text-xs font-black uppercase shadow-md active:scale-95"
            >
              <Plus size={16} /> Novi korisnik
            </button>

            <a
              href="/admin/restaurants"
              className="inline-flex items-center gap-2 px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black uppercase shadow-sm border border-slate-200 active:scale-95"
            >
              <Building2 size={16} className="text-[#1a3826]" /> Novi restoran
            </a>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
          <Search size={16} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Traži korisnika..."
            className="bg-transparent outline-none text-sm font-bold text-slate-700 w-full"
          />
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase">
            <div className="col-span-4">Korisnik</div>
            <div className="col-span-2">Rola</div>
            <div className="col-span-4">Restorani</div>
            <div className="col-span-2 text-right">Akcije</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredUsers.map((u) => (
              <div key={u.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-4">
                  <div className="font-bold text-sm text-slate-800">{u.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                </div>

                <div className="col-span-2">
                  <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase text-slate-600">
                    {isGodMode(u.role) && <ShieldCheck size={14} className="text-[#1a3826]" />}
                    {u.role}
                  </span>
                </div>

                <div className="col-span-4 flex flex-wrap gap-1">
                  {(u.restaurantIds || []).slice(0, 4).map((rid) => {
                    const r = restaurants.find((x) => x.id === rid);
                    return (
                      <span key={rid} className="text-[9px] bg-slate-100 px-2 py-1 rounded border border-slate-200">
                        {r?.name || "Restoran"}
                      </span>
                    );
                  })}
                  {(u.restaurantIds || []).length > 4 && (
                    <span className="text-[9px] bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">
                      +{(u.restaurantIds || []).length - 4}
                    </span>
                  )}
                </div>

                <div className="col-span-2 flex justify-end gap-2">
                  <button
                    onClick={() => openEdit(u)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                    title="Uredi"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl transition-colors"
                    title="Obriši"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="min-h-full w-full flex items-start justify-center p-4 md:p-8 py-10">
              <div className="bg-white w-full max-w-[1200px] rounded-3xl shadow-2xl border border-white/30 overflow-hidden max-h-[92vh] flex flex-col">
                {/* Header */}
                <div className="shrink-0 p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">{isEditing ? "Uredi korisnika" : "Novi korisnik"}</h2>
                    <p className="text-xs text-slate-600 font-semibold">
                      Globalne permisije • ADMIN/SYSTEM_ARCHITECT imaju sve automatski
                    </p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-white" aria-label="Zatvori">
                    <X />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* LEFT: Basic + Restaurants */}
                    <div className="xl:col-span-4 space-y-4">
                      <div className="bg-white border border-slate-200 rounded-2xl p-5">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-4">Osnovno</h3>

                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                              value={formData.firstName}
                              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                              placeholder="Ime"
                              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
                            />
                            <input
                              value={formData.lastName}
                              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                              placeholder="Prezime"
                              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
                            />
                          </div>

                          <input
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="Email"
                            className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
                          />

                          <input
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder={isEditing ? "Nova lozinka (opcionalno)" : "Lozinka"}
                            type="password"
                            className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <select
                              value={formData.role}
                              onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
                            >
                              {roles.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>

                            <input
                              value={formData.department}
                              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                              placeholder="Department (npr. RL)"
                              className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
                            />
                          </div>
                        </div>

                        {godMode && (
                          <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-2">
                            <ShieldCheck size={18} /> Ova rola automatski dobija SVE permisije.
                          </div>
                        )}
                      </div>

                      <div className="bg-white border border-slate-200 rounded-2xl p-5">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-4">Restorani</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                          {restaurants.map((r) => {
                            const checked = formData.restaurantIds.includes(r.id);
                            return (
                              <label
                                key={r.id}
                                className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                                  checked ? "border-[#1a3826] bg-[#1a3826]/5" : "border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const ids = new Set(formData.restaurantIds);
                                    e.target.checked ? ids.add(r.id) : ids.delete(r.id);
                                    setFormData({ ...formData, restaurantIds: Array.from(ids) });
                                  }}
                                />
                                <span className="truncate">{r.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: Permissions – scalable UI */}
                    <div className="xl:col-span-8">
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        {/* Top bar */}
                        <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 inline-flex items-center gap-2">
                              <Layers size={14} /> Permisije
                            </h3>
                            <p className="text-xs text-slate-600 font-semibold mt-1">
                              Lijevo odaberi modul, desno označi permisije • {globalSelected}/{globalTotal} ukupno
                            </p>
                          </div>

                          {!godMode && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setFormData({ ...formData, permissions: ALL_PERMISSION_KEYS })}
                                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[10px] font-black uppercase"
                              >
                                Select all
                              </button>
                              <button
                                onClick={() => setFormData({ ...formData, permissions: [] })}
                                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[10px] font-black uppercase text-slate-700 inline-flex items-center gap-2"
                              >
                                <Eraser size={14} /> Clear all
                              </button>
                            </div>
                          )}
                        </div>

                        {godMode ? (
                          <div className="p-6">
                            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-900 text-sm font-bold">
                              Permisije su automatske za ovu rolu.
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-12">
                            {/* Module list */}
                            <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-200 p-5">
                              <div className="flex items-center gap-2 mb-3">
                                <Search size={16} className="text-slate-400" />
                                <input
                                  value={moduleQuery}
                                  onChange={(e) => setModuleQuery(e.target.value)}
                                  placeholder="Traži modul..."
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826]"
                                />
                              </div>

                              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                                {modulesFiltered.map((g) => {
                                  const stats = moduleStats(g.id);
                                  const active = g.id === activeModuleId;

                                  return (
                                    <button
                                      key={g.id}
                                      onClick={() => setActiveModuleId(g.id)}
                                      className={`w-full text-left p-3 rounded-2xl border transition-colors flex items-center justify-between gap-3 ${
                                        active
                                          ? "border-[#1a3826] bg-[#1a3826]/5"
                                          : "border-slate-200 hover:bg-slate-50"
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="font-black text-slate-900 truncate">{g.title}</div>
                                        {g.subtitle && <div className="text-xs text-slate-600 font-semibold truncate">{g.subtitle}</div>}
                                        <div className="mt-2 text-[10px] font-black uppercase text-slate-500">
                                          {stats.selected}/{stats.total} odabrano
                                        </div>
                                      </div>

                                      <div className={`shrink-0 h-8 w-8 rounded-xl border flex items-center justify-center ${
                                        active ? "border-[#1a3826] text-[#1a3826] bg-white" : "border-slate-200 text-slate-400 bg-white"
                                      }`}>
                                        <ChevronRight size={16} />
                                      </div>
                                    </button>
                                  );
                                })}

                                {modulesFiltered.length === 0 && (
                                  <div className="p-6 rounded-2xl border border-slate-200 text-sm font-bold text-slate-500 bg-white">
                                    Nema rezultata za ovaj upit.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Permissions for active module */}
                            <div className="lg:col-span-7 p-5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                <div>
                                  <div className="font-black text-slate-900">{activeModule?.title}</div>
                                  {activeModule?.subtitle && (
                                    <div className="text-xs text-slate-600 font-semibold">{activeModule.subtitle}</div>
                                  )}
                                  <div className="text-[10px] font-black uppercase text-slate-500 mt-2">
                                    {activeSelected}/{activeKeys.length} odabrano u ovom modulu
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setMany(activeKeys, !activeAllOn)}
                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase border transition-colors ${
                                      activeAllOn
                                        ? "bg-[#1a3826] text-white border-[#1a3826]"
                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                    }`}
                                  >
                                    {activeAllOn ? "Sve" : "Označi sve"}
                                  </button>

                                  <button
                                    onClick={() => setMany(activeKeys, false)}
                                    className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[10px] font-black uppercase text-slate-700 inline-flex items-center gap-2"
                                  >
                                    <Eraser size={14} /> Clear
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 mb-4">
                                <Search size={16} className="text-slate-400" />
                                <input
                                  value={permQuery}
                                  onChange={(e) => setPermQuery(e.target.value)}
                                  placeholder="Traži permisiju u ovom modulu..."
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826]"
                                />
                              </div>

                              <div className="space-y-2">
                                {activeItemsFiltered.map((item) => {
                                  const checked = formData.permissions.includes(item.key);
                                  return (
                                    <label
                                      key={item.key}
                                      className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer text-sm font-bold transition-colors ${
                                        checked ? "border-[#1a3826] bg-[#1a3826]/5" : "border-slate-200 hover:bg-slate-50"
                                      }`}
                                    >
                                      <input type="checkbox" checked={checked} onChange={() => togglePerm(item.key)} />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-slate-900">{item.label}</div>
                                        <div className="text-[10px] font-mono text-slate-400 truncate">{item.key}</div>
                                      </div>
                                    </label>
                                  );
                                })}

                                {activeItemsFiltered.length === 0 && (
                                  <div className="p-6 rounded-2xl border border-slate-200 text-sm font-bold text-slate-500 bg-white">
                                    Nema permisija za ovaj filter.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 p-6 border-t border-slate-200 flex justify-end gap-3 bg-white">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-3 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-700 hover:bg-slate-50"
                  >
                    Odustani
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="px-6 py-3 rounded-xl bg-[#1a3826] hover:bg-[#142e1e] text-white text-xs font-black uppercase shadow-md active:scale-95 inline-flex items-center gap-2"
                  >
                    <Check size={16} /> Sačuvaj
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
