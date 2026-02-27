import { loadLatestBonusSheet, syncEmployeesWithUsers } from "@/app/actions/bonusActions";
import BonusToolClient from "./BonusToolClient";

export const dynamic = "force-dynamic";

export default async function BonusiPage() {
  const baseState = await loadLatestBonusSheet();
  const initialState = await syncEmployeesWithUsers(baseState);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">
        {/* HEADER – unificirani layout */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-[#1a3826] dark:text-[#FFC72C] uppercase tracking-tighter mb-2">
              BONUS <span className="text-[#FFC72C]">ALAT</span>
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Alat za obračun godišnjih bonusa po zaposleniku.
            </p>
          </div>
        </div>

        <div className="mt-6 sm:mt-8">
          <BonusToolClient initialState={initialState} />
        </div>
      </div>
    </div>
  );
}