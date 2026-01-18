export type GoalType = 'NUMERIC' | 'BOOLEAN';

export interface PDSScoringRule {
  from: number;
  to: number;
  pts: number;
}

export interface PDSGoal {
  id?: string; // Opcionalni ID za stabilnost
  title: string;
  type: GoalType;
  
  // ZA DA/NE TIP:
  yesPoints?: number; // Koliko bodova nosi DA
  noPoints?: number;  // Koliko bodova nosi NE (može biti i minus)

  // ZA NUMERIČKI TIP:
  scoringRules: PDSScoringRule[]; 

  // REZULTAT (Unosi radnik/manager):
  result: string | boolean; 
  points: number; // Konačni osvojeni bodovi
}

export interface PDSScaleLevel {
  label: string;
  min: number;
  max: number;
  colorHex: string;
}