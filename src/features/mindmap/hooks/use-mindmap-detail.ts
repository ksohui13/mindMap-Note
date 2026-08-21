"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchMindmapDetail } from "@/features/mindmap/api/client";
import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";

export const mindmapDetailQueryKey = (mindmapId: string) => ["mindmaps", mindmapId] as const;

export function useMindmapDetail(
  mindmapId: string,
  initialData?: MindmapDetailResponse,
) {
  return useQuery({
    queryKey: mindmapDetailQueryKey(mindmapId),
    queryFn: () => fetchMindmapDetail(mindmapId),
    initialData,
  });
}
