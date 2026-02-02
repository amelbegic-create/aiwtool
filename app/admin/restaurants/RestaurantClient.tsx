"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Power, Search, X, Check } from "lucide-react";
import {
  createRestaurant,
  deleteRestaurant,
  toggleRestaurantStatus,
  updateRestaurant,
} from "@/app/actions/restaurantAdminActions";
import { useRouter } from "next/navigation";

type RestaurantRow = { id: string; code: string; name: string; city: string; address: string; isActive: boolean };
export default function RestaurantClient({ restaurants }: { restaurants: RestaurantRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.code || "").toLowerCase().includes(q)
    );
  }, [restaurants, query]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    id: "",
    code: "",
    name: "",
    city: "",
    address: "",
  });

  const openCreate = () => {
    setEditing(false);
    setForm({ id: "", code: "", name: "", city: "", address: "" });
    setOpen(true);
  };

  const openEdit = (r: RestaurantRow) => {
    setEditing(true);
    setForm({
      id: r.id,
      code: r.code || "",
      name: r.name || "",
      city: r.city || "",
      address: r.address || "",
    });
    setOpen(true);
  };

  const submit = async () => {
    try {
      if (!form.code.trim() || !form.name.trim()) return alert("Code i naziv su obavezni.");

      if (!editing) {
        await createRestaurant({
          code: form.code,
          name: form.name,
          city: form.city,
          address: form.address,
        });
      } else {
        await updateRestaurant({
          id: form.id,
          code: form.code,
          name: form.name,
          city: form.city,
          address: form.address,
        });
      }

      setOpen(false);
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Greška");
    }
  };

  const del = async (id: string) => {
    if (!confirm("Sigurno obrisati restoran?")) return;
    try {
      await deleteRestaurant(id);
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Greška");
    }
  };

  const toggle = async (id: string, current: boolean) => {
    try {
      await toggleRestaurantStatus(id, current);
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Greška");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter">
              ADMIN <span className="text-[#FFC72C]">RESTORANI</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Kreiranje i održavanje lokacija (globalne postavke)
            </p>
          </div>

          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#1a3826] hover:bg-[#142e1e] text-white rounded-xl text-xs font-black uppercase shadow-md active:scale-95"
          >
            <Plus size={16} /> Novi restoran
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
          <Search size={16} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Traži restoran..."
            className="bg-transparent outline-none text-sm font-bold text-slate-700 w-full"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase">
            <div className="col-span-2">Code</div>
            <div className="col-span-4">Naziv</div>
            <div className="col-span-3">Grad</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Akcije</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
              >
                <div className="col-span-2 font-mono text-sm font-bold text-slate-700">
                  {r.code}
                </div>

                <div className="col-span-4">
                  <div className="font-bold text-sm text-slate-800">{r.name}</div>
                  {r.address && <div className="text-[10px] text-slate-400">{r.address}</div>}
                </div>

                <div className="col-span-3 text-sm font-bold text-slate-600">
                  {r.city || "-"}
                </div>

                <div className="col-span-1">
                  <span
                    className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${
                      r.isActive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : "bg-red-50 text-red-700 border-red-100"
                    }`}
                  >
                    {r.isActive ? "AKTIVNO" : "OFF"}
                  </span>
                </div>

                <div className="col-span-2 flex justify-end gap-2">
                  <button
                    onClick={() => toggle(r.id, r.isActive)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl"
                    title="Toggle"
                  >
                    <Power size={16} />
                  </button>

                  <button
                    onClick={() => openEdit(r)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl"
                    title="Uredi"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() => del(r.id)}
                    className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl"
                    title="Obriši"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {open && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-[700px] rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">
                    {editing ? "Uredi restoran" : "Novi restoran"}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">Code mora biti unikatan</p>
                </div>
                <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-white">
                  <X />
                </button>
              </div>

              <div className="p-6 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="Code (npr. SA01)"
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826]"
                  />
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Naziv"
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Grad"
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826]"
                  />
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Adresa"
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826]"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-white">
                <button
                  onClick={() => setOpen(false)}
                  className="px-5 py-3 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
                >
                  Odustani
                </button>
                <button
                  onClick={submit}
                  className="px-6 py-3 rounded-xl bg-[#1a3826] hover:bg-[#142e1e] text-white text-xs font-black uppercase shadow-md active:scale-95 inline-flex items-center gap-2"
                >
                  <Check size={16} /> Sačuvaj
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
