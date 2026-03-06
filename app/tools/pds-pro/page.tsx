import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getEmployeesForEvaluation } from "@/app/actions/pdsActions";
import PDSProClient from "./PDSProClient";

export const dynamic = "force-dynamic";

export default async function PDSProPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const accessResult = await tryRequirePermission("pds:access");
  if (!accessResult.ok) {
    return <NoPermission moduleName="PDS PRO" />;
  }

  const employees = await getEmployeesForEvaluation();

  const currentUserName =
    (session.user as { name?: string | null })?.name ??
    (session.user as { email?: string | null })?.email ??
    "Evaluator";

  return <PDSProClient employees={employees} currentUserName={currentUserName} />;
}

