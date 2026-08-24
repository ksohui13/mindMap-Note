import type { NextRequest } from "next/server";

import {
  exportMindmapInputSchema,
  mindmapIdSchema,
} from "@/features/mindmap/api/contracts";
import { requireApiUser } from "@/server/auth/request";
import { exportMindmapForUser } from "@/server/domain/mindmap-export.service";
import {
  assertSameOrigin,
  errorResponse,
  readJsonBody,
  validationErrorResponse,
} from "@/server/http/api";

type ExportRouteContext = {
  params: Promise<{ mindmapId: string }>;
};

export async function POST(request: NextRequest, context: ExportRouteContext) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(request);
    const id = mindmapIdSchema.safeParse((await context.params).mindmapId);
    if (!id.success) return validationErrorResponse(id.error);
    const body = exportMindmapInputSchema.safeParse(await readJsonBody(request));
    if (!body.success) return validationErrorResponse(body.error);

    const result = await exportMindmapForUser(id.data, user.id, body.data);
    return new Response(result.markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": result.contentDisposition,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
