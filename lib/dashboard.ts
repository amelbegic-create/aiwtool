import { hasPermission } from "@/lib/access";
import { APP_TOOLS, TOOL_PERMISSION } from "@/lib/tools/tools-config";

export type QuickActionItem = {
  id: string;
  label: string;
  href: string;
  iconKey: string;
};

/**
 * Redoslijed modula za "Brze akcije" običnih korisnika (najkorišteniji prvi).
 * Admin vidi posebne akcije (Hijerarhija, Nova Prijava, Moja Pravila).
 */
const PREFERRED_ORDER_USER = ["vacations", "rules", "PDS", "labor-planner", "productivity"];

export function getAllowedQuickActions(
  role: string,
  permissions: string[]
): QuickActionItem[] {
  const isAdmin = ["SYSTEM_ARCHITECT", "SUPER_ADMIN", "ADMIN", "MANAGER"].includes(String(role));

  if (isAdmin) {
    return [
      { id: "vacations", label: "Neue Anfrage", href: "/tools/vacations", iconKey: "FilePlus" },
      { id: "rules", label: "Richtlinien", href: "/tools/rules", iconKey: "BookOpen" },
    ];
  }

  const allowed: QuickActionItem[] = [];
  const seen = new Set<string>();
  for (const toolId of PREFERRED_ORDER_USER) {
    const tool = APP_TOOLS.find((t) => t.id === toolId);
    const perm = TOOL_PERMISSION[toolId];
    if (!tool || !perm) continue;
    if (seen.has(toolId)) continue;
    if (!hasPermission(role, permissions, perm)) continue;
    seen.add(toolId);
    allowed.push({
      id: tool.id,
      label: tool.name,
      href: tool.href,
      iconKey: tool.id,
    });
  }
  // Dodaj ostale do max 4
  for (const tool of APP_TOOLS) {
    if (allowed.length >= 4) break;
    if (tool.id === "admin-panel") continue;
    if (seen.has(tool.id)) continue;
    const perm = TOOL_PERMISSION[tool.id];
    if (!perm || !hasPermission(role, permissions, perm)) continue;
    allowed.push({ id: tool.id, label: tool.name, href: tool.href, iconKey: tool.id });
  }
  return allowed;
}
