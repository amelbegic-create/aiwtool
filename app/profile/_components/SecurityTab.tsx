"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { changePassword } from "@/app/actions/profileActions";
import { Lock, Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-3 rounded-xl bg-[#1a3826] text-white font-semibold text-sm hover:bg-[#142d1f] transition disabled:opacity-60"
    >
      {pending ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
      {pending ? "Speichern…" : "Passwort ändern"}
    </button>
  );
}

function PasswordInput({ name, placeholder, label }: { name: string; placeholder: string; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</label>
      <div className="relative">
        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          name={name}
          type={show ? "text" : "password"}
          required
          minLength={6}
          placeholder={placeholder}
          className="w-full min-h-[48px] pl-11 pr-12 py-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function SecurityTab() {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleAction = async (formData: FormData) => {
    setMessage(null);
    const current = formData.get("currentPassword") as string;
    const newPwd = formData.get("newPassword") as string;
    const confirm = formData.get("confirmPassword") as string;
    if (newPwd !== confirm) {
      setMessage({ type: "error", text: "Neues Passwort und Bestätigung stimmen nicht überein." });
      return;
    }
    const result = await changePassword(current, newPwd);
    if (result.success) {
      toast.success("Passwort erfolgreich geändert.");
      setMessage({ type: "success", text: "Passwort erfolgreich geändert." });
    } else {
      setMessage({ type: "error", text: result.error });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#1a3826]/10 dark:bg-[#FFC72C]/10 text-[#1a3826] dark:text-[#FFC72C]">
            <Lock size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground">Passwort ändern</h3>
            <p className="text-xs text-muted-foreground">Mindestens 6 Zeichen</p>
          </div>
        </div>
        <form action={handleAction} className="p-6 space-y-5">
          {message && (
            <div className={`rounded-xl px-4 py-3 text-sm ${message.type === "success" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200" : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200"}`}>
              {message.text}
            </div>
          )}
          <PasswordInput name="currentPassword" label="Aktuelles Passwort" placeholder="••••••••" />
          <PasswordInput name="newPassword" label="Neues Passwort" placeholder="Mind. 6 Zeichen" />
          <PasswordInput name="confirmPassword" label="Neues Passwort bestätigen" placeholder="Neues Passwort wiederholen" />
          <SaveBtn />
        </form>
      </div>

      {/* Security tips */}
      <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wide mb-3">Sicherheitshinweise</h4>
        <ul className="space-y-2">
          {[
            "Verwende ein Passwort mit mindestens 8 Zeichen.",
            "Kombiniere Buchstaben, Zahlen und Sonderzeichen.",
            "Gib dein Passwort niemals an andere weiter.",
            "Ändere dein Passwort regelmäßig alle 3 Monate.",
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck size={13} className="shrink-0 mt-0.5 text-[#1a3826] dark:text-[#FFC72C]" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
