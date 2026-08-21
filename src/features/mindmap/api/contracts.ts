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

export const updateMindmapInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "마인드맵 제목을 입력해 주세요.")
    .max(200, "마인드맵 제목은 200자 이하여야 합니다."),
});

export const mindmapIdSchema = z.uuid("올바른 마인드맵 ID가 아닙니다.");

export type UpdateMindmapInput = z.infer<typeof updateMindmapInputSchema>;
