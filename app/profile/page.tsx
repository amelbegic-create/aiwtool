"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useFormStatus } from "react-dom";
import AvatarUpload from "@/components/profile/AvatarUpload";
import { updateProfile, changePassword } from "@/app/actions/profileActions";
import {
  User,
  Mail,
  Lock,
  Save,
  ShieldCheck,
  Loader2,
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
      {pending ? "Spremanje…" : children}
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
      {pending ? "Spremanje…" : <>Promijeni lozinku</>}
    </button>
  );
}

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const [avatarUrlOverride, setAvatarUrlOverride] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const user = session?.user as { id?: string; name?: string; email?: string; image?: string; role?: string; department?: string } | undefined;
  const displayImage = avatarUrlOverride ?? user?.image;

  const handleProfileAction = async (formData: FormData) => {
    setProfileMessage(null);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const result = await updateProfile({ name, email });
    if (result.success) {
      setProfileMessage({ type: "success", text: "Profil ažuriran." });
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
      setPasswordMessage({ type: "error", text: "Nova lozinka i potvrda se ne podudaraju." });
      return;
    }
    const result = await changePassword(currentPassword, newPassword);
    if (result.success) {
      setPasswordMessage({ type: "success", text: "Lozinka promijenjena." });
    } else {
      setPasswordMessage({ type: "error", text: result.error });
    }
  };

  const roleLabel =
    user?.role === "SYSTEM_ARCHITECT" || user?.role === "SUPER_ADMIN"
      ? "System"
      : user?.role === "ADMIN"
        ? "Admin"
        : user?.role === "MANAGER"
          ? "Manager"
          : "Zaposlenik";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
            Moj profil
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Upravljajte ličnim podacima i sigurnošću računa.
          </p>
        </div>

        {/* Bento / Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Left: Avatar + identity card */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-8 flex flex-col items-center text-center">
              <AvatarUpload
                currentImageUrl={displayImage}
                onUpdate={(url) => setAvatarUrlOverride(url)}
                size={140}
                className="mb-6"
              />
              <h2 className="text-lg font-semibold text-slate-900 truncate w-full">
                {user?.name || "Korisnik"}
              </h2>
              <p className="text-sm text-slate-500 truncate w-full mb-4">
                {user?.email}
              </p>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-100">
                <ShieldCheck size={16} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Forms */}
          <div className="lg:col-span-8 space-y-6">
            {/* Lični podaci */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#1a3826]/10 text-[#1a3826]">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Lični podaci</h3>
                    <p className="text-sm text-slate-500">Ime i email adresa</p>
                  </div>
                </div>
              </div>
              <form action={handleProfileAction} className="p-6 space-y-5">
                {profileMessage && (
                  <div
                    className={`rounded-xl px-4 py-3 text-sm ${
                      profileMessage.type === "success"
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-red-50 text-red-800"
                    }`}
                  >
                    {profileMessage.text}
                  </div>
                )}
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Ime i prezime
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      id="name"
                      name="name"
                      type="text"
                      defaultValue={user?.name ?? ""}
                      placeholder="Ime i prezime"
                      className="w-full min-h-[48px] pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={user?.email ?? ""}
                      placeholder="email@primjer.ba"
                      className="w-full min-h-[48px] pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition-colors"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <SubmitButton>
                    <Save size={18} />
                    Sačuvaj promjene
                  </SubmitButton>
                </div>
              </form>
            </div>

            {/* Sigurnost */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#1a3826]/10 text-[#1a3826]">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Sigurnost</h3>
                    <p className="text-sm text-slate-500">Promjena lozinke</p>
                  </div>
                </div>
              </div>
              <form action={handlePasswordAction} className="p-6 space-y-5">
                {passwordMessage && (
                  <div
                    className={`rounded-xl px-4 py-3 text-sm ${
                      passwordMessage.type === "success"
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-red-50 text-red-800"
                    }`}
                  >
                    {passwordMessage.text}
                  </div>
                )}
                <div>
                  <label htmlFor="currentPassword" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Trenutna lozinka
                  </label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Nova lozinka
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    minLength={6}
                    placeholder="Min. 6 znakova"
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Potvrda nove lozinke
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    placeholder="Ponovite novu lozinku"
                    className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a3826]/20 focus:border-[#1a3826] transition-colors"
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
    </div>
  );
}
