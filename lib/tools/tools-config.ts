import { 
  Users, LayoutDashboard, ShieldCheck, PlaneTakeoff, 
  Briefcase, Settings, ClipboardList, Clock, TrendingUp 
} from "lucide-react";

export const TOOL_CATEGORIES = [
  { id: 'general', label: 'OPĆENITO', icon: LayoutDashboard },
  { id: 'staff', label: 'OSOBLJE', icon: Users },
  { id: 'operations', label: 'OPERACIJE', icon: Briefcase },
  { id: 'other', label: 'OSTALO', icon: Settings }
];

export const APP_TOOLS = [
  // OSOBLJE
  { id: 'vacations', name: 'Godišnji Odmori', href: '/tools/vacations', icon: PlaneTakeoff, category: 'staff' },
  { id: 'PDS', name: 'PDS', href: '/tools/PDS', icon: ClipboardList, category: 'staff' },
  
  // OPERACIJE
  { id: 'labor-planner', name: 'Labor Planner', href: '/tools/labor-planner', icon: Clock, category: 'operations' },
  { id: 'productivity', name: 'Produktivnost', href: '/tools/productivity', icon: TrendingUp, category: 'operations' },
  
  // OSTALO
  { id: 'user-management', name: 'Administracija', href: '/admin/users', icon: ShieldCheck, category: 'other' }
];