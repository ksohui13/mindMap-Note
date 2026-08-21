import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  mindmapIdSchema,
  type MindmapDetailResponse,
  type UpdateMindmapResponse,
  updateMindmapInputSchema,
} from "@/features/mindmap/api/contracts";
import { requireApiUser } from "@/server/auth/request";
import { toMindmapDetailDTO, toMindmapSummaryDTO } from "@/server/domain/mindmap.dto";
import { getMindmapDetailForUser, updateMindmapTitle } from "@/server/domain/mindmap.service";
import {
  assertSameOrigin,
  errorResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/server/http/api";

type MindmapRouteContext = {
  params: Promise<{ mindmapId: string }>;
};

export async function GET(request: NextRequest, context: MindmapRouteContext) {
  try {
    const user = await requireApiUser(request);
    const id = mindmapIdSchema.safeParse((await context.params).mindmapId);
    if (!id.success) return validationErrorResponse(id.error);
    const detail = await getMindmapDetailForUser(id.data, user.id);
    return NextResponse.json<MindmapDetailResponse>(toMindmapDetailDTO(detail));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: MindmapRouteContext,
) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(request);
    const id = mindmapIdSchema.safeParse((await context.params).mindmapId);
    if (!id.success) return validationErrorResponse(id.error);
    const body = updateMindmapInputSchema.safeParse(await readJsonBody(request));
    if (!body.success) return validationErrorResponse(body.error);

    const mindmap = await updateMindmapTitle(
      id.data,
      user.id,
      body.data.title,
    );
    const response: UpdateMindmapResponse = {
      mindmap: toMindmapSummaryDTO(mindmap),
    };
    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
