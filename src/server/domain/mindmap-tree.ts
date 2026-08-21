import { DomainError } from "./errors";

type TreeNodeReference = Readonly<{
  id: string;
  parentNodeId: string | null;
}>;

export function validateMindmapTree(nodes: readonly TreeNodeReference[]): string {
  const roots = nodes.filter((node) => node.parentNodeId === null);
  if (roots.length !== 1) {
    throw new DomainError("DATA_INTEGRITY", "Mindmap must contain exactly one root node.");
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const childIdsByParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentNodeId === null) continue;
    if (!nodeIds.has(node.parentNodeId)) {
      throw new DomainError("DATA_INTEGRITY", "Mindmap contains an invalid parent reference.");
    }
    const children = childIdsByParent.get(node.parentNodeId) ?? [];
    children.push(node.id);
    childIdsByParent.set(node.parentNodeId, children);
  }

  const visited = new Set<string>();
  const pending = [roots[0].id];
  while (pending.length > 0) {
    const nodeId = pending.pop();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);
    pending.push(...(childIdsByParent.get(nodeId) ?? []));
  }

  if (visited.size !== nodes.length) {
    throw new DomainError("DATA_INTEGRITY", "Mindmap contains a disconnected or cyclic node structure.");
  }
  return roots[0].id;
}
