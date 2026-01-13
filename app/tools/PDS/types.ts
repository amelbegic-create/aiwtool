export type PDSScoringRule = {
  from: number;
  to: number;
  pts: number;
};

export type PDSGoal = {
  id?: string; // Koristimo string za ID (uuid) ili generisani string
  title: string;
  description?: string; // Dodano za opis cilja
  scoringRules: PDSScoringRule[];
  result?: string; // Unos rezultata (npr. "15.5")
  points?: number; // Izračunati bodovi
};

export type PDSScaleLevel = {
  label: string;
  min: number;
  max: number;
  colorHex: string;
};

export interface PDSUpdateData {
  goals: PDSGoal[];
  scale: PDSScaleLevel[]; 
  employeeComment?: string;
  managerComment?: string;
  employeeSignature?: string | null;
  managerSignature?: string | null;
}