import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  createNodeInputSchema,
  type CreateNodeResponse,
  mindmapIdSchema,
} from "@/features/mindmap/api/contracts";
import { requireApiUser } from "@/server/auth/request";
import { toMindmapNodeDTO } from "@/server/domain/mindmap.dto";
import { createChildNodeForUser } from "@/server/domain/node.service";
import {
  assertSameOrigin,
  errorResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/server/http/api";

type NodesRouteContext = {
  params: Promise<{ mindmapId: string }>;
};

export async function POST(request: NextRequest, context: NodesRouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(request);
    const mindmapId = mindmapIdSchema.safeParse((await context.params).mindmapId);
    if (!mindmapId.success) return validationErrorResponse(mindmapId.error);
    const body = createNodeInputSchema.safeParse(await readJsonBody(request));
    if (!body.success) return validationErrorResponse(body.error);

    const created = await createChildNodeForUser(
      { mindmapId: mindmapId.data, ...body.data },
      user.id,
    );
    const response: CreateNodeResponse = {
      node: toMindmapNodeDTO(created.node),
      mindmapUpdatedAt: created.mindmapUpdatedAt.toISOString(),
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
