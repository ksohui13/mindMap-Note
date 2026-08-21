import type { MindmapNodeDTO } from "@/features/mindmap/api/contracts";

export type NodePosition = Readonly<{ x: number; y: number }>;
export type PositionOverrides = Readonly<Record<string, NodePosition>>;
export type CollapseOverrides = Readonly<Record<string, boolean>>;

export function applyNodeViewOverrides(
  nodes: readonly MindmapNodeDTO[],
  positionOverrides: PositionOverrides,
  collapseOverrides: CollapseOverrides,
): MindmapNodeDTO[] {
  return nodes.map((node) => ({
    ...node,
    ...(positionOverrides[node.id] ?? {}),
    ...(collapseOverrides[node.id] === undefined
      ? {}
      : { isCollapsed: collapseOverrides[node.id] }),
  }));
}

function buildChildren(nodes: readonly MindmapNodeDTO[]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentNodeId === null) continue;
    const siblings = children.get(node.parentNodeId) ?? [];
    siblings.push(node.id);
    children.set(node.parentNodeId, siblings);
  }
  return children;
}

export function getDescendantIds(
  nodes: readonly MindmapNodeDTO[],
  nodeId: string,
): Set<string> {
  const children = buildChildren(nodes);
  const descendants = new Set<string>();
  const stack = [...(children.get(nodeId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || descendants.has(current)) continue;
    descendants.add(current);
    stack.push(...(children.get(current) ?? []));
  }
  return descendants;
}

export function selectVisibleNodes(
  nodes: readonly MindmapNodeDTO[],
  rootNodeId: string,
): MindmapNodeDTO[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = buildChildren(nodes);
  const visible = new Set<string>();
  const stack = [rootNodeId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || visible.has(currentId)) continue;
    const current = byId.get(currentId);
    if (!current) continue;
    visible.add(currentId);
    if (current.isCollapsed) continue;
    stack.push(...(children.get(currentId) ?? []));
  }

  return nodes.filter((node) => visible.has(node.id));
}

export function nodesWithChildren(nodes: readonly MindmapNodeDTO[]): Set<string> {
  return new Set(
    nodes.flatMap((node) => node.parentNodeId === null ? [] : [node.parentNodeId]),
  );
}
