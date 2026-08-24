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
export type DeleteMindmapResponse = Readonly<{
  deletedMindmapId: string;
  deletedNodeCount: number;
}>;

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

export type NodeDeletionImpactResponse = Readonly<{
  node: Readonly<{ id: string; title: string }>;
  descendantCount: number;
  totalDeleteCount: number;
}>;

export type DeleteNodeResponse = Readonly<{
  deletedNodeId: string;
  deletedCount: number;
  mindmapUpdatedAt: string;
}>;

export const NODE_CONTENT_MAX_BYTES = 256 * 1_024;

export type NodeContentDTO = Readonly<{
  id: string;
  title: string;
  contentMd: string;
  revision: number;
}>;

export type NodeContentResponse = Readonly<{
  node: NodeContentDTO;
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

export const deleteMindmapInputSchema = z.object({
  expectedNodeCount: z.number().int().nonnegative("예상 노드 수가 올바르지 않습니다."),
});

export const updateNodeContentInputSchema = z.object({
  contentMd: z.string().refine(
    (value) => new TextEncoder().encode(value).byteLength <= NODE_CONTENT_MAX_BYTES,
    "Markdown 내용은 UTF-8 기준 256KiB 이하여야 합니다.",
  ),
  revision: z.number().int().nonnegative("노드 revision이 올바르지 않습니다."),
});

export const deleteNodeInputSchema = z.object({
  expectedDeleteCount: z.number().int().positive("예상 삭제 수가 올바르지 않습니다."),
});

const exportFormatSchema = z.literal("MARKDOWN");

export const exportMindmapInputSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("ALL"),
    format: exportFormatSchema,
  }).strict(),
  z.object({
    scope: z.literal("NODE"),
    nodeId: nodeIdSchema,
    format: exportFormatSchema,
  }).strict(),
  z.object({
    scope: z.literal("SUBTREE"),
    nodeId: nodeIdSchema,
    format: exportFormatSchema,
  }).strict(),
]);

export type UpdateMindmapInput = z.infer<typeof updateMindmapInputSchema>;
export type DeleteMindmapInput = z.infer<typeof deleteMindmapInputSchema>;
export type CreateNodeInput = z.infer<typeof createNodeInputSchema>;
export type UpdateNodeTitleInput = z.infer<typeof updateNodeTitleInputSchema>;
export type UpdateNodePositionInput = z.infer<typeof updateNodePositionInputSchema>;
export type UpdateNodeCollapseInput = z.infer<typeof updateNodeCollapseInputSchema>;
export type UpdateNodeContentInput = z.infer<typeof updateNodeContentInputSchema>;
export type DeleteNodeInput = z.infer<typeof deleteNodeInputSchema>;
export type ExportMindmapInput = z.infer<typeof exportMindmapInputSchema>;
export type ExportScope = ExportMindmapInput["scope"];
