"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createUser, updateUser } from "@/app/actions/adminActions";
import { toast } from "sonner";
import { getRolePermissionPreset } from "@/app/actions/rolePresetActions";
import { createDepartment, updateDepartment, deleteDepartment } from "@/app/actions/departmentActions";
import { GOD_MODE_ROLES } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { User, Shield, Settings, ChevronDown, ChevronRight, Loader2, Plus, Trash2, CalendarDays, Pencil, X } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ARCHITECT: "System Architect",
  SUPER_ADMIN: "Abteilungsleiter",
  ADMIN: "Management",
  MANAGER: "Restaurant Manager",
  SHIFT_LEADER: "Šef smjene / Shift Leader",
  CREW: "Crew",
};

const ROLE_ORDER: Role[] = ["SYSTEM_ARCHITECT", "SUPER_ADMIN", "ADMIN", "MANAGER", "SHIFT_LEADER", "CREW"];

const ROLE_RANK: Record<string, number> = {
  SYSTEM_ARCHITECT: 1,
  SUPER_ADMIN: 2,
  ADMIN: 3,
  MANAGER: 4,
  SHIFT_LEADER: 5,
  CREW: 6,
};

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

const createSchema = (isEdit: boolean) =>
  z.object({
    firstName: z.string().min(1, "Vorname ist erforderlich"),
    lastName: z.string().min(1, "Nachname ist erforderlich"),
    email: z.string().email("Ungültige E-Mail-Adresse"),
    password: isEdit ? z.string().optional() : z.string().min(6, "Passwort mindestens 6 Zeichen"),
    role: z.enum(["SYSTEM_ARCHITECT", "SUPER_ADMIN", "ADMIN", "MANAGER", "SHIFT_LEADER", "CREW"]),
    departmentId: z.string().optional().nullable(),
    supervisorId: z.string().optional().nullable(),
    restaurantIds: z.array(z.string()).optional(),
    primaryRestaurantId: z.string().optional().nullable(),
  });

type FormValues = z.infer<ReturnType<typeof createSchema>>;

type VacationRow = { year: number; days: number };

function roleRequiresRestaurant(role: string) {
  return role !== "SYSTEM_ARCHITECT";
}

export interface DepartmentOption {
  id: string;
  name: string;
  color: string;
  restaurantId?: string | null;
}

export interface UserFormInitialData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  departmentId: string | null;
  supervisorId: string | null;
  vacationAllowances: VacationRow[];
  restaurantIds: string[];
  primaryRestaurantId: string | null;
  permissions: string[];
}

export type EligibleSupervisor = { id: string; name: string | null; email: string | null; role: string };

interface UserFormProps {
  restaurants: { id: string; name: string | null; code: string }[];
  departments: DepartmentOption[];
  eligibleSupervisors?: EligibleSupervisor[];
  initialData?: UserFormInitialData | null;
}

