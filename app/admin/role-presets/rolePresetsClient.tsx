"use client";

import { useEffect, useMemo, useState } from "react";
import { Role } from "@prisma/client";
import { PERMISSIONS, GOD_MODE_ROLES } from "@/lib/permissions";
import { Check, Eraser, Layers, Search, ShieldCheck } from "lucide-react";
import { getRolePermissionPreset, saveRolePermissionPreset } from "../../actions/rolePresetActions";

const roles: Role[] = ["SYSTEM_ARCHITECT", "SUPER_ADMIN", "ADMIN", "MANAGER", "CREW"];

function isGodMode(role: Role) {
  return GOD_MODE_ROLES.has(String(role));
}

export default function RolePresetsClient() {
  const [activeRole, setActiveRole] = useState<Role>("CREW");
  const [activeModuleId, setActiveModuleId] = useState<string>(PERMISSIONS[0]?.id || "rules");
  const [moduleQuery, setModuleQuery] = useState("");
  const [permQuery, setPermQuery] = useState("");

  const [keys, setKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const modulesFiltered = useMemo(() => {
    const q = moduleQuery.trim().toLowerCase();
    if (!q) return PERMISSIONS;
    return PERMISSIONS.filter(
      (g) => g.title.toLowerCase().includes(q) || (g.subtitle || "").toLowerCase().includes(q)
    );
  }, [moduleQuery]);

  const activeModule = useMemo(() => {
    return PERMISSIONS.find((g) => g.id === activeModuleId) || PERMISSIONS[0];
  }, [activeModuleId]);

  const activeKeys = useMemo(() => {
    const mod = activeModule;
    if (!mod) return [];
    return mod.items.map((i) => i.key);
  }, [activeModule]);

  const activeItemsFiltered = useMemo(() => {
    const mod = activeModule;
    if (!mod) return [];
    const q = permQuery.trim().toLowerCase();
    if (!q) return mod.items;
    return mod.items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)
    );
  }, [activeModule, permQuery]);

  const globalTotal = useMemo(() => PERMISSIONS.reduce((sum, g) => sum + g.items.length, 0), []);
  const globalSelected = keys.length;

  const activeSelected = useMemo(() => {
    const s = new Set(keys);
    return activeKeys.filter((k) => s.has(k)).length;
  }, [keys, activeKeys]);

  const activeAllOn = activeKeys.length > 0 && activeSelected === activeKeys.length;

  const toggleOne = (k: string) => {
    setKeys((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return Array.from(s);
    });
  };

  const setMany = (arr: string[], value: boolean) => {
    setKeys((prev) => {
      const s = new Set(prev);
      for (const k of arr) {
        if (value) s.add(k);
        else s.delete(k);
      }
      return Array.from(s);
    });
  };

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setIsLoading(true);
      const res = await getRolePermissionPreset(activeRole);
      if (!alive) return;
      setIsLoading(false);

      if (res.success) {
        setKeys(res.data.keys || []);
      } else {
        setKeys([]);
      }
    };

    if (isGodMode(activeRole)) {
      // God-mode: prikazujemo samo info, nema potrebe za fetch
      setKeys([]);
      setIsLoading(false);
      return;
    }

    void run();
    return () => {
      alive = false;
    };
  }, [activeRole]);

  const save = async () => {
    if (isSaving || isLoading) return;
    setIsSaving(true);
    const res = await saveRolePermissionPreset(activeRole, keys);
    setIsSaving(false);

    if (!res.success) {
      alert(res.error || "Greška pri snimanju.");
      return;
    }

    alert("Preset je sačuvan.");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter">
              ROLE <span className="text-[#FFC72C]">PRESETI</span>
            </h1>
            <p className="text-slate-600 text-sm font-semibold">
              Podesi permisije po roli jednom – kreiranje korisnika će ih automatski dodeljivati.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rola</div>
              <select
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value as Role)}
                className="mt-2 w-56 p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {!isGodMode(activeRole) ? (
              <button
                onClick={save}
                disabled={isSaving || isLoading}
                className={`px-6 py-4 rounded-2xl text-white text-xs font-black uppercase shadow-md inline-flex items-center gap-2 ${
                  isSaving || isLoading ? "bg-[#1a3826]/60 cursor-not-allowed" : "bg-[#1a3826] hover:bg-[#142e1e] active:scale-95"
                }`}
              >
                <Check size={16} /> {isSaving ? "Čuvam..." : "Sačuvaj"}
              </button>
            ) : (
              <div className="px-4 py-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold inline-flex items-center gap-2">
                <ShieldCheck size={16} /> God-mode rola (permisije su uvek sve)
              </div>
            )}
          </div>
        </div>

        {isGodMode(activeRole) ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-6">
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-900 text-sm font-bold">
              Za rolu <span className="font-black">{activeRole}</span> ne podešava se preset, jer sistem automatski daje sve permisije.
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 inline-flex items-center gap-2">
                  <Layers size={14} /> Permisije
                </h3>
                <p className="text-xs text-slate-600 font-semibold mt-1">
                  Levo odaberi modul, desno označi permisije • {globalSelected}/{globalTotal} ukupno
                </p>
                {isLoading && (
                  <p className="text-[11px] font-bold text-slate-500 mt-2">Učitavam preset iz baze...</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setKeys(PERMISSIONS.flatMap((g) => g.items.map((i) => i.key)))}
                  disabled={isLoading || isSaving}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[10px] font-black uppercase"
                >
                  Select all
                </button>
                <button
                  onClick={() => setKeys([])}
                  disabled={isLoading || isSaving}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[10px] font-black uppercase text-slate-700 inline-flex items-center gap-2"
                >
                  <Eraser size={14} /> Clear all
                </button>
              </div>
            </div>

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

                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {modulesFiltered.map((g) => {
                    const selected = g.items.filter((i) => keys.includes(i.key)).length;
                    const active = g.id === activeModuleId;
                    return (
                      <button
                        key={g.id}
                        onClick={() => setActiveModuleId(g.id)}
                        className={`w-full text-left p-3 rounded-2xl border transition-colors ${
                          active ? "border-[#1a3826] bg-[#1a3826]/5" : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="font-black text-slate-900">{g.title}</div>
                        {g.subtitle && <div className="text-xs text-slate-600 font-semibold truncate">{g.subtitle}</div>}
                        <div className="text-[10px] font-black uppercase text-slate-500 mt-2">
                          {selected}/{g.items.length} odabrano
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

              {/* Permissions */}
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
                      disabled={isLoading || isSaving}
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
                      disabled={isLoading || isSaving}
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
                    const checked = keys.includes(item.key);
                    return (
                      <label
                        key={item.key}
                        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer text-sm font-bold transition-colors ${
                          checked ? "border-[#1a3826] bg-[#1a3826]/5" : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isLoading || isSaving}
                          onChange={() => toggleOne(item.key)}
                        />
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
          </div>
        )}
      </div>
    </div>
  );
}
