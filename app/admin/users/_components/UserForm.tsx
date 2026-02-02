"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createUser, updateUser } from "@/app/actions/adminActions";
import { getRolePermissionPreset } from "@/app/actions/rolePresetActions";
import { createDepartment } from "@/app/actions/departmentActions";
import { GOD_MODE_ROLES } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { User, Shield, Settings, ChevronDown, ChevronRight, Loader2, Store, Plus, Trash2, CalendarDays } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ARCHITECT: "System Architect",
  SUPER_ADMIN: "Abteilungsleiter",
  ADMIN: "Management",
  MANAGER: "Restaurant Manager",
  CREW: "Crew",
};

const ROLE_ORDER: Role[] = ["SYSTEM_ARCHITECT", "SUPER_ADMIN", "ADMIN", "MANAGER", "CREW"];

const ROLE_RANK: Record<string, number> = {
  SYSTEM_ARCHITECT: 1,
  SUPER_ADMIN: 2,
  MANAGER: 3,
  ADMIN: 4,
  CREW: 5,
};

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

const createSchema = (isEdit: boolean) =>
  z.object({
    firstName: z.string().min(1, "Ime je obavezno"),
    lastName: z.string().min(1, "Prezime je obavezno"),
    email: z.string().email("Neispravan email"),
    password: isEdit ? z.string().optional() : z.string().min(6, "Lozinka mora imati min. 6 znakova"),
    role: z.enum(["SYSTEM_ARCHITECT", "SUPER_ADMIN", "ADMIN", "MANAGER", "CREW"]),
    departmentId: z.string().optional().nullable(),
    restaurantIds: z.array(z.string()).optional(),
    primaryRestaurantId: z.string().optional().nullable(),
    supervisorId: z.string().optional().nullable(),
  });

type FormValues = z.infer<ReturnType<typeof createSchema>>;

type VacationRow = { year: number; days: number };

function roleRequiresSupervisor(role: string) {
  return (ROLE_RANK[role] ?? 99) >= 3;
}
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
  vacationAllowances: VacationRow[];
  restaurantIds: string[];
  primaryRestaurantId: string | null;
  supervisorId: string | null;
  permissions: string[];
}

interface UserFormProps {
  restaurants: { id: string; name: string | null; code: string }[];
  departments: DepartmentOption[];
  supervisorCandidates: { id: string; name: string; email: string; role: string }[];
  initialData?: UserFormInitialData | null;
}

