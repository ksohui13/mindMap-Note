"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import {
  deleteNode,
  fetchNodeDeletionImpact,
} from "@/features/mindmap/api/client";
import type { DeleteNodeInput } from "@/features/mindmap/api/contracts";

export const nodeDeletionImpactQueryKey = (nodeId: string) =>
  ["nodes", nodeId, "deletion-impact"] as const;

export function useNodeDeletionImpact(nodeId: string | null) {
  return useQuery({
    queryKey: nodeDeletionImpactQueryKey(nodeId ?? "none"),
    queryFn: () => fetchNodeDeletionImpact(nodeId as string),
    enabled: nodeId !== null,
    staleTime: 0,
  });
}

export function useDeleteNode() {
  return useMutation({
    mutationFn: ({ nodeId, input }: { nodeId: string; input: DeleteNodeInput }) =>
      deleteNode(nodeId, input),
  });
}
