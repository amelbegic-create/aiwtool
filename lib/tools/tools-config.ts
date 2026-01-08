import { 
  Users, 
  LayoutDashboard, 
  ShieldCheck, 
  PlaneTakeoff, 
  UserPlus,
  Settings,
  ClipboardCheck,
  FileText,
  Clock,
  History,
  Store,
  Calculator
} from "lucide-react";

// 1. DEFINICIJA TIPOVA
export interface Tool {
  id: string;
  name: string;
  href: string;
  icon: any;
  category: string;
}

export interface Category {
  id: string;
  label: string;
}

// 2. KATEGORIJE (Gornji padajući meni)
export const TOOL_CATEGORIES: Category[] = [
  { id: 'general', label: 'OPĆENITO' },
  { id: 'staff', label: 'OSOBLJE' },
  { id: 'operations', label: 'OPERACIJE' },
  { id: 'other', label: 'OSTALO' }
];

// 3. SVI ALATI (Tools)
export const APP_TOOLS: Tool[] = [
  // --- OPĆENITO ---
  {
    id: 'dashboard',
    name: 'Kontrolna Tabla',
    href: '/',
    icon: LayoutDashboard,
    category: 'general'
  },
  
  // --- OSOBLJE ---
  {
    id: 'user-management',
    name: 'Upravljanje Korisnicima',
    href: '/admin/users',
    icon: ShieldCheck,
    category: 'staff'
  },
  {
    id: 'add-user',
    name: 'Novi Korisnik',
    href: '/admin/users/new',
    icon: UserPlus,
    category: 'staff'
  },
  {
    id: 'vacations',
    name: 'Godišnji Odmori',
    href: '/tools/staff/vacations',
    icon: PlaneTakeoff,
    category: 'staff'
  },
  {
    id: 'attendance',
    name: 'Prisustvo / Satnica',
    href: '/tools/staff/attendance',
    icon: Clock,
    category: 'staff'
  },

  // --- OPERACIJE ---
  {
    id: 'inventory',
    name: 'Inventura / Skladište',
    href: '/tools/operations/inventory',
    icon: ClipboardCheck,
    category: 'operations'
  },
  {
    id: 'reports',
    name: 'Dnevni Izvještaji',
    href: '/tools/operations/reports',
    icon: FileText,
    category: 'operations'
  },
  {
    id: 'costs',
    name: 'Analiza Troškova',
    href: '/tools/operations/costs',
    icon: Calculator,
    category: 'operations'
  },

  // --- OSTALO ---
  {
    id: 'settings',
    name: 'Postavke Sistema',
    href: '/settings',
    icon: Settings,
    category: 'other'
  },
  {
    id: 'logs',
    name: 'Logovi Aktivnosti',
    href: '/admin/logs',
    icon: History,
    category: 'other'
  },
  {
    id: 'rest-switch',
    name: 'Promjena Restorana',
    href: '/select-restaurant',
    icon: Store,
    category: 'other'
  }
];