export default function UserForm({
  restaurants,
  departments,
  supervisorCandidates,
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
      restaurantIds: initialData?.restaurantIds ?? [],
      primaryRestaurantId: initialData?.primaryRestaurantId ?? null,
      supervisorId: initialData?.supervisorId ?? null,
    },
  });

  const role = form.watch("role") || "CREW";
  const requiresRestaurant = roleRequiresRestaurant(role);
  const requiresSupervisor = roleRequiresSupervisor(role);

  const eligibleSupervisors = supervisorCandidates.filter((s) => {
    if (isEdit && s.id === initialData?.id) return false;
    const rank = ROLE_RANK[s.role] ?? 99;
    const myRank = ROLE_RANK[role] ?? 99;
    return rank < myRank;
  });

  useEffect(() => {
    const sub = form.watch((_, { name }) => {
      if (name === "role") {
        const r = form.getValues("role") as Role;
        setIsLoadingPreset(true);
        getRolePermissionPreset(r).then((res) => {
          setIsLoadingPreset(false);
          if (res.success) setPermissionKeys(res.data.keys);
        });
        if (!roleRequiresSupervisor(r)) form.setValue("supervisorId", null);
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
        setDepartmentsList((prev) => [...prev, res.data!]);
        form.setValue("departmentId", res.data.id);
        setDepartmentModalOpen(false);
        setNewDeptName("");
        setNewDeptColor("#1a3826");
      }
    } catch (_e) {
      alert("Greška pri kreiranju odjela.");
    }
    setIsCreatingDept(false);
  };

  const onSubmit = async (data: FormValues) => {
    if (requiresRestaurant && (!data.restaurantIds || data.restaurantIds.length === 0)) {
      form.setError("restaurantIds", { message: "Odaberite barem jedan restoran" });
      return;
    }
    // Nadređeni obavezan samo ako postoji barem jedan mogući nadređeni u listi
    if (requiresSupervisor && eligibleSupervisors.length > 0 && !data.supervisorId) {
      form.setError("supervisorId", { message: "Nadređeni je obavezan za ovu rolu" });
      return;
    }
    if (!isEdit && !data.password) {
      form.setError("password", { message: "Lozinka je obavezna" });
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
          permissions: permissionKeys,
          restaurantIds,
          primaryRestaurantId,
          supervisorId: data.supervisorId || null,
          vacationAllowances,
        });
      } else {
        await createUser({
          name,
          email: data.email.trim().toLowerCase(),
          password: data.password!,
          role: data.role as Role,
          departmentId: data.departmentId || null,
          permissions: permissionKeys,
          restaurantIds,
          primaryRestaurantId,
          supervisorId: data.supervisorId || null,
          vacationAllowances,
        });
      }
      router.push("/admin/users");
      router.refresh();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Greška pri spremanju korisnika";
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
              Osnovni podaci
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ime</label>
                <input
                  {...form.register("firstName")}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                  placeholder="Ime"
                />
                {form.formState.errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.firstName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Prezime</label>
                <input
                  {...form.register("lastName")}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                  placeholder="Prezime"
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
                Lozinka {isEdit && "(ostaviti prazno ako se ne mijenja)"}
              </label>
              <input
                type="password"
                {...form.register("password")}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                placeholder={isEdit ? "•••••••• (opcionalno)" : "••••••••"}
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Odjel</label>
                <div className="flex gap-2">
                  <select
                    {...form.register("departmentId")}
                    className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                  >
                    <option value="">— Nije odabrano —</option>
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
                    title="Dodaj novi odjel"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>

            {requiresRestaurant && (
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Restorani (obavezno)
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

            {requiresSupervisor && (
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Nadređeni (obavezno)
                </label>
                <Controller
                  name="supervisorId"
                  control={form.control}
                  render={({ field }) => (
                    <select
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                    >
                      <option value="">— Odaberi nadređenog —</option>
                      {eligibleSupervisors.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({ROLE_LABELS[s.role] || s.role})
                        </option>
                      ))}
                    </select>
                  )}
                />
                {form.formState.errors.supervisorId && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.supervisorId.message}</p>
                )}
              </div>
            )}
          </div>

          {/* C: Godišnji odmor (dinamička lista) */}
          <div className="p-6">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wider mb-4">
              <CalendarDays size={18} className="text-[#1a3826]" />
              Godišnji odmor po godinama
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
                    placeholder="dana"
                  />
                  <span className="text-sm text-slate-500">dana</span>
                  <button
                    type="button"
                    onClick={() => removeVacationRow(index)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Ukloni red"
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
              Moduli i permisije
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Odabrana rola automatski dodjeljuje set permisija. Ručno dodajte ili uklonite po potrebi.
            </p>
            {isLoadingPreset ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                Učitavanje permisija…
              </div>
            ) : GOD_MODE_ROLES.has(role) ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                <span className="text-sm font-semibold text-emerald-800">
                  Ova rola ima sve permisije automatski.
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
                  Sakrij napredne opcije
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
                  {isEdit ? "Spremanje…" : "Kreiranje…"}
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

      {/* Modal: Novi odjel */}
      {departmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Novi odjel</h3>
            <form onSubmit={handleCreateDepartment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Naziv</label>
                <input
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826]"
                  placeholder="npr. RL, Office"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Boja (HEX)</label>
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
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDepartmentModalOpen(false);
                    setNewDeptName("");
                    setNewDeptColor("#1a3826");
                  }}
                  className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-gray-100"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={isCreatingDept}
                  className="px-4 py-2 rounded-lg font-bold bg-[#1a3826] text-white hover:bg-[#142d1f] disabled:opacity-50"
                >
                  {isCreatingDept ? "Kreiranje…" : "Kreiraj"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
