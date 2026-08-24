import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  NODE_CONTENT_MAX_BYTES,
  nodeIdSchema,
  type NodeContentResponse,
  updateNodeContentInputSchema,
} from "@/features/mindmap/api/contracts";
import { requireApiUser } from "@/server/auth/request";
import { toNodeContentDTO } from "@/server/domain/mindmap.dto";
import {
  getNodeContentForUser,
  updateNodeContentForUser,
} from "@/server/domain/node.service";
import {
  assertSameOrigin,
  errorResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/server/http/api";

const CONTENT_REQUEST_MAX_BYTES = NODE_CONTENT_MAX_BYTES * 6 + 1_024;

type NodeContentRouteContext = {
  params: Promise<{ nodeId: string }>;
};

export async function GET(request: NextRequest, context: NodeContentRouteContext) {
  try {
    const user = await requireApiUser(request);
    const nodeId = nodeIdSchema.safeParse((await context.params).nodeId);
    if (!nodeId.success) return validationErrorResponse(nodeId.error);

    const node = await getNodeContentForUser(nodeId.data, user.id);
    const response: NodeContentResponse = { node: toNodeContentDTO(node) };
    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: NodeContentRouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(request);
    const nodeId = nodeIdSchema.safeParse((await context.params).nodeId);
    if (!nodeId.success) return validationErrorResponse(nodeId.error);
    const body = updateNodeContentInputSchema.safeParse(
      await readJsonBody(request, CONTENT_REQUEST_MAX_BYTES),
    );
    if (!body.success) {
      return validationErrorResponse(
        body.error,
        body.error.issues[0]?.message ?? "Markdown 내용을 확인해 주세요.",
      );
    }

    const node = await updateNodeContentForUser(
      nodeId.data,
      user.id,
      body.data.contentMd,
      body.data.revision,
    );
    const response: NodeContentResponse = { node: toNodeContentDTO(node) };
    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