export default function UserForm({
  restaurants,
  departments,
  eligibleSupervisors = [],
  initialData,
}: UserFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [permissionKeys, setPermissionKeys] = useState<string[]>(initialData?.permissions ?? []);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoadingPreset, setIsLoadingPreset] = useState(false);
  const [openPermGroups, setOpenPermGroups] = useState<Set<string>>(new Set());
  const [vacationRows, setVacationRows] = useState<VacationRow[]>(
    initialData?.vacationAllowances?.length
      ? [...initialData.vacationAllowances]
      : [{ year: new Date().getFullYear(), days: 20 }]
  );
  const [departmentsList, setDepartmentsList] = useState<DepartmentOption[]>(departments);
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptColor, setNewDeptColor] = useState("#1a3826");
  const [isCreatingDept, setIsCreatingDept] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [editDeptColor, setEditDeptColor] = useState("#1a3826");
  const [isUpdatingDept, setIsUpdatingDept] = useState(false);
  const [isDeletingDeptId, setIsDeletingDeptId] = useState<string | null>(null);

  const togglePermGroup = (id: string) => {
    setOpenPermGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePermission = (key: string) => {
    setPermissionKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(createSchema(isEdit)),
    defaultValues: {
      firstName: initialData?.firstName ?? "",
      lastName: initialData?.lastName ?? "",
      email: initialData?.email ?? "",
      password: "",
      role: initialData?.role ?? "CREW",
      departmentId: initialData?.departmentId ?? null,
      supervisorId: initialData?.supervisorId ?? null,
      restaurantIds: initialData?.restaurantIds ?? [],
      primaryRestaurantId: initialData?.primaryRestaurantId ?? null,
    },
  });

  const role = form.watch("role") || "CREW";
  const requiresRestaurant = roleRequiresRestaurant(role);

  useEffect(() => {
    const sub = form.watch((_, { name }) => {
      if (name === "role") {
        const r = form.getValues("role") as Role;
        setIsLoadingPreset(true);
        getRolePermissionPreset(r).then((res) => {
          setIsLoadingPreset(false);
          if (res.success) setPermissionKeys(res.data.keys);
        });
        if (!roleRequiresRestaurant(r)) form.setValue("restaurantIds", []);
      }
    });
    return () => sub.unsubscribe();
  }, [form]);

  useEffect(() => {
    if (isEdit && initialData?.permissions) {
      setPermissionKeys(initialData.permissions);
    } else {
      getRolePermissionPreset(form.getValues("role") || "CREW").then((res) => {
        if (res.success) setPermissionKeys(res.data.keys);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run only on isEdit change
  }, [isEdit]);

  const addVacationYear = () => {
    const usedYears = new Set(vacationRows.map((r) => r.year));
    const nextYear = YEARS.find((y) => !usedYears.has(y)) ?? YEARS[YEARS.length - 1] + 1;
    setVacationRows((prev) => [...prev, { year: nextYear, days: 20 }]);
  };

  const removeVacationRow = (index: number) => {
    setVacationRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newDeptName.trim();
    if (!name) return;
    setIsCreatingDept(true);
    try {
      const res = await createDepartment({ name, color: newDeptColor });
      if (res.success && res.data) {
        toast.success("Abteilung erstellt.");
        setDepartmentsList((prev) => [...prev, res.data!]);
        form.setValue("departmentId", res.data.id);
        setDepartmentModalOpen(false);
        setNewDeptName("");
        setNewDeptColor("#1a3826");
      }
    } catch {
      alert("Fehler beim Erstellen der Abteilung.");
    }
    setIsCreatingDept(false);
  };

  const startEditDepartment = (d: DepartmentOption) => {
    setEditingDeptId(d.id);
    setEditDeptName(d.name);
    setEditDeptColor(d.color);
  };

  const cancelEditDepartment = () => {
    setEditingDeptId(null);
    setEditDeptName("");
    setEditDeptColor("#1a3826");
  };

  const handleUpdateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeptId) return;
    const name = editDeptName.trim();
    if (!name) return;
    setIsUpdatingDept(true);
    try {
      const dept = departmentsList.find((d) => d.id === editingDeptId);
      const res = await updateDepartment({
        id: editingDeptId,
        name,
        color: editDeptColor,
        restaurantId: dept?.restaurantId ?? null,
      });
      if (res.success) {
        setDepartmentsList((prev) =>
          prev.map((d) => (d.id === editingDeptId ? { ...d, name, color: editDeptColor } : d))
        );
        cancelEditDepartment();
      }
    } catch {
      alert("Fehler beim Aktualisieren der Abteilung.");
    }
    setIsUpdatingDept(false);
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm("Jeste li sigurni da želite obrisati ovaj odjel? Korisnici s ovim odjelom će ostati bez odjela.")) return;
    setIsDeletingDeptId(id);
    try {
      const res = await deleteDepartment(id);
      if (res.success) {
        toast.success("Abteilung gelöscht.");
        setDepartmentsList((prev) => prev.filter((d) => d.id !== id));
        if (form.getValues("departmentId") === id) form.setValue("departmentId", null);
        if (editingDeptId === id) cancelEditDepartment();
      }
    } catch {
      alert("Greška pri brisanju odjela.");
    }
    setIsDeletingDeptId(null);
  };

  const onSubmit = async (data: FormValues) => {
    if (requiresRestaurant && (!data.restaurantIds || data.restaurantIds.length === 0)) {
      form.setError("restaurantIds", { message: "Bitte mindestens ein Restaurant auswählen" });
      return;
    }
    if (!isEdit && !data.password) {
      form.setError("password", { message: "Passwort ist erforderlich" });
      return;
    }
    try {
      const name = `${data.firstName.trim()} ${data.lastName.trim()}`;
      const restaurantIds = data.restaurantIds || [];
      const primaryRestaurantId = restaurantIds.length > 0 ? restaurantIds[0] : null;
      const vacationAllowances = vacationRows.filter((r) => Number.isFinite(r.year) && r.days >= 0);

      if (isEdit && initialData) {
        await updateUser({
          id: initialData.id,
          name,
          email: data.email.trim().toLowerCase(),
          password: data.password?.trim() || undefined,
          role: data.role as Role,
          departmentId: data.departmentId || null,
          supervisorId: data.supervisorId || null,
          permissions: permissionKeys,
          restaurantIds,
          primaryRestaurantId,
          vacationAllowances,
        });
      } else {
        await createUser({
          name,
          email: data.email.trim().toLowerCase(),
          password: data.password!,
          role: data.role as Role,
          departmentId: data.departmentId || null,
          supervisorId: data.supervisorId || null,
          permissions: permissionKeys,
          restaurantIds,
          primaryRestaurantId,
          vacationAllowances,
        });
      }
      toast.success(isEdit ? "Korisnik ažuriran." : "Korisnik kreiran.");
      router.push("/admin/users");
      router.refresh();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Fehler beim Speichern des Benutzers";
      console.error("Create/Update user error:", e);
      alert(message);
    }
  };

  const permLabels = PERMISSIONS.flatMap((g) =>
    g.items.filter((i) => permissionKeys.includes(i.key)).map((i) => i.label)
  );

  const restaurantLabel = (r: { name: string | null; code: string }) =>
    (r.name && r.name.trim() !== "" ? r.name : r.code) || r.code;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 bg-[#1a3826]">
          <h1 className="text-xl font-black text-white uppercase tracking-tight">
            {isEdit ? "Uredi korisnika" : "Novi korisnik"}
          </h1>
          <p className="text-sm text-white/80 mt-0.5">
            {isEdit ? `ID: ${initialData?.id}` : "Unesite podatke za novog zaposlenika"}
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="divide-y divide-gray-100">
          {/* A: Osnovni podaci */}
          <div className="p-6">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wider mb-4">
              <User size={18} className="text-[#1a3826]" />
              Grunddaten
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Vorname</label>
                <input
                  {...form.register("firstName")}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                  placeholder="Vorname"
                />
                {form.formState.errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.firstName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nachname</label>
                <input
                  {...form.register("lastName")}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                  placeholder="Nachname"
                />
                {form.formState.errors.lastName && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
              <input
                type="email"
                {...form.register("email")}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                placeholder="ime@mcdonalds.ba"
              />
              {form.formState.errors.email && (
                <p className="text-red-500 text-xs mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Passwort {isEdit && "(leer lassen, wenn unverändert)"}
              </label>
              <input
                type="password"
                {...form.register("password")}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                placeholder={isEdit ? "•••••••• (optional)" : "••••••••"}
              />
              {form.formState.errors.password && (
                <p className="text-red-500 text-xs mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>
          </div>

          {/* B: Rola, odjel, restorani, nadređeni */}
          <div className="p-6">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wider mb-4">
              <Shield size={18} className="text-[#1a3826]" />
              Rola i hijerarhija
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Rola</label>
                <select
                  {...form.register("role")}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                >
                  {ROLE_ORDER.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r] || r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Abteilung</label>
                <div className="flex gap-2">
                  <select
                    {...form.register("departmentId")}
                    className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                  >
                    <option value="">— Nicht ausgewählt —</option>
                    {departmentsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setDepartmentModalOpen(true)}
                    className="flex-shrink-0 h-[44px] w-[44px] rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-[#1a3826] hover:text-[#1a3826] flex items-center justify-center transition-colors"
                    title="Neue Abteilung anlegen"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nadređeni (Vorgesetzter)</label>
                <select
                  {...form.register("supervisorId")}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                >
                  <option value="">— Keiner —</option>
                  {eligibleSupervisors
                    .filter((s) => !isEdit || s.id !== initialData?.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.email || s.id} ({ROLE_LABELS[s.role] || s.role})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-0.5">Für Mein Team und Urlaubsfreigabe</p>
              </div>
            </div>

            {requiresRestaurant && (
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Zugewiesene Restaurants (Pflicht)
                </label>
                <Controller
                  name="restaurantIds"
                  control={form.control}
                  defaultValue={[]}
                  render={({ field }) => (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-52 overflow-y-auto rounded-lg border border-gray-200 p-3 bg-gray-50/50">
                      {restaurants.map((r) => {
                        const selected = (field.value || []).includes(r.id);
                        return (
                          <label
                            key={r.id}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                              selected ? "border-[#1a3826] bg-[#1a3826]/5" : "border-gray-200 hover:bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...(field.value || []), r.id]
                                  : (field.value || []).filter((id) => id !== r.id);
                                field.onChange(next);
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-[#1a3826] focus:ring-[#1a3826]"
                            />
                            <span className="text-sm font-medium text-slate-800 truncate">
                              {restaurantLabel(r)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                />
                {form.formState.errors.restaurantIds && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.restaurantIds.message}</p>
                )}
              </div>
            )}

          </div>

          {/* C: Godišnji odmor (dinamička lista) */}
          <div className="p-6">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wider mb-4">
              <CalendarDays size={18} className="text-[#1a3826]" />
              Urlaub pro Jahr
            </h2>
            <div className="space-y-2">
              {vacationRows.map((row, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <select
                    value={row.year}
                    onChange={(e) => {
                      const y = Number(e.target.value);
                      setVacationRows((prev) => {
                        const next = [...prev];
                        next[index] = { ...next[index], year: y };
                        return next;
                      });
                    }}
                    className="w-28 min-h-[40px] px-3 py-2 rounded-lg border border-gray-300 text-slate-900 bg-white focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={row.days}
                    onChange={(e) => {
                      const d = Number(e.target.value);
                      setVacationRows((prev) => {
                        const next = [...prev];
                        next[index] = { ...next[index], days: d };
                        return next;
                      });
                    }}
                    className="w-20 min-h-[40px] px-3 py-2 rounded-lg border border-gray-300 text-slate-900 focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                    placeholder="Tage"
                  />
                  <span className="text-sm text-slate-500">Tage</span>
                  <button
                    type="button"
                    onClick={() => removeVacationRow(index)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Zeile entfernen"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addVacationYear}
                className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-slate-600 hover:border-[#1a3826] hover:text-[#1a3826] text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Dodaj godinu
              </button>
            </div>
          </div>

          {/* D: Permisije (Accordion – zatvoreno po defaultu) */}
          <div className="p-6">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wider mb-4">
              <Settings size={18} className="text-[#1a3826]" />
              Module und Berechtigungen
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Die gewählte Rolle vergibt automatisch Berechtigungen. Bei Bedarf manuell anpassen.
            </p>
            {isLoadingPreset ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                Berechtigungen werden geladen…
              </div>
            ) : GOD_MODE_ROLES.has(role) ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                <span className="text-sm font-semibold text-emerald-800">
                  Diese Rolle hat automatisch alle Berechtigungen.
                </span>
              </div>
            ) : !showAdvanced ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {permLabels.map((label) => (
                    <span
                      key={label}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(true)}
                  className="mt-3 text-sm font-semibold text-slate-600 hover:text-[#1a3826] flex items-center gap-1"
                >
                  <ChevronDown size={16} />
                  Napredno (ručna izmjena)
                </button>
              </>
            ) : (
              <div className="space-y-2">
                {PERMISSIONS.map((group) => {
                  const isOpen = openPermGroups.has(group.id);
                  return (
                    <div
                      key={group.id}
                      className="rounded-lg border border-gray-200 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => togglePermGroup(group.id)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left font-semibold text-slate-800 hover:bg-gray-50 transition-colors"
                      >
                        <span>{group.title}</span>
                        <ChevronRight
                          size={18}
                          className={`text-slate-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        />
                      </button>
                      {isOpen && (
                        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 space-y-2">
                          {group.subtitle && (
                            <p className="text-xs text-slate-500 mb-2">{group.subtitle}</p>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {group.items.map((item) => {
                              const checked = permissionKeys.includes(item.key);
                              return (
                                <label
                                  key={item.key}
                                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                                    checked
                                      ? "border-[#1a3826] bg-[#1a3826]/5"
                                      : "border-gray-100 hover:bg-white"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePermission(item.key)}
                                    className="h-4 w-4 rounded border-gray-300 text-[#1a3826] focus:ring-[#1a3826]"
                                  />
                                  <span className="text-sm font-medium text-slate-800">{item.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(false)}
                  className="mt-3 text-sm font-semibold text-slate-600 hover:text-[#1a3826] flex items-center gap-1"
                >
                  <ChevronDown size={16} className="rotate-180" />
                  Erweiterte Optionen ausblenden
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Link
              href="/admin/users"
              className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-lg font-bold text-slate-600 hover:bg-gray-200 transition-colors"
            >
              Odustani
            </Link>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="inline-flex items-center justify-center min-h-[44px] px-8 py-3 rounded-lg bg-[#1a3826] text-white font-bold hover:bg-[#142d1f] transition-colors disabled:opacity-50 gap-2"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {isEdit ? "Speichern…" : "Erstellen…"}
                </>
              ) : isEdit ? (
                "Sačuvaj izmjene"
              ) : (
                "Kreiraj korisnika"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal: Odjeli – lista, uređivanje, dodavanje */}
      {departmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-slate-900">Abteilungen</h3>
              <p className="text-sm text-slate-500 mt-0.5">Abteilung bearbeiten, löschen oder neu anlegen.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Lista odjela s Uredi / Obriši */}
              {departmentsList.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Vorhandene Abteilungen</h4>
                  <ul className="space-y-2">
                    {departmentsList.map((d) => (
                      <li key={d.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2">
                        {editingDeptId === d.id ? (
                          <form onSubmit={handleUpdateDepartment} className="flex-1 flex flex-wrap items-center gap-2">
                            <input
                              value={editDeptName}
                              onChange={(e) => setEditDeptName(e.target.value)}
                              className="flex-1 min-w-0 min-h-[36px] px-3 py-1.5 rounded border border-gray-300 text-sm focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                              placeholder="Name"
                              required
                            />
                            <input
                              type="color"
                              value={editDeptColor}
                              onChange={(e) => setEditDeptColor(e.target.value)}
                              className="h-8 w-10 rounded border border-gray-300 cursor-pointer"
                              title="Farbe"
                            />
                            <button
                              type="submit"
                              disabled={isUpdatingDept}
                              className="px-3 py-1.5 rounded-lg text-sm font-bold bg-[#1a3826] text-white hover:bg-[#142d1f] disabled:opacity-50"
                            >
                              {isUpdatingDept ? "…" : "Speichern"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditDepartment}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-gray-100"
                              title="Abbrechen"
                            >
                              <X size={18} />
                            </button>
                          </form>
                        ) : (
                          <>
                            <span
                              className="inline-block w-4 h-4 rounded flex-shrink-0"
                              style={{ backgroundColor: d.color }}
                              title={d.color}
                            />
                            <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 truncate">{d.name}</span>
                            <button
                              type="button"
                              onClick={() => startEditDepartment(d)}
                              className="p-2 rounded-lg text-slate-500 hover:bg-gray-100 hover:text-[#1a3826]"
                              title="Abteilung bearbeiten"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDepartment(d.id)}
                              disabled={isDeletingDeptId === d.id}
                              className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              title="Abteilung löschen"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Forma za novi odjel */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Neue Abteilung anlegen</h4>
                <form onSubmit={handleCreateDepartment} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Name</label>
                    <input
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                      placeholder="z. B. RL, Office"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Farbe (HEX)</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={newDeptColor}
                        onChange={(e) => setNewDeptColor(e.target.value)}
                        className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={newDeptColor}
                        onChange={(e) => setNewDeptColor(e.target.value)}
                        className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 font-mono text-sm focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                        placeholder="#1a3826"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isCreatingDept}
                    className="w-full px-4 py-2.5 rounded-lg font-bold bg-[#1a3826] text-white hover:bg-[#142d1f] disabled:opacity-50"
                  >
                    {isCreatingDept ? "Erstellen…" : "Abteilung anlegen"}
                  </button>
                </form>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  setDepartmentModalOpen(false);
                  setNewDeptName("");
                  setNewDeptColor("#1a3826");
                  cancelEditDepartment();
                }}
                className="w-full px-4 py-2.5 rounded-lg font-medium text-slate-600 hover:bg-gray-200"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
