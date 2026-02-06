"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Pogrešan email ili lozinka");
        setLoading(false);
      } else {
        // --- FIX: OVDJE JE BILA PROMJENA ---
        // Umjesto na /tools/PDS ili select-restaurant, šaljemo na Dashboard
        router.refresh(); // Osvježi da povuče sesiju
        router.push("/dashboard");
      }
    } catch {
      setError("Greška prilikom prijave.");
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-100">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-[#1a3826]">AIW Services</h1>
        <p className="text-gray-400 text-sm mt-2">Prijavite se za pristup</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] outline-none transition-all"
            placeholder="ime@mcdonalds.com"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lozinka</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a3826] focus:border-[#1a3826] outline-none transition-all"
            placeholder="••••••••"
            required
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center font-medium border border-red-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1a3826] hover:bg-[#142e1e] text-white py-3 rounded-lg font-bold transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {loading ? "Prijava..." : "Prijavi se"}
        </button>
      </form>
    </div>
  );
}