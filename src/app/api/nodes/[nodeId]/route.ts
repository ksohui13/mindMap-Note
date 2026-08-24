import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  deleteNodeInputSchema,
  type DeleteNodeResponse,
  nodeIdSchema,
  type UpdateNodeResponse,
  updateNodeTitleInputSchema,
} from "@/features/mindmap/api/contracts";
import { requireApiUser } from "@/server/auth/request";
import { toMindmapNodeDTO } from "@/server/domain/mindmap.dto";
import { deleteNodeSubtreeForUser, updateNodeTitleForUser } from "@/server/domain/node.service";
import {
  assertSameOrigin,
  errorResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/server/http/api";

type NodeRouteContext = {
  params: Promise<{ nodeId: string }>;
};

export async function PATCH(request: NextRequest, context: NodeRouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(request);
    const nodeId = nodeIdSchema.safeParse((await context.params).nodeId);
    if (!nodeId.success) return validationErrorResponse(nodeId.error);
    const body = updateNodeTitleInputSchema.safeParse(await readJsonBody(request));
    if (!body.success) return validationErrorResponse(body.error);

    const node = await updateNodeTitleForUser(
      nodeId.data,
      user.id,
      body.data.title,
      body.data.revision,
    );
    const response: UpdateNodeResponse = { node: toMindmapNodeDTO(node) };
    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: NodeRouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(request);
    const nodeId = nodeIdSchema.safeParse((await context.params).nodeId);
    if (!nodeId.success) return validationErrorResponse(nodeId.error);
    const body = deleteNodeInputSchema.safeParse(await readJsonBody(request));
    if (!body.success) return validationErrorResponse(body.error);

    const result = await deleteNodeSubtreeForUser(
      nodeId.data,
      user.id,
      body.data.expectedDeleteCount,
    );
    const response: DeleteNodeResponse = {
      deletedNodeId: result.deletedNodeId,
      deletedCount: result.deletedCount,
      mindmapUpdatedAt: result.mindmapUpdatedAt.toISOString(),
    };
    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
