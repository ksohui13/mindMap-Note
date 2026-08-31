import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  batchUpdateNodePositionsInputSchema,
  mindmapIdSchema,
  type BatchUpdateNodePositionsResponse,
} from "@/features/mindmap/api/contracts";
import { requireApiUser } from "@/server/auth/request";
import { toMindmapNodeDTO } from "@/server/domain/mindmap.dto";
import { updateNodePositionsForUser } from "@/server/domain/node.service";
import {
  assertSameOrigin,
  errorResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/server/http/api";

type NodePositionsRouteContext = { params: Promise<{ mindmapId: string }> };

export async function PATCH(request: NextRequest, context: NodePositionsRouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(request);
    const mindmapId = mindmapIdSchema.safeParse((await context.params).mindmapId);
    if (!mindmapId.success) return validationErrorResponse(mindmapId.error);
    const body = batchUpdateNodePositionsInputSchema.safeParse(await readJsonBody(request));
    if (!body.success) return validationErrorResponse(body.error);

    const result = await updateNodePositionsForUser(
      mindmapId.data,
      user.id,
      body.data.nodes,
    );
    const response: BatchUpdateNodePositionsResponse = {
      nodes: result.nodes.map(toMindmapNodeDTO),
      mindmapUpdatedAt: result.mindmapUpdatedAt.toISOString(),
    };
    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
