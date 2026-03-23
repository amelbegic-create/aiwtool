import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getArchivedIdeas, getIdeas } from "@/app/actions/ideaActions";
import IdeenboxClient from "./IdeenboxClient";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ archiv?: string }> };

export default async function AdminIdeenboxPage({ searchParams }: PageProps) {
  const access = await tryRequirePermission("ideenbox:access");
  if (!access.ok) {
    return <NoPermission moduleName="Ideenbox" />;
  }

  const { archiv } = await searchParams;
  const showArchive = archiv === "1";
  const ideas = showArchive ? await getArchivedIdeas() : await getIdeas();

  return <IdeenboxClient initialIdeas={ideas} mode={showArchive ? "archive" : "active"} />;
}
