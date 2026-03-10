import {
  Users,
  LayoutDashboard,
  PlaneTakeoff,
  Briefcase,
  ClipboardList,
  Clock,
  TrendingUp,
  BookOpen,
  Gift,
  Building2,
  FileText,
  Award,
  Store,
  Euro,
  Map,
} from "lucide-react";

export const TOOL_CATEGORIES = [
  { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { id: 'restaurant', label: 'RESTAURANT', icon: Store },
  { id: 'personal', label: 'PERSONAL', icon: Users },
  { id: 'finanz', label: 'FINANZ', icon: Euro },
];

export const APP_TOOLS = [
  // RESTAURANT
  { id: 'partners', name: 'Firmen und Partner', href: '/tools/partners', icon: Building2, category: 'restaurant' },
  { id: 'rules', name: 'Bedienungsanleitungen', href: '/tools/rules', icon: BookOpen, category: 'restaurant' },
  { id: 'sitzplan', name: 'Sitzplan & Layout', href: '/tools/sitzplan', icon: Map, category: 'restaurant' },
  { id: 'vorlagen', name: 'Vorlagen', href: '/tools/vorlagen', icon: FileText, category: 'restaurant' },
  // PERSONAL
  { id: 'vacations', name: 'Urlaubsplanung', href: '/tools/vacations', icon: PlaneTakeoff, category: 'personal' },
  { id: 'PDS', name: 'PDS (Beurteilung)', href: '/tools/PDS', icon: ClipboardList, category: 'personal' },
  { id: 'team', name: 'Mein Team', href: '/team', icon: Users, category: 'personal' },
  { id: 'certificates', name: 'Zertifikate', href: '/tools/certificates', icon: Award, category: 'personal' },
  { id: 'bonus', name: 'Prämien & Bonus', href: '/tools/bonusi', icon: Gift, category: 'personal' },
  // FINANZ
  { id: 'labor-planner', name: 'CL (Personaleinsatzplanung)', href: '/tools/labor-planner', icon: Clock, category: 'finanz' },
  { id: 'productivity', name: 'Produktivität', href: '/tools/productivity', icon: TrendingUp, category: 'finanz' },
];

/** Permission key potreban za pristup modulu (za brze akcije i highlight). */
export const TOOL_PERMISSION: Record<string, string> = {
  'vacations': 'vacation:access',
  'PDS': 'pds:access',
  'rules': 'rules:access',
  'bonus': 'bonus:access',
  'labor-planner': 'labor:access',
  'productivity': 'productivity:access',
  'partners': 'partners:access',
  'vorlagen': 'vorlagen:access',
  'admin-panel': 'users:access',
};