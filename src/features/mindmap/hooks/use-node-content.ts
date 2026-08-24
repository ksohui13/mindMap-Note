"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchNodeContent,
  updateNodeContent,
} from "@/features/mindmap/api/client";
import type { UpdateNodeContentInput } from "@/features/mindmap/api/contracts";
import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";
import { mindmapDetailQueryKey } from "@/features/mindmap/hooks/use-mindmap-detail";

export const nodeContentQueryKey = (nodeId: string) => ["nodes", nodeId, "content"] as const;

export function useNodeContent(nodeId: string | null) {
  return useQuery({
    queryKey: nodeContentQueryKey(nodeId ?? "none"),
    queryFn: () => fetchNodeContent(nodeId as string),
    enabled: nodeId !== null,
  });
}

export function useUpdateNodeContent(mindmapId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, input }: { nodeId: string; input: UpdateNodeContentInput }) =>
      updateNodeContent(nodeId, input),
    onSuccess: (response) => {
      queryClient.setQueryData(nodeContentQueryKey(response.node.id), response);
      queryClient.setQueryData<MindmapDetailResponse>(
        mindmapDetailQueryKey(mindmapId),
        (current) => current
          ? {
              ...current,
              nodes: current.nodes.map((node) => node.id === response.node.id
                ? { ...node, title: response.node.title, revision: response.node.revision }
                : node),
            }
          : current,
      );
    },
  });
}
