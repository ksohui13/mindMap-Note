import type { MindmapNodeDTO } from "@/features/mindmap/api/contracts";

export const ESTIMATED_NODE_WIDTH = 256;
export const ESTIMATED_NODE_HEIGHT = 160;
export const NODE_HORIZONTAL_CLEARANCE = 64;
export const NODE_VERTICAL_CLEARANCE = 40;
export const CHILD_HORIZONTAL_GAP = ESTIMATED_NODE_WIDTH + NODE_HORIZONTAL_CLEARANCE;
export const CHILD_VERTICAL_GAP = ESTIMATED_NODE_HEIGHT + NODE_VERTICAL_CLEARANCE;

type PositionedNode = Pick<MindmapNodeDTO, "x" | "y">;
type TreePositionedNode = Pick<MindmapNodeDTO, "id" | "parentNodeId" | "x" | "y">;

function verticalOffset(slot: number): number {
  if (slot === 0) return 0;
  const distance = Math.ceil(slot / 2) * CHILD_VERTICAL_GAP;
  return slot % 2 === 1 ? distance : -distance;
}

export function calculateChildPosition(
  parent: Pick<MindmapNodeDTO, "id" | "x" | "y">,
  nodes: readonly PositionedNode[],
  reservations: readonly PositionedNode[] = [],
): { x: number; y: number } {
  const x = parent.x + CHILD_HORIZONTAL_GAP;
  const obstacles = [...nodes, ...reservations];

  for (let slot = 0; slot <= obstacles.length; slot += 1) {
    const y = parent.y + verticalOffset(slot);
    if (!hasPositionCollision({ x, y }, obstacles)) return { x, y };
  }

  return { x, y: parent.y + verticalOffset(obstacles.length + 1) };
}

export function hasPositionCollision(
  candidate: PositionedNode,
  obstacles: readonly PositionedNode[],
): boolean {
  return obstacles.some((obstacle) =>
    Math.abs(obstacle.x - candidate.x) < CHILD_HORIZONTAL_GAP &&
    Math.abs(obstacle.y - candidate.y) < CHILD_VERTICAL_GAP,
  );
}

export function calculateRevealedNodePositions(
  nodes: readonly TreePositionedNode[],
  fixedNodeIds: ReadonlySet<string>,
  revealedNodeIds: ReadonlySet<string>,
): Readonly<Record<string, { x: number; y: number }>> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const placed = nodes
    .filter((node) => fixedNodeIds.has(node.id))
    .map((node) => ({ x: node.x, y: node.y }));
  const result: Record<string, { x: number; y: number }> = {};
  const remaining = new Set(revealedNodeIds);

  while (remaining.size > 0) {
    let progressed = false;
    for (const nodeId of [...remaining]) {
      const node = byId.get(nodeId);
      if (!node) {
        remaining.delete(nodeId);
        continue;
      }
      if (node.parentNodeId && remaining.has(node.parentNodeId)) continue;

      const parent = node.parentNodeId ? byId.get(node.parentNodeId) : undefined;
      const resolvedParent = parent
        ? { ...parent, ...(result[parent.id] ?? {}) }
        : undefined;
      const parentDelta = parent && resolvedParent
        ? { x: resolvedParent.x - parent.x, y: resolvedParent.y - parent.y }
        : { x: 0, y: 0 };
      const preferred = { x: node.x + parentDelta.x, y: node.y + parentDelta.y };
      const position = !hasPositionCollision(preferred, placed)
        ? preferred
        : resolvedParent
          ? calculateChildPosition(resolvedParent, placed)
          : preferred;

      result[node.id] = position;
      placed.push(position);
      remaining.delete(nodeId);
      progressed = true;
    }
    if (!progressed) break;
  }

  return Object.fromEntries(
    Object.entries(result).filter(([nodeId, position]) => {
      const original = byId.get(nodeId);
      return original && (original.x !== position.x || original.y !== position.y);
    }),
  );
}
