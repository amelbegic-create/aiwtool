export type PDSRange = {
  from: number;
  to: number;
  pts: number;
};

export type PDSGoal = {
  id?: number;
  title: string;
  scoringRules: PDSRange[];
  result?: string;
  points?: number;
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