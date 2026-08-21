import type { Edge, Node } from "@xyflow/react";

import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";

export type MindmapNodeData = {
  title: string;
  isRoot: boolean;
  isCollapsed: boolean;
  revision: number;
};

export type MindmapFlowNode = Node<MindmapNodeData, "mindmap">;
export type MindmapFlowEdge = Edge<Record<string, never>, "mindmap">;

export function toMindmapFlow(
  detail: MindmapDetailResponse,
  selectedNodeId: string | null,
): { nodes: MindmapFlowNode[]; edges: MindmapFlowEdge[] } {
  return {
    nodes: detail.nodes.map((node) => ({
      id: node.id,
      type: "mindmap",
      position: { x: node.x, y: node.y },
      selected: node.id === selectedNodeId,
      draggable: false,
      connectable: false,
      deletable: false,
      ariaLabel: `${node.id === detail.rootNodeId ? "루트 노드" : "노드"}: ${node.title}`,
      data: {
        title: node.title,
        isRoot: node.id === detail.rootNodeId,
        isCollapsed: node.isCollapsed,
        revision: node.revision,
      },
    })),
    edges: detail.nodes.flatMap((node) =>
      node.parentNodeId === null
        ? []
        : [{
            id: `edge:${node.parentNodeId}:${node.id}`,
            type: "mindmap" as const,
            source: node.parentNodeId,
            target: node.id,
            selectable: false,
            focusable: false,
            deletable: false,
            data: {},
          }],
    ),
  };
}
