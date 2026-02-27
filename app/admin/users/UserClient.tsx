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
  UserCog,
  CalendarDays,
  User,
} from "lucide-react";
import Link from "next/link";
import { createUser, deleteUser, updateUser } from "../../actions/adminActions";
import { toast } from "sonner";
import { getRolePermissionPreset } from "../../actions/rolePresetActions";
import { PERMISSIONS, ALL_PERMISSION_KEYS, GOD_MODE_ROLES } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";

type AllowancesMap = Record<number, number>;

interface UserProps {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
  role: Role;
  departmentId: string | null;
  departmentName: string | null;
  permissions: string[];
  restaurantIds?: string[];
  vacationEntitlement: number;
  vacationCarryover: number;
  vacationAllowances?: AllowancesMap;
  isActive?: boolean;
}

interface RestaurantProps {
  id: string;
  name: string;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface UserClientProps {
  users: UserProps[];
  restaurants: RestaurantProps[];
  departments?: DepartmentOption[];
  embedded?: boolean;
}

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

// ✅ Role enum ostaje isti, ali label u UI je po želji
const ROLE_LABELS: Record<Role, string> = {
  SYSTEM_ARCHITECT: "SYSTEM_ARCHITECT",
  SUPER_ADMIN: "Abteilungsleiter",
  ADMIN: "Management",
  MANAGER: "Restaurant Manager",
  SHIFT_LEADER: "Shift Leader",
  CREW: "Crew",
};

const roles: Role[] = ["SYSTEM_ARCHITECT", "SUPER_ADMIN", "ADMIN", "MANAGER", "SHIFT_LEADER", "CREW"];

function isGodMode(role: Role) {
  return GOD_MODE_ROLES.has(String(role));
}

function safeInt(v: any, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  return Math.floor(n);
}

export default function UserClient({ users = [], restaurants = [], departments = [], embedded = false }: UserClientProps) {
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isRoleApplying, setIsRoleApplying] = useState(false);

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
    departmentId: "" as string,
    vacationEntitlement: 20,
    vacationCarryover: 0,
    restaurantIds: [] as string[],
    primaryRestaurantId: "" as string,
    permissions: [] as string[],
    vacationAllowances: YEARS.reduce((acc, y) => {
      acc[y] = 0;
      return acc;
    }, {} as AllowancesMap),
  });

  const applyRolePreset = async (nextRole: Role) => {
    // Uvijek prvo setuj rolu (da UI odmah reflektuje izbor)
    setFormData((prev) => ({ ...prev, role: nextRole }));

    if (isGodMode(nextRole)) {
      // God-mode: permisije nisu ručne
      setFormData((prev) => ({ ...prev, role: nextRole, permissions: ALL_PERMISSION_KEYS }));
      return;
    }

    setIsRoleApplying(true);
    const res = await getRolePermissionPreset(nextRole);
    setIsRoleApplying(false);

    if (!res.success) {
      // Fail-safe: bolje prazno nego pogrešno
      setFormData((prev) => ({ ...prev, role: nextRole, permissions: [] }));
      return;
    }

    setFormData((prev) => ({ ...prev, role: nextRole, permissions: res.data.keys }));
  };

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

  // ✅ Lista kandidata za nadređenog:
  // - ne uključujemo CREW (po defaultu), ali ti možeš promijeniti logiku
  const supervisorOptions = useMemo(() => {
    return users
      .filter((u) => u.isActive !== false) // samo aktivni
      .filter((u) => u.role !== "CREW") // nadređeni obično nije CREW
      .map((u) => ({
        id: u.id,
        name: u.name || "Benutzer",
        email: u.email || "",
        role: u.role,
      }));
  }, [users]);

  const openCreate = () => {
    if (embedded) {
      router.push("/admin/users/create");
      return;
    }
    setIsEditing(false);
    setFormData({
      id: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "CREW",
      departmentId: "",
      vacationEntitlement: 20,
      vacationCarryover: 0,
      restaurantIds: [],
      primaryRestaurantId: "",
      permissions: [],
      vacationAllowances: YEARS.reduce((acc, y) => {
        acc[y] = 0;
        return acc;
      }, {} as AllowancesMap),
    });
    setIsModalOpen(true);
    // Default: CREW → automatski povuci preset permisije
    void applyRolePreset("CREW");
  };

  // Kept for future use (e.g. edit from table row)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for edit flow
  const _openEdit = (u: UserProps) => {
    setIsEditing(true);

    const full = (u.name || "").trim();
    const parts = full.split(/\s+/);
    const firstName = parts.shift() || "";
    const lastName = parts.join(" ");

    // ✅ FIX: primaryRestaurantId – pošto page.tsx ne šalje "restaurants" relaciju u client,
    // ovdje uzimamo "prvi" restoran kao primary (možeš kasnije dodati true primary iz baze ako želiš).
    const fallbackPrimary = (u.restaurantIds || [])[0] || "";

    const allowancesIn = u.vacationAllowances || {};
    const allowanceMap: AllowancesMap = YEARS.reduce((acc, y) => {
      acc[y] = safeInt(allowancesIn[y], 0);
      return acc;
    }, {} as AllowancesMap);

    setFormData({
      id: u.id,
      firstName,
      lastName,
      email: u.email || "",
      password: "",
      role: u.role,
      departmentId: u.departmentId || "",
      vacationEntitlement: safeInt(u.vacationEntitlement, 20),
      vacationCarryover: safeInt(u.vacationCarryover, 0),
      restaurantIds: u.restaurantIds || [],
      primaryRestaurantId: fallbackPrimary,
      permissions: u.permissions || [],
      vacationAllowances: allowanceMap,
    });

    setIsModalOpen(true);
  };

  const togglePerm = (key: string) => {
    if (isRoleApplying || isSaving) return;
    setFormData((prev) => {
      const exists = prev.permissions.includes(key);
      const next = exists ? prev.permissions.filter((p) => p !== key) : [...prev.permissions, key];
      return { ...prev, permissions: next };
    });
  };

  const setMany = (keys: string[], value: boolean) => {
    if (isRoleApplying || isSaving) return;
    setFormData((prev) => {
      const current = new Set(prev.permissions);
      keys.forEach((k) => (value ? current.add(k) : current.delete(k)));
      return { ...prev, permissions: Array.from(current) };
    });
  };

  const handleSubmit = async () => {
    if (isSaving) return;

    const composedName = `${formData.firstName} ${formData.lastName}`.trim();

    const vacationAllowancesArray = Object.entries(formData.vacationAllowances).map(([y, d]) => ({
      year: Number(y),
      days: Number(d),
    }));

    const payload = {
      id: formData.id,
      name: composedName,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      departmentId: formData.departmentId || null,
      vacationEntitlement: safeInt(formData.vacationEntitlement, 20),
      vacationCarryover: safeInt(formData.vacationCarryover, 0),
      restaurantIds: formData.restaurantIds,
      primaryRestaurantId: formData.primaryRestaurantId,
      permissions: formData.permissions,
      vacationAllowances: vacationAllowancesArray,
    };

    if (!payload.name || !formData.firstName || !formData.lastName || !payload.email) {
      toast.error("Name und E-Mail sind erforderlich.");
      return;
    }

    try {
      setIsSaving(true);
      if (!isEditing) {
        if (!payload.password) {
          toast.error("Passwort ist bei der Erstellung erforderlich.");
          setIsSaving(false);
          return;
        }
        await createUser(payload as any);
      } else {
        await updateUser(payload as any);
      }
      setIsModalOpen(false);
      router.refresh();
      toast.success(isEditing ? "Benutzer aktualisiert." : "Benutzer erstellt.");
    } catch (e: any) {
      toast.error(e.message || "Fehler aufgetreten.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Benutzer wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) return;
    try {
      setDeletingId(id);
      await deleteUser(id);
      toast.success("Benutzer gelöscht.");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Fehler aufgetreten.");
    } finally {
      setDeletingId(null);
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
  return (
    <div className={embedded ? "space-y-6" : "min-h-screen bg-background p-4 md:p-10 font-sans text-foreground"}>
      <div className={embedded ? "space-y-6" : "max-w-[1600px] mx-auto space-y-6 md:space-y-8"}>
        {/* HEADER - sakriven kada embedded */}
        {!embedded && (
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] uppercase tracking-tighter">
              BENUTZERVERWALTUNG
            </h1>
            <p className="text-muted-foreground text-sm font-semibold">Benutzer anlegen und Berechtigungen zuweisen</p>
          </div>

          <div className="flex items-center gap-3">
            {embedded ? (
              <Link
                href="/admin/users/create"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] md:min-h-0 bg-[#1a3826] hover:bg-[#142e1e] text-white rounded-xl text-xs font-black uppercase shadow-md active:scale-95"
              >
                <Plus size={16} /> Neuen Benutzer anlegen
              </Link>
            ) : (
              <button
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] md:min-h-0 bg-[#1a3826] hover:bg-[#142e1e] text-white rounded-xl text-xs font-black uppercase shadow-md active:scale-95"
              >
                <Plus size={16} /> Neuen Benutzer anlegen
              </button>
            )}

            <a
              href="/admin/restaurants"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] md:min-h-0 bg-white hover:bg-muted text-foreground rounded-xl text-xs font-black uppercase shadow-sm border border-border active:scale-95"
            >
              <Building2 size={16} className="text-[#1a3826]" /> Standort hinzufügen
            </a>
          </div>
        </div>
        )}

        {/* TOOLBAR */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-border flex flex-col sm:flex-row items-stretch sm:items-center gap-3 min-h-[44px]">
          <div className="flex-1 flex items-center gap-3 min-h-[44px]">
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Benutzer suchen..."
              className="bg-transparent outline-none text-sm font-bold text-foreground w-full min-h-[36px]"
            />
          </div>
          <Link
            href="/admin/users/create"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] bg-[#1a3826] hover:bg-[#142e1e] text-white rounded-xl text-xs font-black uppercase shadow-md active:scale-95 shrink-0"
          >
            <Plus size={16} /> Benutzer hinzufügen
          </Link>
        </div>

        {/* MOBILE CARD VIEW */}
        <div className="block md:hidden space-y-4">
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className="bg-white rounded-2xl border border-border shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-12 w-12 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-base font-bold overflow-hidden shrink-0 flex-shrink-0">
                    {u.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.image} alt="" className="h-full w-full object-cover" />
                    ) : (u.name || "").trim() ? (
                      (u.name || "").trim().charAt(0).toUpperCase()
                    ) : (
                      <User size={24} className="opacity-90" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-base text-foreground truncate">{u.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{u.email}</p>
                  <span className="inline-flex items-center gap-2 mt-3 px-2.5 py-1 rounded-lg bg-muted text-[10px] font-black uppercase text-muted-foreground">
                    {isGodMode(u.role) && <ShieldCheck size={12} className="text-[#1a3826] shrink-0" />}
                    {ROLE_LABELS[u.role]}
                  </span>
                    {(u.restaurantIds || []).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {(u.restaurantIds || []).slice(0, 3).map((rid) => {
                          const r = restaurants.find((x) => x.id === rid);
                          return (
                            <span key={rid} className="text-[9px] bg-muted px-2 py-1 rounded border border-border text-muted-foreground">
                              {r?.name || "Restaurant"}
                            </span>
                          );
                        })}
                        {(u.restaurantIds || []).length > 3 && (
                          <span className="text-[9px] text-slate-400">+{(u.restaurantIds || []).length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="flex h-11 w-11 items-center justify-center bg-muted hover:bg-accent text-foreground rounded-xl transition-colors"
                    title="Bearbeiten"
                  >
                    <Pencil size={18} />
                  </Link>
                  <button
                    onClick={() => handleDelete(u.id)}
                    disabled={deletingId === u.id}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                      deletingId === u.id
                        ? "bg-red-50 text-red-300 cursor-not-allowed"
                        : "bg-red-50 hover:bg-red-100 text-red-700"
                    }`}
                    title="Löschen"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-muted/50 border-b border-border text-[10px] font-black text-slate-400 uppercase">
            <div className="col-span-4">Benutzer</div>
            <div className="col-span-2">Rolle</div>
            <div className="col-span-4">Zugewiesene Restaurants</div>
            <div className="col-span-2 text-right">Aktionen</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredUsers.map((u) => (
              <div key={u.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted transition-colors">
                <div className="col-span-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#1a3826] text-white flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 flex-shrink-0">
                    {u.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.image} alt="" className="h-full w-full object-cover" />
                    ) : (u.name || "").trim() ? (
                      (u.name || "").trim().charAt(0).toUpperCase()
                    ) : (
                      <User size={20} className="opacity-90" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-foreground truncate">{u.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{u.email}</div>
                  </div>
                </div>

                <div className="col-span-2">
                  <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-muted text-[10px] font-black uppercase text-muted-foreground">
                    {isGodMode(u.role) && <ShieldCheck size={14} className="text-[#1a3826]" />}
                    {ROLE_LABELS[u.role]}
                  </span>
                </div>

                <div className="col-span-4 flex flex-wrap gap-1">
                  {(u.restaurantIds || []).slice(0, 4).map((rid) => {
                    const r = restaurants.find((x) => x.id === rid);
                    return (
                      <span key={rid} className="text-[9px] bg-muted px-2 py-1 rounded border border-border">
                        {r?.name || "Restaurant"}
                      </span>
                    );
                  })}
                  {(u.restaurantIds || []).length > 4 && (
                    <span className="text-[9px] bg-white px-2 py-1 rounded border border-border text-muted-foreground">
                      +{(u.restaurantIds || []).length - 4}
                    </span>
                  )}
                </div>

                <div className="col-span-2 flex justify-end gap-2">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="p-2 bg-muted hover:bg-accent text-foreground rounded-xl transition-colors inline-flex"
                    title="Bearbeiten"
                  >
                    <Pencil size={16} />
                  </Link>
                  <button
                    onClick={() => handleDelete(u.id)}
                    disabled={deletingId === u.id}
                    className={`p-2 rounded-xl transition-colors ${
                      deletingId === u.id
                        ? "bg-red-50 text-red-300 cursor-not-allowed"
                        : "bg-red-50 hover:bg-red-100 text-red-700"
                    }`}
                    title="Löschen"
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
                <div className="shrink-0 p-6 bg-muted border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-foreground">{isEditing ? "Benutzer bearbeiten" : "Neuen Benutzer anlegen"}</h2>
                    <p className="text-xs text-muted-foreground font-semibold">
                      Globale Berechtigungen • ADMIN/SYSTEM_ARCHITECT haben alle automatisch
                    </p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-accent" aria-label="Schließen">
                    <X />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* LEFT: Basic + Restaurants + Supervisor + Allowance */}
                    <div className="xl:col-span-4 space-y-4">
                      <div className="bg-white border border-border rounded-2xl p-5">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Grunddaten</h3>

                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                              value={formData.firstName}
                              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                              placeholder="Vorname"
                              className="w-full p-3 rounded-xl border border-border text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
                            />
                            <input
                              value={formData.lastName}
                              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                              placeholder="Nachname"
                              className="w-full p-3 rounded-xl border border-border text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
                            />
                          </div>

                          <input
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="Email"
                            className="w-full p-3 rounded-xl border border-border text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
                          />

                          <input
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder={isEditing ? "Neues Passwort (optional)" : "Passwort"}
                            type="password"
                            className="w-full p-3 rounded-xl border border-border text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <select
                              value={formData.role}
                              onChange={(e) => void applyRolePreset(e.target.value as Role)}
                              disabled={isRoleApplying || isSaving}
                              className="w-full p-3 rounded-xl border border-border text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
                            >
                              {roles.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </select>

                            <select
                              value={formData.departmentId}
                              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                              disabled={isSaving}
                              className="w-full p-3 rounded-xl border border-border text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
                            >
                              <option value="">— Nicht ausgewählt —</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {isRoleApplying && (
                            <div className="text-[11px] font-bold text-muted-foreground mt-2">
                              Berechtigungs-Preset wird geladen…
                            </div>
                          )}
                        </div>

                        {godMode && (
                          <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-2">
                            <ShieldCheck size={18} /> Diese Rolle erhält automatisch alle Berechtigungen.
                          </div>
                        )}
                      </div>

                      {/* ✅ NOVO: godišnji po godini */}
                      <div className="bg-white border border-border rounded-2xl p-5">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4 inline-flex items-center gap-2">
                          <CalendarDays size={14} /> Urlaub pro Jahr (2025–2030)
                        </h3>

                        <div className="grid grid-cols-2 gap-3">
                          {YEARS.map((y) => (
                            <div key={y} className="space-y-1">
                              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{y}</div>
                              <input
                                inputMode="numeric"
                                value={String(formData.vacationAllowances[y] ?? 0)}
                                onChange={(e) => {
                                  const n = safeInt(e.target.value, 0);
                                  setFormData((prev) => ({
                                    ...prev,
                                    vacationAllowances: { ...prev.vacationAllowances, [y]: n },
                                  }));
                                }}
                                disabled={isSaving}
                                className="w-full p-3 rounded-xl border border-border text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826] bg-white"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </div>

                        <p className="mt-3 text-[11px] text-muted-foreground font-semibold leading-relaxed">
                          Ovo su “dani godišnjeg” za odabranu godinu. Modul godišnjih će ovo koristiti za računanje preostalog stanja.
                        </p>
                      </div>

                      <div className="bg-white border border-border rounded-2xl p-5">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Zugewiesene Restaurants</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                          {restaurants.map((r) => {
                            const checked = formData.restaurantIds.includes(r.id);
                            return (
                              <label
                                key={r.id}
                                className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                                  checked ? "border-[#1a3826] bg-[#1a3826]/5" : "border-border hover:bg-muted"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const ids = new Set(formData.restaurantIds);
                                    if (e.target.checked) ids.add(r.id);
                                    else ids.delete(r.id);
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
                      <div className="bg-white border border-border rounded-2xl overflow-hidden">
                        {/* Top bar */}
                        <div className="p-5 bg-muted border-b border-border flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground inline-flex items-center gap-2">
                              <Layers size={14} /> Berechtigungen
                            </h3>
                            <p className="text-xs text-muted-foreground font-semibold mt-1">
                              Links Modul wählen, rechts Berechtigungen setzen • {formData.permissions.length}/{ALL_PERMISSION_KEYS.length} gesamt
                            </p>
                          </div>

                          {!godMode && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setFormData({ ...formData, permissions: ALL_PERMISSION_KEYS })}
                                disabled={isRoleApplying || isSaving}
                                className="px-3 py-2 rounded-xl bg-muted hover:bg-accent text-[10px] font-black uppercase"
                              >
                                Alle auswählen
                              </button>
                              <button
                                onClick={() => setFormData({ ...formData, permissions: [] })}
                                disabled={isRoleApplying || isSaving}
                                className="px-3 py-2 rounded-xl bg-white hover:bg-muted border border-border text-[10px] font-black uppercase text-foreground inline-flex items-center gap-2"
                              >
                                <Eraser size={14} /> Alle löschen
                              </button>
                            </div>
                          )}
                        </div>

                        {godMode ? (
                          <div className="p-6">
                            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-900 text-sm font-bold">
                              Berechtigungen sind für diese Rolle automatisch gesetzt.
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-12">
                            {/* Module list */}
                            <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-border p-5">
                              <div className="flex items-center gap-2 mb-3">
                                <Search size={16} className="text-slate-400" />
                                <input
                                  value={moduleQuery}
                                  onChange={(e) => setModuleQuery(e.target.value)}
                                  placeholder="Modul suchen…"
                                  className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826]"
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
                                        active ? "border-[#1a3826] bg-[#1a3826]/5" : "border-border hover:bg-muted"
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="font-black text-foreground truncate">{g.title}</div>
                                        {g.subtitle && <div className="text-xs text-muted-foreground font-semibold truncate">{g.subtitle}</div>}
                                        <div className="mt-2 text-[10px] font-black uppercase text-muted-foreground">
                                          {stats.selected}/{stats.total} ausgewählt
                                        </div>
                                      </div>

                                      <div
                                        className={`shrink-0 h-8 w-8 rounded-xl border flex items-center justify-center ${
                                          active
                                            ? "border-[#1a3826] text-[#1a3826] bg-white"
                                            : "border-border text-slate-400 bg-white"
                                        }`}
                                      >
                                        <ChevronRight size={16} />
                                      </div>
                                    </button>
                                  );
                                })}

                                {modulesFiltered.length === 0 && (
                                  <div className="p-6 rounded-2xl border border-border text-sm font-bold text-muted-foreground bg-white">
                                    Keine Ergebnisse für diese Suche.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Permissions for active module */}
                            <div className="lg:col-span-7 p-5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                <div>
                                  <div className="font-black text-foreground">{activeModule?.title}</div>
                                  {activeModule?.subtitle && (
                                    <div className="text-xs text-muted-foreground font-semibold">{activeModule.subtitle}</div>
                                  )}
                                  <div className="text-[10px] font-black uppercase text-muted-foreground mt-2">
                                    {activeSelected}/{activeKeys.length} in diesem Modul ausgewählt
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setMany(activeKeys, !(activeSelected === activeKeys.length && activeKeys.length > 0))}
                                    disabled={isRoleApplying || isSaving}
                                    className="px-3 py-2 rounded-xl text-[10px] font-black uppercase border transition-colors bg-white text-foreground border-border hover:bg-muted"
                                  >
                                    Alle auswählen
                                  </button>

                                  <button
                                    onClick={() => setMany(activeKeys, false)}
                                    disabled={isRoleApplying || isSaving}
                                    className="px-3 py-2 rounded-xl bg-white hover:bg-muted border border-border text-[10px] font-black uppercase text-foreground inline-flex items-center gap-2"
                                  >
                                    <Eraser size={14} /> Löschen
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 mb-4">
                                <Search size={16} className="text-slate-400" />
                                <input
                                  value={permQuery}
                                  onChange={(e) => setPermQuery(e.target.value)}
                                  placeholder="Berechtigung in diesem Modul suchen…"
                                  className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1a3826]"
                                />
                              </div>

                              <div className="space-y-2">
                                {activeItemsFiltered.map((item) => {
                                  const checked = formData.permissions.includes(item.key);
                                  return (
                                    <label
                                      key={item.key}
                                      className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer text-sm font-bold transition-colors ${
                                        checked ? "border-[#1a3826] bg-[#1a3826]/5" : "border-border hover:bg-muted"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={isRoleApplying || isSaving}
                                        onChange={() => togglePerm(item.key)}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-foreground">{item.label}</div>
                                        <div className="text-[10px] font-mono text-slate-400 truncate">{item.key}</div>
                                      </div>
                                    </label>
                                  );
                                })}

                                {activeItemsFiltered.length === 0 && (
                                  <div className="p-6 rounded-2xl border border-border text-sm font-bold text-muted-foreground bg-white">
                                    Keine Berechtigungen für diesen Filter.
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
                <div className="shrink-0 p-6 border-t border-border flex justify-end gap-3 bg-white">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSaving}
                    className="px-5 py-3 rounded-xl border border-border text-xs font-black uppercase text-foreground hover:bg-muted"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSaving || isRoleApplying}
                    className={`px-6 py-3 rounded-xl text-white text-xs font-black uppercase shadow-md inline-flex items-center gap-2 ${
                      isSaving || isRoleApplying
                        ? "bg-[#1a3826]/60 cursor-not-allowed"
                        : "bg-[#1a3826] hover:bg-[#142e1e] active:scale-95"
                    }`}
                  >
                    <Check size={16} /> {isSaving ? "Speichern…" : "Speichern"}
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
