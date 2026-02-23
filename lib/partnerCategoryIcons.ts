import {
  Building2,
  Cpu,
  Wrench,
  Folder,
  ClipboardList,
  LayoutGrid,
  Settings,
  Users,
  Briefcase,
  Truck,
  Zap,
  Shield,
  FileText,
  type LucideIcon,
} from "lucide-react";

/** Lista ikona koje admin može odabrati za kategoriju. Ime = export iz lucide-react. */
export const PARTNER_CATEGORY_ICON_NAMES = [
  "Building2",
  "Cpu",
  "Wrench",
  "Folder",
  "ClipboardList",
  "LayoutGrid",
  "Settings",
  "Users",
  "Briefcase",
  "Truck",
  "Zap",
  "Shield",
  "FileText",
] as const;

export type PartnerCategoryIconName = (typeof PARTNER_CATEGORY_ICON_NAMES)[number];

const ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  Cpu,
  Wrench,
  Folder,
  ClipboardList,
  LayoutGrid,
  Settings,
  Users,
  Briefcase,
  Truck,
  Zap,
  Shield,
  FileText,
};

/** Vraća Lucide komponentu za zadano ime ikone; ako nije pronađeno, vraća Folder. */
export function getPartnerCategoryIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName || !ICON_MAP[iconName]) return Folder;
  return ICON_MAP[iconName];
}

/** Da li je string valjano ime ikone iz liste. */
export function isValidPartnerCategoryIcon(name: string): name is PartnerCategoryIconName {
  return PARTNER_CATEGORY_ICON_NAMES.includes(name as PartnerCategoryIconName);
}
