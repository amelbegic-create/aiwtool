import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const gate = await tryRequirePermission("admin_panel:access");
  if (!gate.ok) {
    return <NoPermission moduleName="Admin Panel" />;
  }
  return <>{children}</>;
}
