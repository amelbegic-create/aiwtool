import { 
  Users, LayoutDashboard, ShieldCheck, PlaneTakeoff, 
  UserPlus, Settings, ClipboardCheck, FileText, 
  Clock, History, Store, Calculator, Briefcase 
} from "lucide-react";

// Definišemo nazive koje sistem traži
export interface Category {
  id: string;
  label: string;
  icon: any; 
}
// Ovi aliasi rješavaju greške u uvozima
export type ToolCategory = Category;
export type AppTool = Tool;

export interface Tool {
  id: string;
  name: string;
  href: string;
  icon: any;
  category: string;
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  { id: 'general', label: 'OPĆENITO', icon: LayoutDashboard },
  { id: 'staff', label: 'OSOBLJE', icon: Users },
  { id: 'operations', label: 'OPERACIJE', icon: Briefcase },
  { id: 'other', label: 'OSTALO', icon: Settings }
];

export const APP_TOOLS: AppTool[] = [
  { id: 'dashboard', name: 'Kontrolna Tabla', href: '/', icon: LayoutDashboard, category: 'general' },
  { id: 'user-management', name: 'Upravljanje Korisnicima', href: '/admin/users', icon: ShieldCheck, category: 'staff' },
  { id: 'add-user', name: 'Novi Korisnik', href: '/admin/users/new', icon: UserPlus, category: 'staff' },
  { id: 'vacations', name: 'Godišnji Odmori', href: '/tools/staff/vacations', icon: PlaneTakeoff, category: 'staff' }
];