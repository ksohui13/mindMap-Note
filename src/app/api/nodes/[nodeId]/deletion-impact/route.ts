import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  nodeIdSchema,
  type NodeDeletionImpactResponse,
} from "@/features/mindmap/api/contracts";
import { requireApiUser } from "@/server/auth/request";
import { getNodeDeletionImpactForUser } from "@/server/domain/node.service";
import { errorResponse, validationErrorResponse } from "@/server/http/api";

type NodeDeletionImpactRouteContext = {
  params: Promise<{ nodeId: string }>;
};

export async function GET(
  request: NextRequest,
  context: NodeDeletionImpactRouteContext,
) {
  try {
    const user = await requireApiUser(request);
    const nodeId = nodeIdSchema.safeParse((await context.params).nodeId);
    if (!nodeId.success) return validationErrorResponse(nodeId.error);
    const response: NodeDeletionImpactResponse = await getNodeDeletionImpactForUser(
      nodeId.data,
      user.id,
    );
    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
