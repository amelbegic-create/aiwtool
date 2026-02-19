import { 
  Users, LayoutDashboard, PlaneTakeoff, 
  Briefcase, ClipboardList, Clock, TrendingUp,
  BookOpen,
  Gift,
} from "lucide-react";

export const TOOL_CATEGORIES = [
  { id: 'general', label: 'ALLGEMEIN', icon: LayoutDashboard },
  { id: 'staff', label: 'PERSONAL', icon: Users },
  { id: 'operations', label: 'OPERATIONEN', icon: Briefcase },
];

export const APP_TOOLS = [
  // PERSONAL
  { id: 'team', name: 'Mein Team', href: '/team', icon: Users, category: 'staff' },
  { id: 'vacations', name: 'Urlaubsplanung', href: '/tools/vacations', icon: PlaneTakeoff, category: 'staff' },
  { id: 'PDS', name: 'PDS (Beurteilung)', href: '/tools/PDS', icon: ClipboardList, category: 'staff' },
  { id: 'rules', name: 'Richtlinien & Verfahren', href: '/tools/rules', icon: BookOpen, category: 'staff' },
  { id: 'bonus', name: 'Prämien & Bonus', href: '/tools/bonusi', icon: Gift, category: 'staff' },
  // OPERATIONEN
  { id: 'labor-planner', name: 'Personaleinsatzplanung', href: '/tools/labor-planner', icon: Clock, category: 'operations' },
  { id: 'productivity', name: 'Produktivität', href: '/tools/productivity', icon: TrendingUp, category: 'operations' },
];

/** Permission key potreban za pristup modulu (za brze akcije i highlight). */
export const TOOL_PERMISSION: Record<string, string> = {
  'vacations': 'vacation:access',
  'PDS': 'pds:access',
  'rules': 'rules:access',
  'bonus': 'bonus:access',
  'labor-planner': 'labor:access',
  'productivity': 'productivity:access',
  'admin-panel': 'users:access',
};