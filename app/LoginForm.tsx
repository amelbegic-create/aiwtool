"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Pogrešan email ili lozinka.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="shadow-lg p-5 rounded-lg border-t-4 border-green-800 bg-white w-full max-w-sm">
      <h1 className="text-xl font-bold my-4 text-gray-800">Prijava</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          onChange={(e) => setEmail(e.target.value)}
          type="text"
          placeholder="Email"
          className="w-full border border-gray-200 py-2 px-6 bg-zinc-100/40"
        />
        <input
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Lozinka"
          className="w-full border border-gray-200 py-2 px-6 bg-zinc-100/40"
        />
        <button className="bg-green-800 text-white font-bold cursor-pointer px-6 py-2 hover:bg-green-700 transition">
          Prijavi se
        </button>

        {error && (
          <div className="bg-red-500 text-white w-fit text-sm py-1 px-3 rounded-md mt-2">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}