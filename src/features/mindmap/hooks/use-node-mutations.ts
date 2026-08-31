"use client";

import { useMutation } from "@tanstack/react-query";

import {
  batchUpdateNodePositions,
  createNode,
  updateNodeCollapse,
  updateNodePosition,
  updateNodeTitle,
} from "@/features/mindmap/api/client";
import type {
  BatchUpdateNodePositionsInput,
  CreateNodeInput,
  UpdateNodeCollapseInput,
  UpdateNodePositionInput,
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

export function useUpdateNodePosition() {
  return useMutation({
    mutationFn: ({ nodeId, input }: { nodeId: string; input: UpdateNodePositionInput }) =>
      updateNodePosition(nodeId, input),
  });
}

export function useBatchUpdateNodePositions() {
  return useMutation({
    mutationFn: ({
      mindmapId,
      input,
    }: {
      mindmapId: string;
      input: BatchUpdateNodePositionsInput;
    }) => batchUpdateNodePositions(mindmapId, input),
  });
}

export function useUpdateNodeCollapse() {
  return useMutation({
    mutationFn: ({ nodeId, input }: { nodeId: string; input: UpdateNodeCollapseInput }) =>
      updateNodeCollapse(nodeId, input),
  });
}
