import { z } from "zod";

export type MindmapSummaryDTO = Readonly<{
  id: string;
  title: string;
  sequenceNo: number;
  updatedAt: string;
  nodeCount: number;
}>;

export type MindmapListResponse = { mindmaps: MindmapSummaryDTO[] };
export type CreateMindmapResponse = {
  mindmap: MindmapSummaryDTO;
  rootNodeId: string;
};
export type UpdateMindmapResponse = { mindmap: MindmapSummaryDTO };

export type MindmapNodeDTO = Readonly<{
  id: string;
  parentNodeId: string | null;
  title: string;
  x: number;
  y: number;
  isCollapsed: boolean;
  revision: number;
}>;

export type MindmapDetailResponse = Readonly<{
  mindmap: {
    id: string;
    title: string;
    updatedAt: string;
  };
  rootNodeId: string;
  nodes: MindmapNodeDTO[];
}>;

export type CreateNodeResponse = Readonly<{
  node: MindmapNodeDTO;
  mindmapUpdatedAt: string;
}>;

export type UpdateNodeResponse = Readonly<{
  node: MindmapNodeDTO;
}>;

export const updateMindmapInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "마인드맵 제목을 입력해 주세요.")
    .max(200, "마인드맵 제목은 200자 이하여야 합니다."),
});

export const mindmapIdSchema = z.uuid("올바른 마인드맵 ID가 아닙니다.");
export const nodeIdSchema = z.uuid("올바른 노드 ID가 아닙니다.");

const nodeTitleSchema = z
  .string()
  .trim()
  .min(1, "노드 제목을 입력해 주세요.")
  .max(200, "노드 제목은 200자 이하여야 합니다.");

export const createNodeInputSchema = z.object({
  parentNodeId: nodeIdSchema,
  title: nodeTitleSchema,
  x: z.number().finite("노드의 x 좌표가 올바르지 않습니다."),
  y: z.number().finite("노드의 y 좌표가 올바르지 않습니다."),
});

export const updateNodeTitleInputSchema = z.object({
  title: nodeTitleSchema,
  revision: z.number().int().nonnegative("노드 revision이 올바르지 않습니다."),
});

export const updateNodePositionInputSchema = z.object({
  x: z.number().finite("노드의 x 좌표가 올바르지 않습니다."),
  y: z.number().finite("노드의 y 좌표가 올바르지 않습니다."),
  revision: z.number().int().nonnegative("노드 revision이 올바르지 않습니다."),
});

export const updateNodeCollapseInputSchema = z.object({
  isCollapsed: z.boolean("접기 상태가 올바르지 않습니다."),
  revision: z.number().int().nonnegative("노드 revision이 올바르지 않습니다."),
});

export type UpdateMindmapInput = z.infer<typeof updateMindmapInputSchema>;
export type CreateNodeInput = z.infer<typeof createNodeInputSchema>;
export type UpdateNodeTitleInput = z.infer<typeof updateNodeTitleInputSchema>;
export type UpdateNodePositionInput = z.infer<typeof updateNodePositionInputSchema>;
export type UpdateNodeCollapseInput = z.infer<typeof updateNodeCollapseInputSchema>;
