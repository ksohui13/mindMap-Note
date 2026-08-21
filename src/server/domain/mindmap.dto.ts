import type { MindmapWithNodeCount } from "./mindmap.repository";

import type {
  MindmapDetailResponse,
  MindmapSummaryDTO,
} from "@/features/mindmap/api/contracts";
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
