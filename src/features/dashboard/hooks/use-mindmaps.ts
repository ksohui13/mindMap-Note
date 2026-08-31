"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ApiClientError,
  createMindmap,
  deleteMindmap,
  fetchMindmaps,
  updateMindmap,
} from "@/features/mindmap/api/client";
import type {
  MindmapDetailResponse,
  MindmapListResponse,
  MindmapSummaryDTO,
} from "@/features/mindmap/api/contracts";
import { mindmapDetailQueryKey } from "@/features/mindmap/hooks/use-mindmap-detail";
import { nodeContentQueryKey, nodeDeletedQueryKey } from "@/features/mindmap/hooks/use-node-content";
import { removeMindmapDraftJournals } from "@/features/mindmap/lib/draft-journal";

export const mindmapQueryKey = ["mindmaps"] as const;

export function useMindmaps() {
  return useQuery({ queryKey: mindmapQueryKey, queryFn: fetchMindmaps });
}

export function useCreateMindmap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMindmap,
    onSuccess: ({ mindmap, detail }) => {
      queryClient.setQueryData<MindmapListResponse>(mindmapQueryKey, (current) => ({
        mindmaps: [mindmap, ...(current?.mindmaps ?? []).filter((item) => item.id !== mindmap.id)],
      }));
      queryClient.setQueryData(mindmapDetailQueryKey(mindmap.id), detail);
    },
  });
}

export function useRenameMindmap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      updateMindmap(id, { title }),
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: mindmapQueryKey });
      const previous = queryClient.getQueryData<MindmapListResponse>(mindmapQueryKey);
      const previousDetail = queryClient.getQueryData<MindmapDetailResponse>(mindmapDetailQueryKey(id));
      queryClient.setQueryData<MindmapListResponse>(mindmapQueryKey, (current) => ({
        mindmaps: (current?.mindmaps ?? []).map((mindmap) =>
          mindmap.id === id ? { ...mindmap, title } : mindmap,
        ),
      }));
      queryClient.setQueryData<MindmapDetailResponse>(mindmapDetailQueryKey(id), (current) => current
        ? { ...current, mindmap: { ...current.mindmap, title } }
        : current);
      return { previous, previousDetail };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(mindmapQueryKey, context.previous);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(mindmapDetailQueryKey(_variables.id), context.previousDetail);
      }
    },
    onSuccess: ({ mindmap }) => {
      queryClient.setQueryData<MindmapListResponse>(mindmapQueryKey, (current) => ({
        mindmaps: sortByUpdatedAt(
          (current?.mindmaps ?? []).map((item) =>
            item.id === mindmap.id ? mindmap : item,
          ),
        ),
      }));
      queryClient.setQueryData<MindmapDetailResponse>(mindmapDetailQueryKey(mindmap.id), (current) => current
        ? {
            ...current,
            mindmap: {
              ...current.mindmap,
              title: mindmap.title,
              updatedAt: mindmap.updatedAt,
            },
          }
        : current);
    },
  });
}

export function useDeleteMindmap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expectedNodeCount }: { id: string; expectedNodeCount: number }) =>
      deleteMindmap(id, { expectedNodeCount }),
    onSuccess: ({ deletedMindmapId }) => {
      const detail = queryClient.getQueryData<MindmapDetailResponse>(
        mindmapDetailQueryKey(deletedMindmapId),
      );
      for (const node of detail?.nodes ?? []) {
        queryClient.setQueryData(nodeDeletedQueryKey(node.id), true);
        void queryClient.cancelQueries({ queryKey: nodeContentQueryKey(node.id), exact: true });
        queryClient.removeQueries({ queryKey: nodeContentQueryKey(node.id), exact: true });
      }
      queryClient.removeQueries({ queryKey: mindmapDetailQueryKey(deletedMindmapId), exact: true });
      queryClient.setQueryData<MindmapListResponse>(mindmapQueryKey, (current) => ({
        mindmaps: (current?.mindmaps ?? []).filter((item) => item.id !== deletedMindmapId),
      }));
      removeMindmapDraftJournals(getBrowserStorage(), deletedMindmapId);
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.status === 409) {
        return queryClient.invalidateQueries({ queryKey: mindmapQueryKey });
      }
    },
  });
}

function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sortByUpdatedAt(mindmaps: MindmapSummaryDTO[]) {
  return [...mindmaps].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}
