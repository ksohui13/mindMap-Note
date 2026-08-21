import type { MindmapWithNodeCount } from "./mindmap.repository";

import type {
  MindmapDetailResponse,
  MindmapNodeDTO,
  MindmapSummaryDTO,
} from "@/features/mindmap/api/contracts";
import type { Node } from "@/generated/prisma/client";
import type { getMindmapDetailForUser } from "./mindmap.service";

export function toMindmapSummaryDTO(
  mindmap: MindmapWithNodeCount,
): MindmapSummaryDTO {
  return {
    id: mindmap.id,
    title: mindmap.title,
    sequenceNo: mindmap.sequenceNo,
    updatedAt: mindmap.updatedAt.toISOString(),
    nodeCount: mindmap._count.nodes,
  };
}

export function toMindmapDetailDTO(
  detail: Awaited<ReturnType<typeof getMindmapDetailForUser>>,
): MindmapDetailResponse {
  return {
    mindmap: {
      id: detail.id,
      title: detail.title,
      updatedAt: detail.updatedAt.toISOString(),
    },
    rootNodeId: detail.rootNodeId,
    nodes: detail.nodes.map((node) => ({ ...node })),
  };
}

export function toMindmapNodeDTO(node: Node): MindmapNodeDTO {
  return {
    id: node.id,
    parentNodeId: node.parentNodeId,
    title: node.title,
    x: node.x,
    y: node.y,
    isCollapsed: node.isCollapsed,
    revision: node.revision,
  };
}
