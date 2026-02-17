"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  useEffect(() => {
    if (token) router.replace(`/auth/new-password?token=${encodeURIComponent(token)}`);
  }, [token, router]);

  return (
    <div className="min-h-screen bg-[#0c1f15] flex items-center justify-center">
      <p className="text-emerald-200/80">Weiterleitung…</p>
    </div>
  );
}
