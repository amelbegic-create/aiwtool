import { requirePermission } from "@/lib/access";
import RolePresetsClient from "./rolePresetsClient";

export default async function RolePresetsPage() {
  await requirePermission("users:permissions");

  return <RolePresetsClient />;
}
