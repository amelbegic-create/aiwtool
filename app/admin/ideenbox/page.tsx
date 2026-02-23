import { tryRequirePermission } from "@/lib/access";
import NoPermission from "@/components/NoPermission";
import { getIdeas } from "@/app/actions/ideaActions";
import IdeenboxClient from "./IdeenboxClient";

export default async function AdminIdeenboxPage() {
  const access = await tryRequirePermission("ideenbox:access");
  if (!access.ok) {
    return <NoPermission moduleName="Ideenbox" />;
  }

  const ideas = await getIdeas();
  return <IdeenboxClient initialIdeas={ideas} />;
}
