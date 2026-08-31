import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type {
  CreateMindmapResponse,
  MindmapListResponse,
} from "@/features/mindmap/api/contracts";
import { createMindmapInputSchema } from "@/features/mindmap/api/contracts";
import { requireApiUser } from "@/server/auth/request";
import { toMindmapNodeDTO, toMindmapSummaryDTO } from "@/server/domain/mindmap.dto";
import {
  createMindmapWithRoot,
  listMindmapsWithNodeCount,
} from "@/server/domain/mindmap.service";
import { assertSameOrigin, errorResponse, readJsonBody, validationErrorResponse } from "@/server/http/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser(request);
    const mindmaps = await listMindmapsWithNodeCount(user.id);
    return NextResponse.json<MindmapListResponse>({
      mindmaps: mindmaps.map(toMindmapSummaryDTO),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(request);
    const body = createMindmapInputSchema.safeParse(await readJsonBody(request));
    if (!body.success) return validationErrorResponse(body.error);
    const created = await createMindmapWithRoot(user.id, body.data);
    const detail = {
      mindmap: {
        id: created.mindmap.id,
        title: created.mindmap.title,
        updatedAt: created.mindmap.updatedAt.toISOString(),
      },
      rootNodeId: created.rootNode.id,
      nodes: [toMindmapNodeDTO(created.rootNode)],
    };
    const response: CreateMindmapResponse = {
      mindmap: toMindmapSummaryDTO({
        ...created.mindmap,
        _count: { nodes: 1 },
      }),
      rootNodeId: created.rootNode.id,
      detail,
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
