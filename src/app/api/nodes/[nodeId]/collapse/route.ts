import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  nodeIdSchema,
  type UpdateNodeResponse,
  updateNodeCollapseInputSchema,
} from "@/features/mindmap/api/contracts";
import { requireApiUser } from "@/server/auth/request";
import { toMindmapNodeDTO } from "@/server/domain/mindmap.dto";
import { updateNodeCollapseForUser } from "@/server/domain/node.service";
import {
  assertSameOrigin,
  errorResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/server/http/api";

type NodeCollapseRouteContext = { params: Promise<{ nodeId: string }> };

export async function PATCH(request: NextRequest, context: NodeCollapseRouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(request);
    const nodeId = nodeIdSchema.safeParse((await context.params).nodeId);
    if (!nodeId.success) return validationErrorResponse(nodeId.error);
    const body = updateNodeCollapseInputSchema.safeParse(await readJsonBody(request));
    if (!body.success) return validationErrorResponse(body.error);

    const node = await updateNodeCollapseForUser(
      nodeId.data,
      user.id,
      body.data.isCollapsed,
      body.data.revision,
    );
    const response: UpdateNodeResponse = { node: toMindmapNodeDTO(node) };
    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
