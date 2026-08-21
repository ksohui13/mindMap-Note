import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type {
  CreateMindmapResponse,
  MindmapListResponse,
} from "@/features/mindmap/api/contracts";
import { requireApiUser } from "@/server/auth/request";
import { toMindmapSummaryDTO } from "@/server/domain/mindmap.dto";
import {
  createMindmapWithRoot,
  listMindmapsWithNodeCount,
} from "@/server/domain/mindmap.service";
import { assertSameOrigin, errorResponse } from "@/server/http/api";

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
    const created = await createMindmapWithRoot(user.id);
    const response: CreateMindmapResponse = {
      mindmap: toMindmapSummaryDTO({
        ...created.mindmap,
        _count: { nodes: 1 },
      }),
      rootNodeId: created.rootNode.id,
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
