"use client";

import { Lightbulb } from "lucide-react";
import type { MyIdeaRow } from "@/app/actions/ideaActions";
import MeineIdeenClient from "@/components/dashboard/MeineIdeenClient";

type Props = {
  initialIdeas: MyIdeaRow[];
};

export default function IdeasTab({ initialIdeas }: Props) {
  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#FFC72C]/10 text-amber-700 dark:text-[#FFC72C]">
            <Lightbulb size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground">Meine Ideen</h3>
            <p className="text-xs text-muted-foreground">{initialIdeas.length} Einreichung{initialIdeas.length !== 1 ? "en" : ""}</p>
          </div>
        </div>
        <div className="p-4">
          <MeineIdeenClient initialIdeas={initialIdeas} />
        </div>
      </div>
    </div>
  );
}
