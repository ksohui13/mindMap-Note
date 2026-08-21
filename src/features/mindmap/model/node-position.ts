import type { MindmapNodeDTO } from "@/features/mindmap/api/contracts";

export const CHILD_HORIZONTAL_GAP = 240;
export const CHILD_VERTICAL_GAP = 96;

function verticalOffset(slot: number): number {
  if (slot === 0) return 0;
  const distance = Math.ceil(slot / 2) * CHILD_VERTICAL_GAP;
  return slot % 2 === 1 ? distance : -distance;
}

export function calculateChildPosition(
  parent: Pick<MindmapNodeDTO, "id" | "x" | "y">,
  nodes: readonly Pick<MindmapNodeDTO, "parentNodeId" | "x" | "y">[],
): { x: number; y: number } {
  const x = parent.x + CHILD_HORIZONTAL_GAP;
  const siblings = nodes.filter((node) => node.parentNodeId === parent.id);

  for (let slot = 0; slot <= siblings.length; slot += 1) {
    const y = parent.y + verticalOffset(slot);
    const occupied = siblings.some(
      (sibling) =>
        Math.abs(sibling.x - x) < 1 && Math.abs(sibling.y - y) < 1,
    );
    if (!occupied) return { x, y };
  }

  return { x, y: parent.y + verticalOffset(siblings.length + 1) };
}
