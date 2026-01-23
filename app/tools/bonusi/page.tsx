// 1. Importamo default export (bez vitičastih zagrada { })
import BonusiFrame from "./BonusiFrame"; 

// import { requirePermission } from "@/lib/access"; // Otkomentiraj kad ti zatreba

// Ovo forsira da se stranica ne kešira na serveru
export const dynamic = "force-dynamic";

export default async function BonusiPage() {
  // await requirePermission("admin:access"); // Tvoja zaštita

  return (
    <BonusiFrame 
      src="/tools/bonusi/view" 
      title="Bonusi Manager" 
      headerOffsetPx={80} 
    />
  );
}