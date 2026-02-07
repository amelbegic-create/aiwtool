"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { User, Camera, Loader2 } from "lucide-react";
import { uploadAvatar } from "@/app/actions/profileActions";

interface AvatarUploadProps {
  /** Trenutni URL slike (iz session.user.image ili user.image). */
  currentImageUrl: string | null | undefined;
  /** Poziva se nakon uspješnog uploada s novim URL-om (npr. za refresh sesije). */
  onUpdate?: (newUrl: string) => void;
  /** Veličina avatara u px (za veliki ID-style koristi 400). */
  size?: number;
  /** Dodatna CSS klasa za wrapper. */
  className?: string;
}

export default function AvatarUpload({
  currentImageUrl,
  onUpdate,
  size = 400,
  className = "",
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<"success" | "error" | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (type: "success" | "error", message: string) => {
    setToast(type);
    setToastMessage(message);
    setTimeout(() => {
      setToast(null);
      setToastMessage("");
    }, 3000);
  };

  const handleClick = () => {
    if (loading) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("error", "Odaberite sliku (npr. JPG, PNG).");
      return;
    }
    e.target.value = "";
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadAvatar(formData);
      if (result.success) {
        showToast("success", "Profilna slika je ažurirana.");
        onUpdate?.(result.url);
      } else {
        showToast("error", result.error || "Greška pri uploadu.");
      }
    } catch {
      showToast("error", "Greška pri uploadu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative inline-flex aspect-square w-full h-full min-w-0 min-h-0 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-lg hover:border-[#1a3826]/30 focus:outline-none focus:ring-2 focus:ring-[#1a3826] focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
        aria-label="Promijeni profilnu sliku"
      >
        {currentImageUrl ? (
          <Image
            src={currentImageUrl}
            alt="Profil"
            width={size}
            height={size}
            className="object-cover w-full h-full"
            unoptimized={currentImageUrl.includes("blob.vercel-storage.com")}
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-slate-400">
            <User size={Math.min(size * 0.4, 120)} strokeWidth={1.5} />
          </span>
        )}
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/80">
            <Loader2 size={40} className="animate-spin text-[#1a3826]" />
          </span>
        )}
        {!loading && (
          <span className="absolute bottom-3 right-3 flex items-center justify-center w-10 h-10 rounded-xl bg-black/50 text-white opacity-90 group-hover:opacity-100 group-hover:bg-[#1a3826] transition-all shadow-md">
            <Camera size={20} />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />

      {/* Toast */}
      {toast && (
        <div
          role="alert"
          className={`absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-full mt-2 px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-10 whitespace-nowrap ${
            toast === "success"
              ? "bg-[#1a3826] text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
