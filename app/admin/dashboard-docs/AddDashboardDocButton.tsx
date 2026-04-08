"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createPinnedDoc } from "@/app/actions/dashboardPinnedDocsActions";

export default function AddDashboardDocButton() {
  const [adding, setAdding] = useState(false);

  const onAdd = async () => {
    if (adding) return;
    setAdding(true);
    try {
      const r = await createPinnedDoc();
      if (!r.ok) {
        toast.error(r.error ?? "Error.");
        return;
      }
      toast.success("Document added.");
      window.location.reload();
    } finally {
      setAdding(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onAdd()}
      disabled={adding}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1a3826] px-5 py-2.5 text-sm font-black uppercase tracking-wide text-[#FFC72C] transition hover:opacity-90 disabled:opacity-60"
    >
      <Plus size={18} aria-hidden />
      {adding ? "…" : "Add"}
    </button>
  );
}
