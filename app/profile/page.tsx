"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import AvatarUpload from "@/components/profile/AvatarUpload";
import { updateProfile, changePassword } from "@/app/actions/profileActions";
import { getMyIdeas, type MyIdeaRow } from "@/app/actions/ideaActions";
import MeineIdeenClient from "@/components/dashboard/MeineIdeenClient";
import {
  User,
  Mail,
  Lock,
  Save,
  ShieldCheck,
  Loader2,
  Lightbulb,
  ChevronRight,
  X,
} from "lucide-react";

function SubmitButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-3 rounded-xl bg-[#1a3826] text-white font-semibold text-sm hover:bg-[#142d1f] transition-colors shadow-sm hover:shadow disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? <Loader2 size={18} className="animate-spin" /> : null}
      {pending ? "Laden…" : children}
    </button>
  );
}

function PasswordSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-3 rounded-xl bg-[#1a3826] text-white font-semibold text-sm hover:bg-[#142d1f] transition-colors shadow-sm hover:shadow disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? <Loader2 size={18} className="animate-spin" /> : null}
      {pending ? "Laden…" : <>Passwort ändern</>}
    </button>
  );
}

export default function ProfilePage() {
  const { data: session, status: sessionStatus, update: updateSession } = useSession();
  const [avatarUrlOverride, setAvatarUrlOverride] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [ideasModalOpen, setIdeasModalOpen] = useState(false);
  const [ideas, setIdeas] = useState<MyIdeaRow[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);

  const user = session?.user as { id?: string; name?: string; email?: string; image?: string; role?: string; department?: string } | undefined;
  const displayImage = avatarUrlOverride ?? user?.image;

  const handleProfileAction = async (formData: FormData) => {
    setProfileMessage(null);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const result = await updateProfile({ name, email });
    if (result.success) {
      setProfileMessage({ type: "success", text: "Profil erfolgreich aktualisiert." });
      updateSession?.();
    } else {
      setProfileMessage({ type: "error", text: result.error });
    }
  };

  const handlePasswordAction = async (formData: FormData) => {
    setPasswordMessage(null);
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirm = formData.get("confirmPassword") as string;
    if (newPassword !== confirm) {
      setPasswordMessage({ type: "error", text: "Neues Passwort und Bestätigung stimmen nicht überein." });
      return;
    }
    const result = await changePassword(currentPassword, newPassword);
    if (result.success) {
      toast.success("Passwort erfolgreich geändert.");
      setPasswordMessage({ type: "success", text: "Passwort erfolgreich geändert." });
    } else {
      setPasswordMessage({ type: "error", text: result.error });
    }
  };

  useEffect(() => {
    if (!ideasModalOpen || sessionStatus === "loading" || !session?.user?.email) return;
    let cancelled = false;
    setIdeasLoading(true);
    setIdeasError(null);
    getMyIdeas()
      .then((rows) => {
        if (!cancelled) {
          setIdeas(rows);
          setIdeasError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setIdeasError(e instanceof Error ? e.message : "Fehler beim Laden der Ideen.");
        }
      })
      .finally(() => {
        if (!cancelled) setIdeasLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ideasModalOpen, session?.user?.email, sessionStatus]);

  const roleLabel =
    user?.role === "SYSTEM_ARCHITECT"
      ? "System"
      : user?.role === "ADMIN"
        ? "Admin"
        : user?.role === "MANAGER"
          ? "Manager"
          : user?.role === "MANAGEMENT"
            ? "Management"
            : "Mitarbeiter";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-14 safe-area-l safe-area-r">
        {/* Header – unificirani layout */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
                MEIN <span className="text-[#FFC72C]">PROFIL</span>
              </h1>
              <p className="text-muted-foreground text-sm font-medium">
                Persönliche Daten und Kontosicherheit verwalten.
              </p>
            </div>
          </div>
        </div>

        {/* Bento / Split layout – "Dosje zaposlenika": lijevo velika slika, desno podaci */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Left: velika kvadratna profilna slika (ID-style, spreman za Org Chart) */}
          <div className="lg:col-span-4 flex flex-col items-center lg:items-start">
            <div className="w-full max-w-sm md:max-w-[400px] aspect-square flex-shrink-0">
              <AvatarUpload
                currentImageUrl={displayImage}
                onUpdate={(url) => setAvatarUrlOverride(url)}
                className="w-full h-full"
              />
            </div>
            <div className="mt-6 w-full max-w-sm md:max-w-[400px] bg-card rounded-2xl border border-border shadow-sm overflow-hidden p-6 text-center lg:text-left">
              <h2 className="text-lg font-semibold text-card-foreground truncate">
                {user?.name || "Benutzer"}
              </h2>
              <p className="text-sm text-muted-foreground truncate mt-1">
                {user?.email}
              </p>
              <div className="flex items-center justify-center lg:justify-start gap-2 mt-4 px-4 py-2 rounded-xl bg-muted border border-border">
                <ShieldCheck size={16} className="text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {roleLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIdeasModalOpen(true)}
                className="mt-4 w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-[#1a3826]/25"
              >
                <div className="p-2.5 rounded-xl bg-[#1a3826]/10 dark:bg-[#FFC72C]/20 text-[#1a3826] dark:text-[#FFC72C] shrink-0">
                  <Lightbulb size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-card-foreground">Meine Ideen</p>
                  <p className="text-xs text-muted-foreground truncate">Archiv &amp; Rückmeldungen öffnen</p>
                </div>
                <ChevronRight className="shrink-0 text-muted-foreground" size={18} aria-hidden />
              </button>
            </div>
          </div>

          {/* Right: Forms */}
          <div className="lg:col-span-8 space-y-6">
            {/* Lični podaci */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#1a3826]/10 dark:bg-[#FFC72C]/20 text-[#1a3826] dark:text-[#FFC72C]">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-card-foreground">Persönliche Daten</h3>
                    <p className="text-sm text-muted-foreground">Vor- und Nachname, E-Mail-Adresse</p>
                  </div>
                </div>
              </div>
              <form action={handleProfileAction} className="p-6 space-y-5">
                {profileMessage && (
                  <div
                    className={`rounded-xl px-4 py-3 text-sm ${
                      profileMessage.type === "success"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                        : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200"
                    }`}
                  >
                    {profileMessage.text}
                  </div>
                )}
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Vor- und Nachname
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      id="name"
                      name="name"
                      type="text"
                      defaultValue={user?.name ?? ""}
                      placeholder="Vor- und Nachname"
                      className="w-full min-h-[48px] pl-12 pr-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    E-Mail-Adresse
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={user?.email ?? ""}
                      placeholder="name@beispiel.at"
                      className="w-full min-h-[48px] pl-12 pr-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition-colors"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <SubmitButton>
                    <Save size={18} />
                    Änderungen speichern
                  </SubmitButton>
                </div>
              </form>
            </div>

            {/* Sigurnost */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#1a3826]/10 dark:bg-[#FFC72C]/20 text-[#1a3826] dark:text-[#FFC72C]">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-card-foreground">Sicherheit</h3>
                    <p className="text-sm text-muted-foreground">Passwort ändern</p>
                  </div>
                </div>
              </div>
              <form action={handlePasswordAction} className="p-6 space-y-5">
                {passwordMessage && (
                  <div
                    className={`rounded-xl px-4 py-3 text-sm ${
                      passwordMessage.type === "success"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                        : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200"
                    }`}
                  >
                    {passwordMessage.text}
                  </div>
                )}
                <div>
                  <label htmlFor="currentPassword" className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Aktuelles Passwort
                  </label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Neues Passwort
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    minLength={6}
                    placeholder="Mind. 6 Zeichen"
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Potvrda nove lozinke
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    placeholder="Neues Passwort wiederholen"
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition-colors"
                  />
                </div>
                <div className="pt-2">
                  <PasswordSubmitButton />
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {ideasModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-ideas-modal-title"
          onClick={() => setIdeasModalOpen(false)}
        >
          <div
            className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[min(85vh,800px)] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/40 shrink-0">
              <h2 id="profile-ideas-modal-title" className="font-black text-base sm:text-lg flex items-center gap-2 text-foreground min-w-0">
                <Lightbulb className="text-[#FFC72C] shrink-0" size={22} />
                <span className="truncate">Meine Ideen</span>
              </h2>
              <button
                type="button"
                onClick={() => setIdeasModalOpen(false)}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Schließen"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              {ideasError && (
                <div className="rounded-xl px-4 py-3 text-sm bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 mb-4">
                  {ideasError}
                </div>
              )}
              {ideasLoading && !ideasError && (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
                  <Loader2 size={18} className="animate-spin" />
                  Laden…
                </div>
              )}
              {!ideasLoading && !ideasError && <MeineIdeenClient initialIdeas={ideas} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
