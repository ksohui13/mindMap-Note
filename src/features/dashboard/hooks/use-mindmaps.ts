"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createMindmap,
  fetchMindmaps,
  updateMindmap,
} from "@/features/mindmap/api/client";
import type {
  MindmapListResponse,
  MindmapSummaryDTO,
} from "@/features/mindmap/api/contracts";

export const mindmapQueryKey = ["mindmaps"] as const;

export function useMindmaps() {
  return useQuery({ queryKey: mindmapQueryKey, queryFn: fetchMindmaps });
}

export function useCreateMindmap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMindmap,
    onSuccess: ({ mindmap }) => {
      queryClient.setQueryData<MindmapListResponse>(mindmapQueryKey, (current) => ({
        mindmaps: [mindmap, ...(current?.mindmaps ?? [])],
      }));
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
      queryClient.setQueryData<MindmapListResponse>(mindmapQueryKey, (current) => ({
        mindmaps: (current?.mindmaps ?? []).map((mindmap) =>
          mindmap.id === id ? { ...mindmap, title } : mindmap,
        ),
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(mindmapQueryKey, context.previous);
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
    },
  });
}

function sortByUpdatedAt(mindmaps: MindmapSummaryDTO[]) {
  return [...mindmaps].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}
