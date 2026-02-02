import { requirePermission } from "@/lib/access";
import RolePresetsClient from "@/app/admin/role-presets/rolePresetsClient";
import NoPermission from "@/components/NoPermission";

export default async function UsersRolesPage() {
  try {
    await requirePermission("users:permissions");
  } catch {
    return <NoPermission moduleName="Konfiguracija Rola/Permisija" />;
  }

  return <RolePresetsClient />;
}
