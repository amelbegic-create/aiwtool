import type { TeamMemberRowWithSupervisor } from "@/app/actions/teamActions";

export type TreeNode = TeamMemberRowWithSupervisor & {
  children: TreeNode[];
};

/**
 * Builds a tree from a flat list of team members with supervisorId.
 * Root: users with supervisorId == null. Children: users whose supervisorId === parent id.
 * Orphans: users whose supervisorId is not in the list.
 */
export function buildTreeFromFlat(
  flat: TeamMemberRowWithSupervisor[]
): { tree: TreeNode[]; orphans: TreeNode[] } {
  const byId = new Map<string, TreeNode>();
  for (const m of flat) {
    byId.set(m.id, { ...m, children: [] });
  }

  const tree: TreeNode[] = [];
  const orphans: TreeNode[] = [];

  for (const m of flat) {
    const node = byId.get(m.id)!;
    if (m.supervisorId == null || m.supervisorId === "") {
      tree.push(node);
      continue;
    }
    const parent = byId.get(m.supervisorId);
    if (parent) {
      parent.children.push(node);
    } else {
      orphans.push(node);
    }
  }

  for (const node of tree) {
    node.children.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }
  for (const node of byId.values()) {
    node.children.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }

  return { tree, orphans };
}
