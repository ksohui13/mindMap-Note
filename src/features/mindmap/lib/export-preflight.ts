import { fetchNodeContent } from "@/features/mindmap/api/client";
import {
  listMindmapDraftJournals,
  removeDraftJournal,
} from "@/features/mindmap/lib/draft-journal";

export type UnresolvedExportDraft = Readonly<{ nodeId: string; title: string }>;

export async function findUnresolvedExportDrafts({
  storage,
  mindmapId,
  nodeIds,
}: {
  storage: Storage | null;
  mindmapId: string;
  nodeIds?: ReadonlySet<string>;
}): Promise<UnresolvedExportDraft[]> {
  const journals = listMindmapDraftJournals(storage, mindmapId)
    .filter((entry) => !nodeIds || nodeIds.has(entry.nodeId));
  const unresolved: UnresolvedExportDraft[] = [];
  for (const journal of journals) {
    const server = await fetchNodeContent(journal.nodeId);
    if (server.node.contentMd === journal.contentMd) {
      removeDraftJournal(storage, mindmapId, journal.nodeId);
    } else {
      unresolved.push({ nodeId: journal.nodeId, title: server.node.title });
    }
  }
  return unresolved;
}

export function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function formatUnresolvedDraftMessage(titles: readonly string[]): string {
  const preview = titles.slice(0, 3).join(", ");
  const remainder = titles.length > 3 ? ` 외 ${titles.length - 3}개` : "";
  return `복구할 로컬 초안이 있는 노드 ${titles.length}개를 먼저 열어 처리해 주세요: ${preview}${remainder}`;
}
