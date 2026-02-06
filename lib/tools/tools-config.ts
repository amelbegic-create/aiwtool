import { 
  Users, LayoutDashboard, ShieldCheck, PlaneTakeoff, 
  Briefcase, Settings, ClipboardList, Clock, TrendingUp,
  BookOpen, // Dodana ikona za pravila
  Gift,
} from "lucide-react";

export const TOOL_CATEGORIES = [
  { id: 'general', label: 'OPĆENITO', icon: LayoutDashboard },
  { id: 'staff', label: 'OSOBLJE', icon: Users },
  { id: 'operations', label: 'OPERACIJE', icon: Briefcase },
  { id: 'other', label: 'OSTALO', icon: Settings }
];

export const APP_TOOLS = [
  // OSOBLJE (Personal)
  { id: 'vacations', name: 'Godišnji Odmori', href: '/tools/vacations', icon: PlaneTakeoff, category: 'staff' },
  { id: 'PDS', name: 'PDS', href: '/tools/PDS', icon: ClipboardList, category: 'staff' },
  { id: 'rules', name: 'Pravila & Procedure', href: '/tools/rules', icon: BookOpen, category: 'staff' },
  { id: 'bonus', name: 'Bonusi', href: '/tools/bonusi', icon: Gift, category: 'staff' },
  // OPERACIJE
  { id: 'labor-planner', name: 'Labor Planner', href: '/tools/labor-planner', icon: Clock, category: 'operations' },
  { id: 'productivity', name: 'Produktivnost', href: '/tools/productivity', icon: TrendingUp, category: 'operations' },
  // OSTALO – Admin panel
  { id: 'admin-panel', name: 'Admin panel', href: '/admin', icon: ShieldCheck, category: 'other' }
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