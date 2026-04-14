"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/profileActions";
import {
  User, Mail, Save, Loader2, Hash, Layers, Users, Building2, ShieldCheck,
} from "lucide-react";

type UserProps = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  supervisorId: string | null;
  supervisorName: string | null;
  supervisorImage: string | null;
  department: { id: string; name: string; color: string } | null;
  restaurants: { id: string; code: string; name: string | null; isPrimary: boolean }[];
};

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ARCHITECT: "System Architect",
  ADMIN: "Admin",
  MANAGER: "Manager",
  MANAGEMENT: "Management",
  MITARBEITER: "Mitarbeiter",
};

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 min-h-[44px] px-6 py-3 rounded-xl bg-[#1a3826] text-white font-semibold text-sm hover:bg-[#142d1f] transition disabled:opacity-60"
    >
      {pending ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
      {pending ? "Speichern…" : "Änderungen speichern"}
    </button>
  );
}

export default function PersonalTab({ user }: { user: UserProps }) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleAction = async (formData: FormData) => {
    setMessage(null);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const result = await updateProfile({ name, email });
    if (result.success) {
      toast.success("Profil gespeichert.");
      setMessage({ type: "success", text: "Profil erfolgreich aktualisiert." });
    } else {
      setMessage({ type: "error", text: result.error });
    }
  };

  const primary = user.restaurants.find((r) => r.isPrimary) ?? user.restaurants[0];

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-xl font-black text-foreground">Profil bearbeiten</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Name, E-Mail und Kontoinformationen</p>
      </div>

      {/* Edit form */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#1a3826]/10 dark:bg-[#FFC72C]/10 text-[#1a3826] dark:text-[#FFC72C]">
            <User size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Persönliche Daten</h3>
            <p className="text-xs text-muted-foreground">Name und E-Mail-Adresse</p>
          </div>
        </div>
        <form action={handleAction} className="p-6 space-y-4">
          {message && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200" : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200"}`}>
              {message.text}
            </div>
          )}
          <Field icon={<User size={15} />} label="Vor- und Nachname" name="name" type="text" defaultValue={user.name ?? ""} />
          <Field icon={<Mail size={15} />} label="E-Mail-Adresse" name="email" type="email" defaultValue={user.email ?? ""} />
          <SaveBtn />
        </form>
      </div>

      {/* Read-only system info */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/20 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#1a3826]/10 dark:bg-[#FFC72C]/10 text-[#1a3826] dark:text-[#FFC72C]">
            <Hash size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Kontoinformationen</h3>
            <p className="text-xs text-muted-foreground">Vom Administrator verwaltet, schreibgeschützt</p>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <ReadField icon={<ShieldCheck size={13} />} label="Rolle" value={ROLE_LABELS[user.role] ?? user.role} />
          {user.department && (
            <ReadField
              icon={<Layers size={13} />}
              label="Abteilung"
              value={user.department.name}
              accent={user.department.color}
            />
          )}
          {primary && (
            <ReadField
              icon={<Building2 size={13} />}
              label="Hauptrestaurant"
              value={`Restaurant ${primary.name ?? primary.code}`}
            />
          )}
          {user.restaurants.filter((r) => !r.isPrimary).length > 0 && (
            <ReadField
              icon={<Building2 size={13} />}
              label="Weitere Standorte"
              value={user.restaurants.filter((r) => !r.isPrimary).map((r) => `#${r.name ?? r.code}`).join(", ")}
            />
          )}
          {user.supervisorName && (
            <ReadField icon={<Users size={13} />} label="Vorgesetzter" value={user.supervisorName} />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, name, type, defaultValue }: {
  icon: React.ReactNode; label: string; name: string; type: string; defaultValue: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">{icon}</span>
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          className="w-full min-h-[48px] pl-11 pr-4 py-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition text-sm"
        />
      </div>
    </div>
  );
}

function ReadField({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string; accent?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        <span style={accent ? { color: accent } : undefined}>{icon}</span>
        {label}
      </div>
      <div className="text-sm text-foreground" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}
