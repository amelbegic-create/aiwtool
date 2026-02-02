import BonusiFrame from "./BonusiFrame";

export const dynamic = "force-dynamic";

export default async function BonusiPage() {
  return (
    <BonusiFrame 
      src="/tools/bonusi/view" 
      title="Bonus Tool" 
      headerOffsetPx={80} 
    />
  );
}