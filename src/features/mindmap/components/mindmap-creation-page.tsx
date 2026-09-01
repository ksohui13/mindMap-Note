"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useCreateMindmap } from "@/features/dashboard/hooks/use-mindmaps";
import type { MindmapDetailResponse } from "@/features/mindmap/api/contracts";
import { MindmapEditor } from "@/features/mindmap/components/mindmap-editor";
import { mindmapDetailQueryKey } from "@/features/mindmap/hooks/use-mindmap-detail";

export function MindmapCreationPage({
  mindmapId,
  rootNodeId,
}: {
  mindmapId: string;
  rootNodeId: string;
}) {
  const queryClient = useQueryClient();
  const creation = useCreateMindmap();
  const started = useRef(false);
  const cachedDetail = queryClient.getQueryData<MindmapDetailResponse>(
    mindmapDetailQueryKey(mindmapId),
  );
  const detail = cachedDetail ?? creation.data?.detail;

  function create() {
    if (started.current || creation.isPending) return;
    started.current = true;
    creation.mutate(
      { mindmapId, rootNodeId },
      {
        onError: () => {
          started.current = false;
        },
      },
    );
  }

  useEffect(() => {
    if (!cachedDetail) create();
    // The ids are immutable for this route. The ref prevents Strict Mode duplicates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedDetail, mindmapId, rootNodeId]);

  useEffect(() => {
    if (detail) {
      window.history.replaceState(null, "", `/mindmaps/${mindmapId}`);
    }
  }, [detail, mindmapId]);

  if (detail) {
    return (
      <MindmapEditor
        mindmapId={mindmapId}
        initialData={detail}
        initialRootSelection
      />
    );
  }

  if (creation.isError) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--background)] p-6">
        <div role="alert" className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-[var(--shadow-card)]">
          <h1 className="text-xl font-extrabold">마인드맵을 만들지 못했습니다</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">같은 마인드맵 ID로 안전하게 다시 시도할 수 있습니다.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-bold">Dashboard</Link>
            <button type="button" onClick={create} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white">다시 시도</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main aria-label="새 마인드맵 만드는 중" className="grid h-screen place-items-center bg-gradient-to-br from-violet-50 to-[var(--background)]">
      <div className="text-center">
        <div className="mx-auto size-14 animate-pulse rounded-2xl bg-violet-200" />
        <p className="mt-4 font-extrabold text-[var(--primary)]">새 마인드맵을 만드는 중…</p>
      </div>
    </main>
  );
}
