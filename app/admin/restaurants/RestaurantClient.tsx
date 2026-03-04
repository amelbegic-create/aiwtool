"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Power, Search, X, Check, ImageIcon, Loader2 } from "lucide-react";
import {
  createRestaurant,
  deleteRestaurant,
  toggleRestaurantStatus,
  updateRestaurant,
  uploadRestaurantImage,
} from "@/app/actions/restaurantAdminActions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

type RestaurantRow = {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  isActive: boolean;
   tagline?: string;
   photoUrl?: string;
};
export default function RestaurantClient({
  restaurants,
}: {
  restaurants: RestaurantRow[];
}) {
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
  const [uploadingHero, setUploadingHero] = useState(false);

  const [form, setForm] = useState({
    id: "",
    code: "",
    name: "",
    city: "",
    address: "",
    tagline: "",
    photoUrl: "",
  });

  const openCreate = () => {
    setEditing(false);
    setForm({ id: "", code: "", name: "", city: "", address: "", tagline: "", photoUrl: "" });
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
      tagline: r.tagline || "",
      photoUrl: r.photoUrl || "",
    });
    setOpen(true);
  };

  const handleHeroImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte wählen Sie ein Bild (z. B. JPG, PNG).");
      return;
    }
    e.target.value = "";
    setUploadingHero(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadRestaurantImage(formData);
      if (result.success) {
        setForm((prev) => ({ ...prev, photoUrl: result.url }));
        toast.success("Titelbild wurde aktualisiert.");
      } else {
        toast.error(result.error || "Fehler beim Hochladen.");
      }
    } catch {
      toast.error("Fehler beim Hochladen.");
    } finally {
      setUploadingHero(false);
    }
  };

  const submit = async () => {
    try {
      if (!form.code.trim() || !form.name.trim()) return alert("Store-Nummer und Name sind erforderlich.");

      if (!editing) {
        await createRestaurant({
          code: form.code,
          name: form.name,
          city: form.city,
          address: form.address,
          tagline: form.tagline,
          photoUrl: form.photoUrl,
        });
      } else {
        await updateRestaurant({
          id: form.id,
          code: form.code,
          name: form.name,
          city: form.city,
          address: form.address,
          tagline: form.tagline,
          photoUrl: form.photoUrl,
        });
      }

      setOpen(false);
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Fehler");
    }
  };

  const del = async (id: string) => {
    if (!confirm("Restaurant wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) return;
    try {
      await deleteRestaurant(id);
      router.refresh();
      toast.success("Restaurant gelöscht.");
    } catch (e: any) {
      toast.error(e.message || "Fehler");
    }
  };

  const toggle = async (id: string, current: boolean) => {
    try {
      await toggleRestaurantStatus(id, current);
      router.refresh();
      toast.success(current ? "Restaurant deaktiviert." : "Restaurant aktiviert.");
    } catch (e: any) {
      toast.error(e.message || "Fehler");
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 font-sans text-foreground">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter">
              STANDORT <span className="text-[#FFC72C]">VERWALTUNG</span>
            </h1>
            <p className="text-muted-foreground text-sm font-semibold mt-1">
              Standorte anlegen und verwalten (globale Einstellungen)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#1a3826] hover:bg-[#142e1e] text-white rounded-xl text-xs font-black uppercase shadow-md active:scale-95"
            >
              <Plus size={16} /> Standort hinzufügen
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-border flex items-center gap-3">
          <Search size={16} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Standort suchen…"
            className="bg-transparent outline-none text-sm font-bold text-foreground w-full"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-muted/50 border-b border-border text-[10px] font-black text-muted-foreground uppercase">
            <div className="col-span-2">Store-Nr.</div>
            <div className="col-span-4">Name</div>
            <div className="col-span-3">Stadt/Ort</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Aktionen</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-accent transition-colors"
              >
                <div className="col-span-2 font-mono text-sm font-bold text-foreground">
                  {r.code}
                </div>

                <div className="col-span-4">
                  <div className="font-bold text-sm text-slate-800">{r.name}</div>
                  {r.address && <div className="text-[10px] text-muted-foreground">{r.address}</div>}
                </div>

                <div className="col-span-3 text-sm font-bold text-muted-foreground">
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
                    {r.isActive ? "Aktiv" : "Inaktiv"}
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
                    title="Löschen"
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
              <div className="p-6 bg-slate-50 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">
                    {editing ? "Standort bearbeiten" : "Standort hinzufügen"}
                  </h2>
                  <p className="text-xs text-muted-foreground font-medium">Store-Nummer muss eindeutig sein</p>
                </div>
                <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-accent">
                  <X />
                </button>
              </div>

              <div className="p-6 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="Code (npr. SA01)"
                    className="w-full p-3 rounded-xl border border-border text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826]"
                  />
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Name"
                    className="w-full p-3 rounded-xl border border-border text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Stadt/Ort"
                    className="w-full p-3 rounded-xl border border-border text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826]"
                  />
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Adresa"
                    className="w-full p-3 rounded-xl border border-border text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 items-stretch">
                  <div className="col-span-2">
                    <input
                      value={form.tagline}
                      onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                      placeholder='Tagline (npr. "Der Mäcci am Schwedenplatz")'
                      className="w-full p-3 rounded-xl border border-border text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826]"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Kurzbeschreibung, die auf dem Dashboard als Untertitel des Restaurants erscheint.
                    </p>
                  </div>
                  <div className="col-span-1 space-y-2">
                    <label className="text-[11px] font-black uppercase text-muted-foreground block">
                      Titelbild
                    </label>
                    <label className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border text-[11px] font-black uppercase tracking-wide cursor-pointer hover:border-[#1a3826] hover:bg-muted">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleHeroImageChange}
                      />
                      {uploadingHero ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Upload läuft...
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-3 h-3" />
                          Bild auswählen
                        </>
                      )}
                    </label>
                    {form.photoUrl && (
                      <div className="relative mt-1 h-20 rounded-xl overflow-hidden border border-border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={form.photoUrl} alt="Restaurant Titelbild" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border flex justify-end gap-3 bg-white">
                <button
                  onClick={() => setOpen(false)}
                  className="px-5 py-3 rounded-xl border border-border text-xs font-black uppercase text-muted-foreground hover:bg-accent"
                >
                  Abbrechen
                </button>
                <button
                  onClick={submit}
                  className="px-6 py-3 rounded-xl bg-[#1a3826] hover:bg-[#142e1e] text-white text-xs font-black uppercase shadow-md active:scale-95 inline-flex items-center gap-2"
                >
                  <Check size={16} /> Speichern
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
