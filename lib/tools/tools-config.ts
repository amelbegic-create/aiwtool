import { 
  Users, 
  BarChart3, 
  LayoutGrid, 
  MoreHorizontal, 
  Calendar, 
  ClipboardCheck, 
  TrendingUp, 
  Calculator 
} from "lucide-react";

// --- EXPORT TIPOVA ---
export interface ToolCategory {
  id: string;
  label: string;
  icon: any;
}

export interface AppTool {
  id: string;
  name: string;
  description?: string;
  href: string;
  icon: any;
  category: string;
  color: string;
  status: string;
}

// --- KATEGORIJE ---
export const TOOL_CATEGORIES: ToolCategory[] = [
  { id: 'general', label: 'Općenito', icon: LayoutGrid },
  { id: 'staff', label: 'Osoblje', icon: Users },
  { id: 'operations', label: 'Operacije', icon: BarChart3 },
  { id: 'other', label: 'Ostalo', icon: MoreHorizontal },
];

// --- ALATI ---
export const APP_TOOLS: AppTool[] = [
  // OSOBLJE
  {
    id: "evaluations",
    name: "Evaluacija Učinka",
    description: "Obrasci za procjenu radnika",
    href: "/tools/evaluations",
    icon: ClipboardCheck,
    category: "staff", 
    color: "green",
    status: "active"
  },
  {
    id: "vacation-planner",
    name: "Godišnji Odmori",
    description: "Planer odmora sa blokadama",
    href: "/tools/vacations", // OVO JE ISPRAVNO JER TI JE FOLDER 'vacations'
    icon: Calendar,
    category: "staff",
    color: "blue",
    status: "active"
  },

  // OPERACIJE
  {
    id: "productivity",
    name: "Plan Produktivnosti",
    description: "Promet i sati rada",
    href: "/tools/productivity",
    icon: TrendingUp,
    category: "operations",
    color: "orange",
    status: "active"
  },
  {
    id: "labor-planner",
    name: "Mjesečni Planer",
    description: "Raspored smjena i sati",
    href: "/tools/labor-planner",
    icon: Calculator,
    category: "operations",
    color: "red",
    status: "active"
  }
];