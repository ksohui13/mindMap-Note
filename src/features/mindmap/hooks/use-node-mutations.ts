"use client";

import { useMutation } from "@tanstack/react-query";

import { createNode, updateNodeTitle } from "@/features/mindmap/api/client";
import type {
  CreateNodeInput,
  UpdateNodeTitleInput,
} from "@/features/mindmap/api/contracts";

export function useCreateNode() {
  return useMutation({
    mutationFn: ({ mindmapId, input }: { mindmapId: string; input: CreateNodeInput }) =>
      createNode(mindmapId, input),
  });
}

export function useUpdateNodeTitle() {
  return useMutation({
    mutationFn: ({ nodeId, input }: { nodeId: string; input: UpdateNodeTitleInput }) =>
      updateNodeTitle(nodeId, input),
  });
}
